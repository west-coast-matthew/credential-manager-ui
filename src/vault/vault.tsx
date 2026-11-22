/**
 * The vault: who is signed in and whether the vault key is in memory.
 *
 *   checking   → asking the API whether the session cookie is still good
 *   signed-out → no session: show the sign-in screen
 *   locked     → session is good (e.g. "remember me" after a reload) but the vault key
 *                isn't in memory; the password is needed to unwrap it
 *   unlocked   → vault key in memory; the dashboard can decrypt
 *   offline    → couldn't reach the API to find out
 *
 * The vault key only ever lives in this component's state as a non-extractable
 * CryptoKey. Locking or signing out drops it and clears the query cache.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  createVaultKey,
  decryptField,
  DecryptError,
  deriveKeys,
  encryptField,
  newKdfParams,
  rewrapVaultKey,
  unwrapVaultKey,
  type FieldRef,
} from '../lib/crypto'
import { ApiError } from '../services/contract'
import { api, onUnauthorized } from '../services/http'
import type { SessionInfo } from '../types'

export type VaultState =
  | { status: 'checking' }
  | { status: 'offline'; error: unknown }
  | { status: 'signed-out'; notice?: string }
  | { status: 'locked'; session: SessionInfo; notice?: string }
  | { status: 'unlocked'; session: SessionInfo; key: CryptoKey }

interface Vault {
  state: VaultState
  signIn: (username: string, password: string, rememberMe: boolean) => Promise<void>
  unlock: (password: string) => Promise<void>
  lock: (notice?: string) => void
  signOut: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  encrypt: (plaintext: string, ref: FieldRef) => Promise<string>
  decrypt: (sealed: string, ref: FieldRef) => Promise<string>
  recheck: () => void
}

const VaultContext = createContext<Vault | null>(null)

export function useVault(): Vault {
  const vault = useContext(VaultContext)
  if (!vault) throw new Error('useVault must be used inside <VaultProvider>')
  return vault
}

/** The thrown message shown on the sign-in and unlock screens. */
export class VaultError extends Error {}

const AUTO_LOCK_MS = Math.max(0, Number(import.meta.env.VITE_AUTO_LOCK_MINUTES ?? 15) || 0) * 60_000

/** Turns a session into an unlocked vault: unwraps the vault key, or creates one on first sign-in. */
async function openVault(session: SessionInfo, wrapKey: CryptoKey): Promise<{ session: SessionInfo; key: CryptoKey }> {
  if (session.wrappedVaultKey) {
    try {
      return { session, key: await unwrapVaultKey(wrapKey, session.wrappedVaultKey, session.user.id) }
    } catch (error) {
      if (error instanceof DecryptError) throw new VaultError("That password doesn't unlock this vault.")
      throw error
    }
  }
  const { key, wrapped } = await createVaultKey(wrapKey, session.user.id)
  const updated = (await api.setVaultKey(wrapped)).data
  return { session: updated, key }
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [state, setState] = useState<VaultState>({ status: 'checking' })
  const stateRef = useRef(state)
  stateRef.current = state

  const check = useCallback(async () => {
    setState({ status: 'checking' })
    try {
      const { data } = await api.session()
      setState({ status: 'locked', session: data })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'UNAUTHORIZED') setState({ status: 'signed-out' })
      else setState({ status: 'offline', error })
    }
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  // A 401 from any call means the session is gone (expired, or signed out elsewhere).
  useEffect(() => {
    onUnauthorized(() => {
      if (stateRef.current.status === 'signed-out' || stateRef.current.status === 'checking') return
      qc.clear()
      setState({ status: 'signed-out', notice: 'Your session ended. Sign in again.' })
    })
  }, [qc])

  const signIn = useCallback(async (username: string, password: string, rememberMe: boolean) => {
    const { kdf } = (await api.prelogin(username)).data
    const { authKey, wrapKey } = await deriveKeys(password, kdf)
    const session = (await api.login({ username, authKey, rememberMe })).data
    setState({ status: 'unlocked', ...(await openVault(session, wrapKey)) })
  }, [])

  const unlock = useCallback(async (password: string) => {
    const current = stateRef.current
    if (current.status !== 'locked') return
    const { wrapKey } = await deriveKeys(password, current.session.kdf)
    setState({ status: 'unlocked', ...(await openVault(current.session, wrapKey)) })
  }, [])

  const lock = useCallback(
    (notice?: string) => {
      const current = stateRef.current
      if (current.status !== 'unlocked') return
      qc.clear()
      setState({ status: 'locked', session: current.session, notice })
    },
    [qc],
  )

  const signOut = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      qc.clear()
      setState({ status: 'signed-out' })
    }
  }, [qc])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const current = stateRef.current
    if (current.status !== 'unlocked') return
    const { session } = current
    const stored = session.wrappedVaultKey
    if (!stored) return
    const old = await deriveKeys(currentPassword, session.kdf)
    const kdf = newKdfParams(session.kdf)
    const next = await deriveKeys(newPassword, kdf)
    let wrappedVaultKey: string
    try {
      wrappedVaultKey = await rewrapVaultKey(old.wrapKey, next.wrapKey, stored, session.user.id)
    } catch (error) {
      if (error instanceof DecryptError) throw new VaultError("That isn't your current password.")
      throw error
    }
    const updated = (await api.changePassword({ currentAuthKey: old.authKey, newAuthKey: next.authKey, kdf, wrappedVaultKey })).data
    setState({ status: 'unlocked', session: updated, key: current.key })
  }, [])

  const keyOrThrow = () => {
    const current = stateRef.current
    if (current.status !== 'unlocked') throw new VaultError('The vault is locked.')
    return current.key
  }
  const encrypt = useCallback((plaintext: string, ref: FieldRef) => encryptField(keyOrThrow(), plaintext, ref), [])
  const decrypt = useCallback((sealed: string, ref: FieldRef) => decryptField(keyOrThrow(), sealed, ref), [])

  // Auto-lock after a stretch with no mouse or keyboard activity.
  const unlocked = state.status === 'unlocked'
  useEffect(() => {
    if (!unlocked || !AUTO_LOCK_MS) return
    let timer = window.setTimeout(() => lock('Locked after a period of inactivity.'), AUTO_LOCK_MS)
    let last = Date.now()
    const bump = () => {
      // Resetting a timer on every mousemove is wasteful; once a second is plenty.
      if (Date.now() - last < 1000) return
      last = Date.now()
      window.clearTimeout(timer)
      timer = window.setTimeout(() => lock('Locked after a period of inactivity.'), AUTO_LOCK_MS)
    }
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'] as const
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    return () => {
      window.clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, bump))
    }
  }, [unlocked, lock])

  const vault = useMemo<Vault>(
    () => ({ state, signIn, unlock, lock, signOut, changePassword, encrypt, decrypt, recheck: () => void check() }),
    [state, signIn, unlock, lock, signOut, changePassword, encrypt, decrypt, check],
  )
  return <VaultContext.Provider value={vault}>{children}</VaultContext.Provider>
}
