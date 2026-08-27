/**
 * Errors the API is willing to describe to a caller. Anything else becomes a 500
 * with no detail, because a data room should not narrate its own internals.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const unauthorized = (message = 'Sign in to continue') =>
  new AppError(401, 'unauthorized', message)

/**
 * Used for a node the caller may not see. It is deliberately indistinguishable
 * from a node that does not exist: answering 403 would confirm that a folder with
 * that id is real, which is exactly what a shared-out data room must not leak.
 */
export const notFound = (what = 'item') =>
  new AppError(404, 'not_found', `That ${what} does not exist, or you do not have access to it`)

/**
 * Unlike notFound, this one is safe to be precise about: the caller has already
 * been shown the thing, so the only new fact is that their access is read-only.
 */
export const readOnly = () =>
  new AppError(403, 'read_only', 'You can view this data room, but not change it')

export const nameTaken = (what: 'file' | 'folder', name: string) =>
  new AppError(409, 'name_taken', `A ${what} called "${name}" is already here`, { name })

/**
 * The file moved on between signing the upload and recording it, which means two
 * uploads of the same document overlapped. Saying so is safe: the caller owns
 * the room and already knows the file.
 */
export const versionRaced = (name: string) =>
  new AppError(409, 'version_raced', `"${name}" was updated while this was uploading`, { name })

export const shareRevoked = () =>
  new AppError(403, 'share_revoked', 'This link no longer works')

export const badRequest = (message: string, detail?: Record<string, unknown>) =>
  new AppError(400, 'bad_request', message, detail)
