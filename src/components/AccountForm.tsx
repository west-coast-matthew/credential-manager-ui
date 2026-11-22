import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AUTH_TYPE_LABELS, AUTH_TYPES, type AccountDraft, type AuthType, type Group, type SubAccountDraft } from '../types'
import { Eyebrow, Icon } from './ui'
import { Button, SelectField, TextArea, TextField, type SelectOption } from './form'
import { PasswordField } from './secrets'

interface Props {
  groups: Group[]
  /** Existing account (already decrypted) when editing; undefined when adding. */
  initial?: AccountDraft
  defaultGroupId: string | null
  /** Emails used before with this sign-in method, for the email drop-down. */
  emailSuggestions: (authType: AuthType) => string[]
  onSave: (draft: AccountDraft) => void
  onClose: () => void
  /** Render in place (artboard) instead of as a modal dialog. */
  inline?: boolean
  saving?: boolean
  serverError?: string
  onDraftChange?: (draft: AccountDraft) => void
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NEW_EMAIL = '__new__'

export function normaliseUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.hostname.includes('.') || u.hostname === 'localhost' ? u.toString() : null
  } catch {
    return null
  }
}

/** Groups flattened depth-first, for an indented <select>. */
export function groupOptions(groups: Group[], parentId: string | null = null, depth = 0): SelectOption[] {
  return groups
    .filter((g) => g.parentId === parentId)
    .flatMap((g) => [{ value: g.id, label: g.name, depth }, ...groupOptions(groups, g.id, depth + 1)])
}

export const emptyAccountDraft = (groupId: string | null): AccountDraft => ({
  id: crypto.randomUUID(),
  groupId,
  title: '',
  description: null,
  authType: 'password',
  url: null,
  username: null,
  email: null,
  password: null,
  passwordHint: null,
  subAccounts: [],
})

const emptySub = (): SubAccountDraft => ({
  id: crypto.randomUUID(),
  label: '',
  username: null,
  email: null,
  password: null,
  passwordHint: null,
  notes: null,
})

const orNull = (s: string | null | undefined) => (s?.trim() ? s.trim() : null)

/**
 * Email input with the addresses used before for the same sign-in method in a drop-down,
 * plus "Another address…" to type a new one.
 */
export function EmailField({
  value,
  onChange,
  suggestions,
  error,
  label = 'Email',
}: {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  error?: string
  label?: string
}) {
  const known = suggestions.includes(value.trim().toLowerCase())
  const [typing, setTyping] = useState(() => suggestions.length === 0 || (!!value && !known))

  if (typing || suggestions.length === 0) {
    return (
      <TextField
        label={label}
        optional
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="name@example.com"
        error={error}
        autoComplete="off"
        hint={
          suggestions.length > 0 && !error ? (
            <button type="button" className="link-btn" onClick={() => (setTyping(false), onChange(suggestions[0]))}>
              Choose a saved address
            </button>
          ) : undefined
        }
      />
    )
  }
  return (
    <SelectField
      label={label}
      optional
      value={known ? value.trim().toLowerCase() : ''}
      error={error}
      onChange={(e) => {
        if (e.target.value === NEW_EMAIL) {
          setTyping(true)
          onChange('')
        } else onChange(e.target.value)
      }}
      options={[
        { value: '', label: 'No email' },
        ...suggestions.map((s) => ({ value: s, label: s })),
        { value: NEW_EMAIL, label: 'Another address…' },
      ]}
    />
  )
}

type Errors = { title?: string; url?: string; email?: string; subs?: Record<string, { label?: string; email?: string }> }

