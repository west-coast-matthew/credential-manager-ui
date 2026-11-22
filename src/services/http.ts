/**
 * The credential-manager-api over HTTP (../credential-manager-api/docs/API.md).
 *
 * Requests carry the session cookie (httpOnly, set by POST /api/auth/login). Any 401
 * outside sign-in is reported to `onUnauthorized` so the app can return to the sign-in screen.
 */
import type {
  Account,
  AccountInput,
  CreateGroupInput,
  DataResponse,
  DeleteGroupResult,
  ErrorBody,
  ErrorCode,
  Group,
  KdfParams,
  ListResponse,
  SessionInfo,
  UpdateGroupInput,
} from '../types'
import { ApiError } from './contract'

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

let unauthorizedListener: (() => void) | undefined
/** Called whenever the API answers 401 UNAUTHORIZED (session expired or signed out elsewhere). */
export const onUnauthorized = (listener: () => void) => {
  unauthorizedListener = listener
}

function unreachable() {
  // Network failure: server down, wrong address, or blocked by CORS.
  return new ApiError('SERVICE_UNAVAILABLE', undefined, "Can't reach the server. Check that the API is running.", 0)
}

async function errorFrom(res: Response) {
  const payload: unknown = await res.json().catch(() => undefined)
  const error = (payload as Partial<ErrorBody> | undefined)?.error
  if (error?.code) return new ApiError(error.code as ErrorCode, error.details, error.message, res.status)
  // A 5xx without the API's error envelope comes from a proxy (e.g. Vite's when the API is down).
  if (res.status >= 500) return unreachable()
  return new ApiError(res.status >= 500 ? 'INTERNAL_ERROR' : 'NOT_FOUND', undefined, undefined, res.status)
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      cache: 'no-store',
      credentials: 'include',
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw unreachable()
  }

  if (res.status === 204) return undefined as T
  if (!res.ok) {
    const error = await errorFrom(res)
    if (error.code === 'UNAUTHORIZED') unauthorizedListener?.()
    throw error
  }

  const payload: unknown = await res.json().catch(() => undefined)
  if (payload === undefined) {
    throw new ApiError('INTERNAL_ERROR', undefined, 'The server sent a response the app could not read.', res.status)
  }
  return payload as T
}

const id = (value: string) => encodeURIComponent(value)

export const api = {
  /* ----- Auth ----- */
  prelogin: (username: string) => request<DataResponse<{ kdf: KdfParams }>>('POST', '/api/auth/prelogin', { username }),
  login: (input: { username: string; authKey: string; rememberMe: boolean }) =>
    request<DataResponse<SessionInfo>>('POST', '/api/auth/login', input),
  logout: () => request<void>('POST', '/api/auth/logout'),
  session: () => request<DataResponse<SessionInfo>>('GET', '/api/auth/session'),
  setVaultKey: (wrappedVaultKey: string) => request<DataResponse<SessionInfo>>('PUT', '/api/auth/vault-key', { wrappedVaultKey }),
  changePassword: (input: { currentAuthKey: string; newAuthKey: string; kdf: KdfParams; wrappedVaultKey: string }) =>
    request<DataResponse<SessionInfo>>('POST', '/api/auth/change-password', input),

  /* ----- Groups ----- */
  listGroups: () => request<ListResponse<Group>>('GET', '/api/groups'),
  createGroup: (input: CreateGroupInput) => request<DataResponse<Group>>('POST', '/api/groups', input),
  updateGroup: (groupId: string, input: UpdateGroupInput) => request<DataResponse<Group>>('PATCH', `/api/groups/${id(groupId)}`, input),
  deleteGroup: (groupId: string) => request<DataResponse<DeleteGroupResult>>('DELETE', `/api/groups/${id(groupId)}`),

  /* ----- Accounts ----- */
  listAccounts: () => request<ListResponse<Account>>('GET', '/api/accounts'),
  createAccount: (input: AccountInput) => request<DataResponse<Account>>('POST', '/api/accounts', input),
  updateAccount: (accountId: string, input: Partial<AccountInput>) =>
    request<DataResponse<Account>>('PATCH', `/api/accounts/${id(accountId)}`, input),
  deleteAccount: (accountId: string) => request<void>('DELETE', `/api/accounts/${id(accountId)}`),
}
