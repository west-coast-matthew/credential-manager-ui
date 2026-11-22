/*
 * API contract types. These mirror ../credential-manager-api/src/types/index.ts — keep them in step.
 *
 * On the wire, `password`, `passwordHint` and `wrappedVaultKey` are always ciphertext
 * produced by src/lib/crypto.ts. Plaintext only exists in drafts (the form) and in
 * memory while a value is shown or copied.
 */

export const AUTH_TYPES = ['password', 'google', 'microsoft', 'apple', 'github', 'other'] as const
export type AuthType = (typeof AUTH_TYPES)[number]

export const AUTH_TYPE_LABELS: Record<AuthType, string> = {
  password: 'Normal login',
  google: 'Google',
  microsoft: 'Microsoft',
  apple: 'Apple',
  github: 'GitHub',
  other: 'Other sign-in',
}

export interface Group {
  id: string
  name: string
  parentId: string | null
  createdAt: string
  updatedAt: string
}

export interface SubAccount {
  id: string
  label: string
  username: string | null
  email: string | null
  /** Ciphertext. */
  password: string | null
  /** Ciphertext. */
  passwordHint: string | null
  notes: string | null
}

export interface Account {
  id: string
  groupId: string | null
  title: string
  description: string | null
  authType: AuthType
  url: string | null
  username: string | null
  email: string | null
  /** Ciphertext. */
  password: string | null
  /** Ciphertext. */
  passwordHint: string | null
  subAccounts: SubAccount[]
  createdAt: string
  updatedAt: string
}

/* ---------- Drafts: what the form edits, with secrets in plaintext ---------- */

export interface SubAccountDraft {
  id: string
  label: string
  username: string | null
  email: string | null
  password: string | null
  passwordHint: string | null
  notes: string | null
}

export interface AccountDraft {
  id: string
  groupId: string | null
  title: string
  description: string | null
  authType: AuthType
  url: string | null
  username: string | null
  email: string | null
  password: string | null
  passwordHint: string | null
  subAccounts: SubAccountDraft[]
}

/** The draft after encryption: what POST/PATCH /api/accounts receive. */
export type AccountInput = AccountDraft

export interface CreateGroupInput {
  name: string
  parentId?: string | null
}
export type UpdateGroupInput = Partial<CreateGroupInput>

/* ---------- Auth ---------- */

export interface KdfParams {
  algorithm: 'argon2id'
  salt: string
  memoryKiB: number
  iterations: number
  parallelism: number
}

export interface SessionInfo {
  user: { id: string; username: string }
  kdf: KdfParams
  wrappedVaultKey: string | null
  rememberMe: boolean
  expiresAt: string
}

/* ---------- Envelopes ---------- */

export interface DataResponse<T> {
  data: T
}
export interface ListResponse<T> {
  data: T[]
  meta: { total: number }
}
export interface DeleteGroupResult {
  id: string
  deletedGroupIds: string[]
  movedAccountIds: string[]
  movedTo: string | null
}

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'TOO_MANY_ATTEMPTS'
  | 'NOT_FOUND'
  | 'DUPLICATE_GROUP'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'

export interface FieldError {
  field: string
  message: string
}
export interface ErrorBody {
  error: { code: ErrorCode; message: string; details?: FieldError[] }
}
