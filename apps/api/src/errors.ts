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

export const nameTaken = (name: string, where: string) =>
  new AppError(409, 'name_taken', `A file with this name is already in ${where}`, { name, where })

export const shareRevoked = () =>
  new AppError(403, 'share_revoked', 'This link no longer works')

export const badRequest = (message: string, detail?: Record<string, unknown>) =>
  new AppError(400, 'bad_request', message, detail)
