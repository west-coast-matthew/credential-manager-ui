/*
 * Client-side encryption. See ../credential-manager-api/docs/SECURITY.md for the scheme.
 *
 *   master key   = Argon2id(password, salt, m/t/p from the server)       32 bytes
 *   auth key     = HKDF-SHA256(master key, info "credential-manager:auth:v1")   → sent to the API
 *   wrap key     = HKDF-SHA256(master key, info "credential-manager:wrap:v1")   → never leaves the browser
 *   vault key    = random AES-256-GCM key, stored on the server wrapped by the wrap key
 *   field value  = "v1.<iv>.<ciphertext>" AES-256-GCM under the vault key, bound to
 *                  the entry id and field name as additional authenticated data
 *
 * The auth-key derivation must match credential-manager-api/src/lib/kdf.ts exactly.
 */
import { argon2id } from 'hash-wasm'
import type { KdfParams } from '../types'

const AUTH_INFO = 'credential-manager:auth:v1'
const WRAP_INFO = 'credential-manager:wrap:v1'
const VERSION = 'v1'

const utf8 = new TextEncoder()
const fromUtf8 = new TextDecoder('utf-8', { fatal: true })

/** WebCrypto wants ArrayBuffer-backed views. */
const buf = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(bytes)

export function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64url(text: string): Uint8Array<ArrayBuffer> {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n))

/** Thrown when a value can't be decrypted: wrong password, or tampered/corrupt data. */
export class DecryptError extends Error {
  constructor() {
    super("This value couldn't be decrypted.")
    this.name = 'DecryptError'
  }
}

/* ---------- Password → keys ---------- */

export interface DerivedKeys {
  /** base64url, sent to the API to sign in. */
  authKey: string
  /** Unwraps the vault key. Non-extractable. */
  wrapKey: CryptoKey
}

/** Yields to the browser so a spinner can paint before the (deliberately slow) Argon2id run. */
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)))

export async function deriveKeys(password: string, kdf: KdfParams): Promise<DerivedKeys> {
  await nextFrame()
  const master = await argon2id({
    password: password.normalize('NFC'),
    salt: fromB64url(kdf.salt),
    parallelism: kdf.parallelism,
    iterations: kdf.iterations,
    memorySize: kdf.memoryKiB,
    hashLength: 32,
    outputType: 'binary',
  })
  const base = await crypto.subtle.importKey('raw', buf(master), 'HKDF', false, ['deriveBits', 'deriveKey'])
  master.fill(0)
  const hkdf = (info: string) => ({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: utf8.encode(info) })
  const authBits = new Uint8Array(await crypto.subtle.deriveBits(hkdf(AUTH_INFO), base, 256))
  const wrapKey = await crypto.subtle.deriveKey(hkdf(WRAP_INFO), base, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ])
  return { authKey: b64url(authBits), wrapKey }
}

/** Fresh Argon2id settings for a password change: new salt, same cost as before (or the defaults). */
export function newKdfParams(previous: KdfParams): KdfParams {
  return { ...previous, salt: b64url(randomBytes(16)) }
}

/* ---------- AES-256-GCM ---------- */

async function seal(key: CryptoKey, plaintext: Uint8Array, aad: string): Promise<string> {
  const iv = randomBytes(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: utf8.encode(aad) }, key, buf(plaintext))
  return `${VERSION}.${b64url(iv)}.${b64url(new Uint8Array(ct))}`
}

async function open(key: CryptoKey, sealed: string, aad: string): Promise<Uint8Array> {
  const [version, iv, ct] = sealed.split('.')
  if (version !== VERSION || !iv || !ct) throw new DecryptError()
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64url(iv), additionalData: utf8.encode(aad) },
      key,
      fromB64url(ct),
    )
    return new Uint8Array(pt)
  } catch {
    throw new DecryptError()
  }
}

/* ---------- Vault key ---------- */

const vaultKeyAad = (userId: string) => `cm:v1:vault-key:${userId}`

const importVaultKey = (raw: Uint8Array) =>
  crypto.subtle.importKey('raw', buf(raw), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])

/** A new random vault key, returned ready to use and wrapped for storage on the server. */
export async function createVaultKey(wrapKey: CryptoKey, userId: string): Promise<{ key: CryptoKey; wrapped: string }> {
  const raw = randomBytes(32)
  const wrapped = await seal(wrapKey, raw, vaultKeyAad(userId))
  const key = await importVaultKey(raw)
  raw.fill(0)
  return { key, wrapped }
}

/** Unwraps the stored vault key. Throws DecryptError if the password (wrap key) is wrong. */
export async function unwrapVaultKey(wrapKey: CryptoKey, wrapped: string, userId: string): Promise<CryptoKey> {
  const raw = await open(wrapKey, wrapped, vaultKeyAad(userId))
  const key = await importVaultKey(raw)
  raw.fill(0)
  return key
}

/** Re-wraps the vault key under a new password's wrap key (change password). The vault key itself doesn't change. */
export async function rewrapVaultKey(oldWrapKey: CryptoKey, newWrapKey: CryptoKey, wrapped: string, userId: string) {
  const raw = await open(oldWrapKey, wrapped, vaultKeyAad(userId))
  const rewrapped = await seal(newWrapKey, raw, vaultKeyAad(userId))
  raw.fill(0)
  return rewrapped
}

/* ---------- Fields ---------- */

/** What a field value is bound to, so ciphertext can't be moved to another entry or field. */
export type FieldRef = { kind: 'account' | 'sub'; id: string; field: 'password' | 'passwordHint' }

const fieldAad = (ref: FieldRef) => `cm:v1:${ref.kind}:${ref.id}:${ref.field}`

export const encryptField = (vaultKey: CryptoKey, plaintext: string, ref: FieldRef) =>
  seal(vaultKey, utf8.encode(plaintext), fieldAad(ref))

export async function decryptField(vaultKey: CryptoKey, sealed: string, ref: FieldRef): Promise<string> {
  try {
    return fromUtf8.decode(await open(vaultKey, sealed, fieldAad(ref)))
  } catch {
    throw new DecryptError()
  }
}

/* ---------- Password generator ---------- */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+?'

/** A random password with no ambiguous characters (0/O, 1/l/I). Unbiased via rejection sampling. */
export function generatePassword(length = 20): string {
  const out: string[] = []
  const limit = 256 - (256 % ALPHABET.length)
  while (out.length < length) {
    for (const b of randomBytes(length * 2)) {
      if (b < limit && out.length < length) out.push(ALPHABET[b % ALPHABET.length])
    }
  }
  return out.join('')
}
