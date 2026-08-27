import { supabase } from './supabase'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly detail?: Record<string, unknown>

  constructor(status: number, code: string, message: string, detail?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}

type Options = { method?: string; body?: unknown; signed?: boolean }

async function request<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = {}

  // The link routes are the only ones that answer without an account, and they
  // must not carry a token: a reader following a link is not signing in.
  if (options.signed !== false) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      // A refresh token revoked on the server comes back as no session and no
      // event, so nothing else would notice. Signing out is what tells the app.
      await supabase.auth.signOut()
      throw new ApiError(401, 'unauthorized', 'Sign in to continue')
    }
    headers.authorization = `Bearer ${token}`
  }

  if (options.body !== undefined) headers['content-type'] = 'application/json'

  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  if (response.status === 204) return undefined as T
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    // The client refreshes tokens on its own, so a 401 from the API means the
    // session is genuinely gone. Dropping it here sends the app back to the sign
    // in screen instead of leaving every panel showing a load error.
    if (response.status === 401 && options.signed !== false) {
      await supabase.auth.signOut()
    }

    throw new ApiError(
      response.status,
      payload?.error ?? 'unknown',
      payload?.message ?? 'Something went wrong',
      payload?.detail,
    )
  }

  return payload as T
}

export type Role = 'owner' | 'viewer'
export type ResourceType = 'data_room' | 'folder' | 'file'

/** Why a row is reachable, as the table draws it. Null for anyone but the owner. */
export interface AccessBadge {
  /** Everyone this node is visible to, however the access arrived. */
  people: number
  link: boolean
  /** What was granted on this node itself, which is what the row's chip says. */
  here: { people: number; link: boolean }
  inherited: boolean
  /** The closest folder above that access comes from. */
  grantedAt: string | null
}

export interface RoomSummary {
  id: string
  name: string
  role: Role
  /** Where opening this room lands: the root for an owner, the granted node for a reader. */
  entry: { kind: 'folder' | 'file'; id: string | null }
  updatedAt: string
  files: number | null
  bytes: number | null
}

export interface FolderRow {
  id: string
  name: string
  updatedAt: string
  access: AccessBadge | null
}

export interface FileRow extends FolderRow {
  sizeBytes: number
  mimeType: string
}

export interface FolderView {
  room: { id: string; name: string; role: Role }
  folder: { id: string; name: string; parentId: string | null; access: AccessBadge | null }
  breadcrumbs: { id: string; name: string }[]
  folders: FolderRow[]
  files: FileRow[]
}

export interface Manifest {
  folders: number
  files: number
  bytes: number
  shares: number
}

export interface Share {
  id: string
  mode: 'public_link' | 'user'
  role: 'viewer'
  token: string | null
  email: string | null
  createdAt: string
  inherited: boolean
  resourceType: ResourceType
  resourceId: string
}

export interface DownloadLink {
  url: string
  expiresIn: number
  name: string
  mimeType: string
  sizeBytes: number
}

export type OnConflict = 'fail' | 'rename' | 'version'

export interface UploadTicket {
  fileId: string
  name: string
  url: string
  token: string
  key: string
  /** Which version these bytes will be. One for anything but a name clash. */
  version: number
}

export interface FileVersion {
  version: number
  sizeBytes: number
  mimeType: string
  createdAt: string
  createdBy: string
  current: boolean
}

export interface SearchHit extends FileRow {
  folderId: string
  /** Where it sits, clipped at whatever the reader was given. */
  trail: { id: string; name: string }[]
}

export interface SearchResults {
  query: string
  truncated: boolean
  files: SearchHit[]
}

