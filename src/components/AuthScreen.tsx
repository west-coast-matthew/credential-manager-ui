import { useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { describeError } from '../services/contract'
import { useVault, VaultError } from '../vault/vault'
import { Button, Checkbox, TextField } from './form'
import { PasswordField } from './secrets'
import { ErrorStatePanel } from './ErrorStatePanel'
import { LoadingStatePanel } from './LoadingStatePanel'
import { Eyebrow, Icon } from './ui'

const messageFor = (error: unknown) => (error instanceof VaultError ? error.message : describeError(error))

/** Centered panel on the dotted backdrop, shared by every pre-dashboard screen. */
function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <div className="auth__brand">
        <span className="brand__mark" />
        <span className="brand__name">Credential Manager</span>
      </div>
      <motion.div
        className="auth__panel modal"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      >
        {children}
      </motion.div>
    </div>
  )
}

function Banner({ tone = 'error', children }: { tone?: 'error' | 'info'; children: ReactNode }) {
  return (
    <AnimatePresence>
      {children && (
        <motion.div
          className={`banner banner--${tone}`}
          role={tone === 'error' ? 'alert' : 'status'}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <div className="banner__inner">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function SignInScreen({ notice }: { notice?: string }) {
  const { signIn } = useVault()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({})

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const next = { username: username.trim() ? undefined : 'Enter your username.', password: password ? undefined : 'Enter your password.' }
    setFieldErrors(next)
    if (next.username || next.password) return
    setBusy(true)
    setError(undefined)
    try {
      await signIn(username.trim(), password, rememberMe)
    } catch (err) {
      setError(messageFor(err))
      setBusy(false)
    }
  }

  return (
    <AuthFrame>
      <form className="auth__form" onSubmit={submit} noValidate aria-busy={busy || undefined}>
        <header>
          <Eyebrow>Sign in</Eyebrow>
          <h2>Welcome back</h2>
        </header>
        <Banner tone="info">{!error && notice}</Banner>
        <Banner>{error}</Banner>
        <fieldset className="modal__fields" disabled={busy}>
          <TextField
            label="Username"
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={fieldErrors.username}
          />
          <PasswordField
            label="Password"
            autoComplete="current-password"
            generate={false}
            value={password}
            onChange={setPassword}
            error={fieldErrors.password}
          />
          <Checkbox label="Remember me for 30 days" checked={rememberMe} onChange={setRememberMe} />
        </fieldset>
        <Button type="submit" variant="primary" size="lg" block loading={busy} icon={<Icon name="arrow" size={15} />}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        <p className="auth__note">
          <Icon name="shield" size={14} /> Your password never leaves this browser. It unlocks a key that decrypts your vault here.
        </p>
      </form>
    </AuthFrame>
  )
}

export function UnlockScreen({ username, notice }: { username: string; notice?: string }) {
  const { unlock, signOut } = useVault()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!password) return setError('Enter your password.')
    setBusy(true)
    setError(undefined)
    try {
      await unlock(password)
    } catch (err) {
      setError(messageFor(err))
      setBusy(false)
    }
  }

  return (
    <AuthFrame>
      <form className="auth__form" onSubmit={submit} noValidate aria-busy={busy || undefined}>
        <header>
          <Eyebrow>Locked</Eyebrow>
          <h2>Unlock your vault</h2>
          <p className="auth__who">
            <Icon name="user" size={14} /> Signed in as <strong>{username}</strong>
          </p>
        </header>
        <Banner tone="info">{!error && notice}</Banner>
        <Banner>{error}</Banner>
        <fieldset className="modal__fields" disabled={busy}>
          <PasswordField label="Password" autoFocus autoComplete="current-password" generate={false} value={password} onChange={setPassword} />
        </fieldset>
        <Button type="submit" variant="primary" size="lg" block loading={busy} icon={<Icon name="lock" size={15} />}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </Button>
        <button type="button" className="link-btn auth__alt" onClick={() => void signOut()} disabled={busy}>
          Not you? Sign out
        </button>
      </form>
    </AuthFrame>
  )
}

export function CheckingScreen() {
  return (
    <AuthFrame>
      <LoadingStatePanel title="Checking your session…" />
    </AuthFrame>
  )
}

export function OfflineScreen({ error }: { error: unknown }) {
  const { recheck } = useVault()
  return (
    <AuthFrame>
      <ErrorStatePanel title="Can't reach the server" message={describeError(error)} onRetry={recheck} />
    </AuthFrame>
  )
}

export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const { changePassword } = useVault()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string>()
  const [fieldErrors, setFieldErrors] = useState<{ current?: string; next?: string; confirm?: string }>({})

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const errs = {
      current: current ? undefined : 'Enter your current password.',
      next: next.length >= 12 ? undefined : 'Use at least 12 characters. A few random words works well.',
      confirm: confirm === next ? undefined : "The passwords don't match.",
    }
    setFieldErrors(errs)
    if (errs.current || errs.next || errs.confirm) return
    setBusy(true)
    setError(undefined)
    try {
      await changePassword(current, next)
      setDone(true)
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <motion.form
        className="modal"
        role="dialog"
        aria-modal
        aria-labelledby="change-password-title"
        onSubmit={submit}
        noValidate
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      >
        <header className="modal__head">
          <div>
            <Eyebrow>Security</Eyebrow>
            <h2 id="change-password-title">Change password</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" disabled={busy}>
            <Icon name="close" />
          </button>
        </header>
        {done ? (
          <>
            <Banner tone="info">Password changed. Other browsers were signed out and will need the new password.</Banner>
            <footer className="modal__foot">
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </footer>
          </>
        ) : (
          <>
            <Banner>{error}</Banner>
            <p className="modal__text">
              There is no way to recover a forgotten password — your saved passwords can only be decrypted with it. Store the new
              one somewhere safe.
            </p>
            <fieldset className="modal__fields" disabled={busy}>
              <PasswordField label="Current password" autoFocus autoComplete="current-password" generate={false} value={current} onChange={setCurrent} error={fieldErrors.current} />
              <PasswordField label="New password" autoComplete="new-password" value={next} onChange={setNext} error={fieldErrors.next} />
              <PasswordField label="Confirm new password" autoComplete="new-password" generate={false} value={confirm} onChange={setConfirm} error={fieldErrors.confirm} />
            </fieldset>
            <footer className="modal__foot">
              <Button onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={busy} icon={<Icon name="check" size={14} />}>
                {busy ? 'Changing…' : 'Change password'}
              </Button>
            </footer>
          </>
        )}
      </motion.form>
    </motion.div>
  )
}
