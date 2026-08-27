import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

/**
 * The bucket is private and the service role key never leaves the server. The
 * browser only ever holds a URL that expires.
 *
 * Uploads go straight from the browser to storage rather than through this API.
 * That keeps the bytes out of a serverless function, where a request body limit
 * would cap file size at a few megabytes, and it makes the progress bar real
 * instead of a guess.
 */
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const bucket = () => supabase.storage.from(env.SUPABASE_STORAGE_BUCKET)

/** Long enough to open a document, short enough that a copied URL goes stale. */
export const DOWNLOAD_TTL_SECONDS = 300

/**
 * Ids only, so renaming or moving a file never touches the object. The room is
 * the first segment, which is what makes deleting a whole room one prefix sweep.
 */
export const objectKey = (dataRoomId: string, fileId: string) => `${dataRoomId}/${fileId}`

export async function signUpload(key: string, replace: boolean) {
  const { data, error } = await bucket().createSignedUploadUrl(key, { upsert: replace })
  if (error || !data) throw new Error(`Could not sign an upload for ${key}: ${error?.message}`)
  return { url: data.signedUrl, token: data.token }
}

export async function signDownload(key: string, filename: string, asAttachment: boolean) {
  const { data, error } = await bucket().createSignedUrl(key, DOWNLOAD_TTL_SECONDS, {
    // A PDF opens in the viewer unless the reader asked to save it.
    download: asAttachment ? filename : false,
  })
  if (error || !data) throw new Error(`Could not sign a download for ${key}: ${error?.message}`)
  return { url: data.signedUrl, expiresIn: DOWNLOAD_TTL_SECONDS }
}

/**
 * Size and type as storage recorded them, or null when nothing was uploaded.
 * The client declares both when it asks for an upload URL, and neither is
 * trusted: what lands in the database is what the object actually is.
 */
export async function describeObject(key: string) {
  const { data, error } = await bucket().info(key)
  // Storage reports a size only once the object is really stored, so a missing
  // one means the upload never landed.
  if (error || data.size === undefined) return null
  return { sizeBytes: data.size, mimeType: data.contentType ?? 'application/octet-stream' }
}

export async function removeObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const { error } = await bucket().remove(keys)
  if (error) throw new Error(error.message)
}

/** Every object belonging to a data room, for when the whole room is deleted. */
export async function listRoomObjects(dataRoomId: string): Promise<string[]> {
  const pageSize = 1000
  const keys: string[] = []

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await bucket().list(dataRoomId, { limit: pageSize, offset })
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) return keys

    keys.push(...data.map((object) => objectKey(dataRoomId, object.name)))
    if (data.length < pageSize) return keys
  }
}