export function AccountForm({
  groups,
  initial,
  defaultGroupId,
  emailSuggestions,
  onSave,
  onClose,
  inline,
  saving,
  serverError,
  onDraftChange,
}: Props) {
  const [draft, setDraft] = useState<AccountDraft>(() => initial ?? emptyAccountDraft(defaultGroupId))
  const [errors, setErrors] = useState<Errors>({})
  const set = <K extends keyof AccountDraft>(key: K, value: AccountDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const setSub = (id: string, patch: Partial<SubAccountDraft>) =>
    setDraft((d) => ({ ...d, subAccounts: d.subAccounts.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))

  const isSso = draft.authType !== 'password'
  const suggestions = useMemo(() => emailSuggestions(draft.authType), [emailSuggestions, draft.authType])
  const subSuggestions = useMemo(() => emailSuggestions('password'), [emailSuggestions])

  /** What would be saved right now: trimmed, empty → null. */
  const cleaned = useMemo<AccountDraft>(
    () => ({
      ...draft,
      title: draft.title.trim(),
      description: orNull(draft.description),
      url: draft.url?.trim() ? (normaliseUrl(draft.url) ?? draft.url.trim()) : null,
      username: orNull(draft.username),
      email: orNull(draft.email)?.toLowerCase() ?? null,
      password: draft.password ? draft.password : null,
      passwordHint: orNull(draft.passwordHint),
      subAccounts: draft.subAccounts.map((s) => ({
        ...s,
        label: s.label.trim(),
        username: orNull(s.username),
        email: orNull(s.email)?.toLowerCase() ?? null,
        password: s.password ? s.password : null,
        passwordHint: orNull(s.passwordHint),
        notes: orNull(s.notes),
      })),
    }),
    [draft],
  )

  useEffect(() => {
    onDraftChange?.(cleaned)
  }, [cleaned, onDraftChange])

  useEffect(() => {
    if (inline) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inline, onClose])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    const next: Errors = {}
    if (!cleaned.title) next.title = 'Add a title so you can find this account later'
    if (cleaned.url && !normaliseUrl(cleaned.url)) next.url = 'Enter a web address, like example.com/login'
    if (cleaned.email && !EMAIL.test(cleaned.email)) next.email = 'Enter an email address, like name@example.com'
    for (const s of cleaned.subAccounts) {
      const sub: { label?: string; email?: string } = {}
      if (!s.label) sub.label = 'Give it a label, like "Admin test user"'
      if (s.email && !EMAIL.test(s.email)) sub.email = 'Enter an email address, like name@example.com'
      if (sub.label || sub.email) (next.subs ??= {})[s.id] = sub
    }
    setErrors(next)
    if (next.title || next.url || next.email || next.subs) return
    onSave(cleaned)
  }

  const form = (
    <motion.form
      className={`modal modal--wide ${inline ? 'modal--inline' : ''}`}
      onSubmit={submit}
      role={inline ? undefined : 'dialog'}
      aria-modal={inline ? undefined : true}
      aria-labelledby="account-form-title"
      aria-busy={saving || undefined}
      initial={inline ? false : { opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      noValidate
      autoComplete="off"
    >
      <header className="modal__head">
        <div>
          <Eyebrow>{initial ? 'Edit' : 'New'}</Eyebrow>
          <h2 id="account-form-title">{initial ? 'Edit account' : 'Add an account'}</h2>
        </div>
        {!inline && (
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        )}
      </header>

      <AnimatePresence>
        {serverError && (
          <motion.div
            className="banner banner--error"
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="banner__inner">{serverError}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <fieldset className="modal__fields" disabled={saving}>
        <TextField
          label="Title"
          autoFocus={!inline}
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="What is this account for?"
          error={errors.title}
        />
        <TextField
          label="Web address"
          optional
          value={draft.url ?? ''}
          onChange={(e) => set('url', e.target.value)}
          placeholder="https://example.com/login"
          error={errors.url}
        />
        <div className="field-row field-row--even">
          <SelectField
            label="Sign-in method"
            value={draft.authType}
            onChange={(e) => set('authType', e.target.value as AuthType)}
            options={AUTH_TYPES.map((t) => ({ value: t, label: AUTH_TYPE_LABELS[t] }))}
            hint={isSso ? `You sign in with your ${AUTH_TYPE_LABELS[draft.authType]} account.` : undefined}
          />
          <SelectField
            label="Group"
            value={draft.groupId ?? ''}
            onChange={(e) => set('groupId', e.target.value || null)}
            options={[{ value: '', label: 'Ungrouped' }, ...groupOptions(groups)]}
          />
        </div>
        <div className="field-row field-row--even">
          <EmailField
            key={draft.authType}
            label={isSso ? `${AUTH_TYPE_LABELS[draft.authType]} account` : 'Email'}
            value={draft.email ?? ''}
            onChange={(v) => set('email', v)}
            suggestions={suggestions}
            error={errors.email}
          />
          <TextField
            label="Username"
            optional
            value={draft.username ?? ''}
            onChange={(e) => set('username', e.target.value)}
            placeholder={isSso ? 'Usually not needed' : 'Your login name'}
            autoComplete="off"
          />
        </div>
        <div className="field-row field-row--even">
          <PasswordField
            label="Password"
            optional
            value={draft.password ?? ''}
            onChange={(v) => set('password', v)}
            placeholder={isSso ? 'Not needed for this sign-in method' : 'Encrypted before it leaves this browser'}
          />
          <TextField
            label="Password hint"
            optional
            value={draft.passwordHint ?? ''}
            onChange={(e) => set('passwordHint', e.target.value)}
            placeholder="Something only you would understand"
            autoComplete="off"
          />
        </div>
        <TextArea
          label="Description"
          optional
          value={draft.description ?? ''}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Notes, recovery details, what this account is for…"
        />

        <section className="subs" aria-label="Sub-accounts">
          <div className="subs__head">
            <Eyebrow>Sub-accounts</Eyebrow>
            <span className="subs__hint">Other logins for the same site, like test users.</span>
          </div>
          <AnimatePresence initial={false}>
            {draft.subAccounts.map((s, i) => (
              <motion.div
                key={s.id}
                className="sub"
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="sub__inner">
                  <div className="sub__head">
                    <span className="sub__index mono">{String(i + 1).padStart(2, '0')}</span>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Remove sub-account"
                      aria-label={`Remove sub-account ${s.label || i + 1}`}
                      onClick={() => setDraft((d) => ({ ...d, subAccounts: d.subAccounts.filter((x) => x.id !== s.id) }))}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                  <TextField
                    label="Label"
                    value={s.label}
                    onChange={(e) => setSub(s.id, { label: e.target.value })}
                    placeholder="Admin test user"
                    error={errors.subs?.[s.id]?.label}
                  />
                  <div className="field-row field-row--even">
                    <TextField
                      label="Username"
                      optional
                      value={s.username ?? ''}
                      onChange={(e) => setSub(s.id, { username: e.target.value })}
                      autoComplete="off"
                    />
                    <EmailField
                      value={s.email ?? ''}
                      onChange={(v) => setSub(s.id, { email: v })}
                      suggestions={subSuggestions}
                      error={errors.subs?.[s.id]?.email}
                    />
                  </div>
                  <div className="field-row field-row--even">
                    <PasswordField
                      label="Password"
                      optional
                      value={s.password ?? ''}
                      onChange={(v) => setSub(s.id, { password: v })}
                    />
                    <TextField
                      label="Password hint"
                      optional
                      value={s.passwordHint ?? ''}
                      onChange={(e) => setSub(s.id, { passwordHint: e.target.value })}
                      autoComplete="off"
                    />
                  </div>
                  <TextField
                    label="Notes"
                    optional
                    value={s.notes ?? ''}
                    onChange={(e) => setSub(s.id, { notes: e.target.value })}
                    placeholder="Role, permissions, what it's for…"
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <button
            type="button"
            className="btn btn--dashed mono"
            onClick={() => setDraft((d) => ({ ...d, subAccounts: [...d.subAccounts, emptySub()] }))}
          >
            <Icon name="plus" size={14} /> Add sub-account
          </button>
        </section>
      </fieldset>

      <footer className="modal__foot">
        <span className="modal__note">
          <Icon name="shield" size={14} /> Passwords and hints are encrypted in this browser.
        </span>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving} icon={<Icon name="check" size={14} />}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Save account'}
        </Button>
      </footer>
    </motion.form>
  )

  if (inline) return form

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      {form}
    </motion.div>
  )
}
