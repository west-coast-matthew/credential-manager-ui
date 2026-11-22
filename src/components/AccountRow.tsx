import { forwardRef, type ReactNode } from 'react'
import { motion } from 'motion/react'
import type { Account } from '../types'
import { AuthChip, SubAccountList, type Reveal } from './AccountCard'
import { CopyButton, SecretValue } from './secrets'
import { Icon, hostOf, timeAgo } from './ui'

interface Props {
  account: Account
  path: string[]
  reveal: Reveal
  onEdit: () => void
  onDelete: () => void
  status?: ReactNode
}

/** An account as one compact row, for list mode. Same data and actions as AccountCard. */
export const AccountRow = forwardRef<HTMLElement, Props>(function AccountRow({ account, path, reveal, onEdit, onDelete, status }, ref) {
  const updated = new Date(account.updatedAt)
  const login = account.username ?? account.email
  return (
    <motion.article
      ref={ref}
      layout
      className="row row--account"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
    >
      <div className="row__main">
        {account.url ? (
          <a className="row__title" href={account.url} target="_blank" rel="noreferrer noopener" title={account.url}>
            {account.title}
            <Icon name="arrow" size={13} />
          </a>
        ) : (
          <span className="row__title">{account.title}</span>
        )}
        <span className="row__meta">
          {account.url && <span className="row__host">{hostOf(account.url)}</span>}
          <AuthChip account={account} />
          {account.description && <span className="row__desc">{account.description}</span>}
        </span>
      </div>

      <span className="row__login" title={login ?? undefined}>
        {login && (
          <>
            <span className="row__login-text">{login}</span>
            <CopyButton value={login} label={account.username ? 'username' : 'email'} />
          </>
        )}
      </span>

      <span className="row__secret">
        {account.password && (
          <SecretValue label="password" reveal={() => reveal(account.password!, { kind: 'account', id: account.id, field: 'password' })} />
        )}
      </span>

      <span className="row__path" title={path.length ? path.join(' / ') : undefined}>
        {path.length > 0 && (
          <>
            <Icon name="folder" size={13} />
            {path.join(' / ')}
          </>
        )}
      </span>

      <time className="row__time" dateTime={account.updatedAt} title={`Updated ${updated.toLocaleString()}`}>
        {timeAgo(account.updatedAt)}
      </time>

      <span className="row__tools">
        <button type="button" title="Edit account" aria-label={`Edit ${account.title}`} onClick={onEdit}>
          <Icon name="edit" size={15} />
        </button>
        <button type="button" title="Delete account" aria-label={`Delete ${account.title}`} onClick={onDelete}>
          <Icon name="trash" size={15} />
        </button>
      </span>

      {account.subAccounts.length > 0 && (
        <div className="row__subs">
          <SubAccountList account={account} reveal={reveal} />
        </div>
      )}
      {status && <div className="row__status">{status}</div>}
    </motion.article>
  )
})