export const api = {
  rooms: {
    list: () => request<RoomSummary[]>('/rooms'),
    get: (id: string) =>
      request<{ id: string; name: string; role: Role; rootFolderId: string }>(`/rooms/${id}`),
    create: (name: string) =>
      request<{ id: string; name: string; rootFolderId: string }>('/rooms', {
        method: 'POST',
        body: { name },
      }),
    folders: (id: string) =>
      request<{ id: string; name: string; parentId: string | null; depth: number }[]>(
        `/rooms/${id}/folders`,
      ),
    rename: (id: string, name: string) =>
      request<{ id: string; name: string }>(`/rooms/${id}`, { method: 'PATCH', body: { name } }),
    remove: (id: string) => request<void>(`/rooms/${id}`, { method: 'DELETE' }),
    search: (id: string, query: string) =>
      request<SearchResults>(`/rooms/${id}/search?q=${encodeURIComponent(query)}`),
  },

  folders: {
    get: (id: string) => request<FolderView>(`/folders/${id}`),
    manifest: (id: string) => request<Manifest>(`/folders/${id}/manifest`),
    create: (parentId: string, name: string) =>
      request<FolderRow>('/folders', { method: 'POST', body: { parentId, name } }),
    update: (id: string, changes: { name?: string; parentId?: string }) =>
      request<FolderRow>(`/folders/${id}`, { method: 'PATCH', body: changes }),
    remove: (id: string) => request<void>(`/folders/${id}`, { method: 'DELETE' }),
  },

  files: {
    ticket: (folderId: string, file: { name: string; sizeBytes: number; onConflict: OnConflict }) =>
      request<UploadTicket>(`/folders/${folderId}/uploads`, { method: 'POST', body: file }),
    record: (folderId: string, fileId: string, name: string, version: number) =>
      request<FileRow>(`/folders/${folderId}/files`, {
        method: 'POST',
        body: { fileId, name, version },
      }),
    download: (id: string, disposition: 'inline' | 'attachment' = 'inline') =>
      request<DownloadLink>(`/files/${id}/download-url?disposition=${disposition}`),
    update: (id: string, changes: { name?: string; folderId?: string }) =>
      request<FileRow>(`/files/${id}`, { method: 'PATCH', body: changes }),
    remove: (id: string) => request<void>(`/files/${id}`, { method: 'DELETE' }),
    versions: (id: string) => request<FileVersion[]>(`/files/${id}/versions`),
    versionDownload: (id: string, version: number, disposition: 'inline' | 'attachment') =>
      request<DownloadLink>(
        `/files/${id}/versions/${version}/download-url?disposition=${disposition}`,
      ),
    restore: (id: string, version: number) =>
      request<{ id: string; name: string; version: number }>(
        `/files/${id}/versions/${version}/restore`,
        { method: 'POST' },
      ),
  },

  shares: {
    list: (resourceType: ResourceType, resourceId: string) =>
      request<Share[]>(`/shares?resourceType=${resourceType}&resourceId=${resourceId}`),
    create: (body: {
      resourceType: ResourceType
      resourceId: string
      mode: 'public_link' | 'user'
      email?: string
    }) => request<{ id: string; token?: string; email?: string }>('/shares', { method: 'POST', body }),
    revoke: (id: string) => request<void>(`/shares/${id}`, { method: 'DELETE' }),
  },

  links: {
    open: (token: string) =>
      request<{
        room: { id: string; name: string }
        kind: 'folder' | 'file'
        folderId: string | null
        file: { id: string; name: string; sizeBytes: number; mimeType: string } | null
      }>(`/links/${token}`, { signed: false }),
    folder: (token: string, id: string) =>
      request<FolderView>(`/links/${token}/folders/${id}`, { signed: false }),
    download: (token: string, id: string, disposition: 'inline' | 'attachment' = 'inline') =>
      request<DownloadLink>(`/links/${token}/files/${id}/download-url?disposition=${disposition}`, {
        signed: false,
      }),
    search: (token: string, query: string) =>
      request<SearchResults>(`/links/${token}/search?q=${encodeURIComponent(query)}`, {
        signed: false,
      }),
  },
}

/**
 * The bytes go straight to storage, so this is an XMLHttpRequest rather than fetch:
 * it is the only way to know how far along the upload actually is instead of
 * animating a bar and hoping.
 */
export function putToStorage(
  url: string,
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', url)
    request.setRequestHeader('content-type', file.type || 'application/octet-stream')

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    })

    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) resolve()
      else reject(new ApiError(request.status, 'upload_failed', 'The upload did not go through'))
    })
    request.addEventListener('error', () =>
      reject(new ApiError(0, 'network', 'The connection dropped during the upload')),
    )
    request.addEventListener('abort', () =>
      reject(new ApiError(0, 'aborted', 'The upload was cancelled')),
    )

    signal?.addEventListener('abort', () => request.abort())
    request.send(file)
  })
}
