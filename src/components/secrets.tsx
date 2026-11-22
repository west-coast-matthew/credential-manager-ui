import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { generatePassword } from '../lib/crypto'
import { Field } from './form'
import { Icon } from './ui'

/** How long a revealed secret stays on screen before it hides itself again. */
const REVEAL_MS = 30_000
const MASK = '••••••••••••'

async function writeClipboard(text: string) {
  await navigator.clipboard.writeText(text)
}

/** Brief "Copied" confirmation state for a copy button. */
function useCopied() {
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null)
  const timer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const flash = (result: 'ok' | 'failed') => {
    setCopied(result)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(null), 1600)
  }
  return [copied, flash] as const
}

/** Copies a plain value (username, email) to the clipboard. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, flash] = useCopied()
  return (
    <button
      type="button"
      className={`secret__btn ${copied === 'ok' ? 'is-done' : ''}`}
      title={copied === 'ok' ? 'Copied' : copied === 'failed' ? "Couldn't copy" : `Copy ${label}`}
      aria-label={`Copy ${label}`}
      onClick={() => writeClipboard(value).then(() => flash('ok'), () => flash('failed'))}
    >
      <Icon name={copied === 'ok' ? 'check' : 'copy'} size={14} />
    </button>
  )
}

/**
 * An encrypted value, masked until asked for. `reveal` decrypts it; the plaintext is
 * kept only while shown, and hides itself again after 30 seconds.
 */
export function SecretValue({ label, reveal }: { label: string; reveal: () => Promise<string> }) {
  const [value, setValue] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [copied, flash] = useCopied()
  const hideTimer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(hideTimer.current), [])

  const show = async () => {
    try {
      setValue(await reveal())
      setError(false)
      window.clearTimeout(hideTimer.current)
      hideTimer.current = window.setTimeout(() => setValue(null), REVEAL_MS)
    } catch {
      setError(true)
    }
  }
  const hide = () => {
    window.clearTimeout(hideTimer.current)
    setValue(null)
  }
  const copy = async () => {
    try {
      await writeClipboard(value ?? (await reveal()))
      flash('ok')
    } catch {
      flash('failed')
    }
  }

  return (
    <span className="secret">
      <span className={`secret__value ${value === null ? 'is-masked' : ''} ${error ? 'is-error' : ''}`} title={error ? "Couldn't decrypt" : (value ?? undefined)}>
        {error ? "Can't decrypt" : (value ?? MASK)}
      </span>
      <button
        type="button"
        className="secret__btn"
        onClick={value === null ? show : hide}
        title={value === null ? `Show ${label}` : `Hide ${label}`}
        aria-label={value === null ? `Show ${label}` : `Hide ${label}`}
        aria-pressed={value !== null}
      >
        <Icon name={value === null ? 'eye' : 'eyeOff'} size={14} />
      </button>
      <button
        type="button"
        className={`secret__btn ${copied === 'ok' ? 'is-done' : ''}`}
        onClick={copy}
        title={copied === 'ok' ? 'Copied' : copied === 'failed' ? "Couldn't copy" : `Copy ${label}`}
        aria-label={`Copy ${label}`}
      >
        <Icon name={copied === 'ok' ? 'check' : 'copy'} size={14} />
      </button>
      <AnimatePresence>
        {copied && (
          <motion.span
            className={`secret__toast mono ${copied === 'failed' ? 'is-error' : ''}`}
            role="status"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {copied === 'ok' ? 'Copied' : "Couldn't copy"}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

/** One labelled line in a card's credential list. */
export function CredentialRow({ icon, label, children }: { icon: Parameters<typeof Icon>[0]['name']; label: string; children: ReactNode }) {
  return (
    <div className="cred">
      <dt className="cred__label mono">
        <Icon name={icon} size={13} /> {label}
      </dt>
      <dd className="cred__value">{children}</dd>
    </div>
  )
}

/** Plain value with a copy button. */
export function CopyableText({ value, label }: { value: string; label: string }) {
  return (
    <span className="secret">
      <span className="secret__value secret__value--plain" title={value}>
        {value}
      </span>
      <CopyButton value={value} label={label} />
    </span>
  )
}

/** Password input for the form: masked by default, with show/hide and a generator. */
export function PasswordField({
  label,
  optional,
  hint,
  error,
  value,
  onChange,
  generate = true,
  ...input
}: {
  label: ReactNode
  optional?: boolean
  hint?: ReactNode
  error?: ReactNode
  value: string
  onChange: (value: string) => void
  generate?: boolean
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <Field label={label} optional={optional} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <div className="control control--secret">
          <input
            id={id}
            type={visible ? 'text' : 'password'}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="new-password"
            spellCheck={false}
            {...input}
          />
          <span className="control__actions">
            {generate && (
              <button
                type="button"
                title="Generate a strong password"
                aria-label="Generate a strong password"
                onClick={() => {
                  onChange(generatePassword())
                  setVisible(true)
                }}
              >
                <Icon name="dice" size={15} />
              </button>
            )}
            <button
              type="button"
              title={visible ? 'Hide password' : 'Show password'}
              aria-label={visible ? 'Hide password' : 'Show password'}
              aria-pressed={visible}
              onClick={() => setVisible((v) => !v)}
            >
              <Icon name={visible ? 'eyeOff' : 'eye'} size={15} />
            </button>
          </span>
        </div>
      )}
    </Field>
  )
}
