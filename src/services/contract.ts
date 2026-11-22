import type { ErrorBody, ErrorCode, FieldError } from '../types'

/** Status and default message per code — mirrors credential-manager-api/src/errors/api-error.ts. */
export const ERRORS: Record<ErrorCode, { status: number; message: string }> = {
  VALIDATION_FAILED: { status: 400, message: 'Some fields need attention.' },
  UNAUTHORIZED: { status: 401, message: 'Sign in to continue.' },
  INVALID_CREDENTIALS: { status: 401, message: "That username and password don't match." },
  TOO_MANY_ATTEMPTS: { status: 429, message: 'Too many failed sign-ins. Wait a few minutes and try again.' },
  NOT_FOUND: { status: 404, message: 'That item no longer exists. It may have been deleted.' },
  DUPLICATE_GROUP: { status: 409, message: 'A group with this name already exists here.' },
  CONFLICT: { status: 409, message: 'That changed somewhere else. Reload and try again.' },
  INTERNAL_ERROR: { status: 500, message: 'Something went wrong on the server. Try again.' },
  SERVICE_UNAVAILABLE: { status: 503, message: 'The server is unavailable right now. Try again in a moment.' },
}

/** Thrown for every non-2xx response. `body` is exactly what the API sent. */
export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode
  readonly details?: FieldError[]
  readonly body: ErrorBody

  constructor(code: ErrorCode, details?: FieldError[], message?: string, status?: number) {
    const known = ERRORS[code] as (typeof ERRORS)[ErrorCode] | undefined
    const text = message ?? known?.message ?? 'Something went wrong. Try again.'
    super(text)
    this.name = 'ApiError'
    this.code = code
    this.status = status ?? known?.status ?? 500
    this.details = details
    this.body = { error: { code, message: text, ...(details ? { details } : {}) } }
  }
}

/** One line of user-facing text for any error a call can produce. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.details?.length ? error.details.map((d) => d.message).join(' ') : error.message
  }
  if (error instanceof Error && error.name === 'DecryptError') return error.message
  return 'Something went wrong. Try again.'
}
