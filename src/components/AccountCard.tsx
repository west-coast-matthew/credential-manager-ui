import { forwardRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { FieldRef } from '../lib/crypto'
import { AUTH_TYPE_LABELS, type Account, type SubAccount } from '../types'
import { CopyableText, CredentialRow, SecretValue } from './secrets'
import { Icon, hostOf, timeAgo } from './ui'

export type Reveal = (sealed: string, ref: FieldRef) => Promise<string>

interface Props {
  account: Account
  path: string[]
  reveal: Reveal
  onEdit: () => void
  onDelete: () => void
  /** Saving / error text for this card's requests. */
  status?: ReactNode
}

/** Username, email, password and hint lines shared by an account and its sub-accounts. */
export function Credentials({
  owner,
  kind,
  reveal,
}: {
  owner: Pick<Account | SubAccount, 'id' | 'username' | 'email' | 'password' | 'passwordHint'>
  kind: FieldRef['kind']
  reveal: Reveal
}) {
  const { id, username, email, password, passwordHint } = owner
  if (!username && !email && !password && !passwordHint) return null
  return (
    <dl className="creds">
      {username && (
        <CredentialRow icon="user" label="Username">
          <CopyableText value={username} label="username" />
        </CredentialRow>
      )}
      {email && (
        <CredentialRow icon="mail" label="Email">
          <CopyableText value={email} label="email" />
        </CredentialRow>
      )}
      {password && (
        <CredentialRow icon="key" label="Password">
          <SecretValue label="password" reveal={() => reveal(password, { kind, id, field: 'password' })} />
        </CredentialRow>
      )}
      {passwordHint && (
        <CredentialRow icon="spark" label="Hint">
          <SecretValue label="hint" reveal={() => reveal(passwordHint, { kind, id, field: 'passwordHint' })} />
        </CredentialRow>
      )}
    </dl>
  )
}

export function AuthChip({ account }: { account: Pick<Account, 'authType'> }) {
  if (account.authType === 'password') return null
  return (
    <span className="chip chip--auth" title={`Signs in with ${AUTH_TYPE_LABELS[account.authType]}`}>
      <Icon name="shield" size={12} /> {AUTH_TYPE_LABELS[account.authType]}
    </span>
  )
}

export function SubAccountList({ account, reveal }: { account: Account; reveal: Reveal }) {
  const [open, setOpen] = useState(false)
  const count = account.subAccounts.length
  if (!count) return null
  return (
    <div className="subs-view">
      <button type="button" className="subs-view__toggle mono" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <motion.span animate={{ rotate: open ? 90 : 0 }} style={{ display: 'inline-flex' }}>
          <Icon name="chevron" size={13} />
        </motion.span>
        <Icon name="users" size={14} />
        {count} sub-account{count === 1 ? '' : 's'}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            className="subs-view__list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {account.subAccounts.map((s) => (
              <li key={s.id} className="subs-view__item">
                <p className="subs-view__label">{s.label}</p>
                {s.notes && <p className="subs-view__notes">{s.notes}</p>}
                <Credentials owner={s} kind="sub" reveal={reveal} />
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

export const AccountCard = forwardRef<HTMLElement, Props>(function AccountCard({ account, path, reveal, onEdit, onDelete, status }, ref) {
  const updated = new Date(account.updatedAt)
  return (
    <motion.article
      ref={ref}
      layout
      className="card"
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
    >
      <div className="card__body">
        <header className="card__head">
          <h3 className="card__title">{account.title}</h3>
          <AuthChip account={account} />
          <span className="card__tools">
            <button type="button" title="Edit account" aria-label={`Edit ${account.title}`} onClick={onEdit}>
              <Icon name="edit" size={15} />
            </button>
            <button type="button" title="Delete account" aria-label={`Delete ${account.title}`} onClick={onDelete}>
              <Icon name="trash" size={15} />
            </button>
          </span>
        </header>
        {account.description && <p className="card__desc">{account.description}</p>}
        <Credentials owner={account} kind="account" reveal={reveal} />
        <SubAccountList account={account} reveal={reveal} />
        {status && <div className="card__status">{status}</div>}
      </div>

      {(account.url || path.length > 0) && (
        <>
          <div className="card__divider" />
          <div className="card__body card__body--tight">
            {account.url && (
              <a className="btn btn--ghost btn--block mono" href={account.url} target="_blank" rel="noreferrer noopener">
                Open site <Icon name="arrow" size={14} />
              </a>
            )}
            {path.length > 0 && (
              <div className="card__path">
                <Icon name="folder" size={14} />
                {path.join(' / ')}
              </div>
            )}
          </div>
        </>
      )}

      <footer className="card__foot">
        <span title={account.url ?? undefined}>
          <Icon name="globe" size={14} /> {account.url ? hostOf(account.url) : 'No web address'}
        </span>
        <time dateTime={account.updatedAt} title={`Updated ${updated.toLocaleString()}`}>
          <Icon name="clock" size={14} /> {timeAgo(account.updatedAt)}
        </time>
      </footer>
    </motion.article>
  )
})
