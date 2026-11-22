import { useCallback, useMemo, useState, type Ref } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { groupPath, subtreeIds } from './lib/groups'
import type { FieldRef } from './lib/crypto'
import type { Account, AccountDraft, AccountInput, AuthType, Group, SessionInfo } from './types'
import { describeError } from './services/contract'
import {
  useAccounts,
  useCreateAccount,
  useCreateGroup,
  useDeleteAccount,
  useDeleteGroup,
  useGroups,
  useUpdateAccount,
  useUpdateGroup,
} from './services/queries'
import { useVault } from './vault/vault'
import { Sidebar, type Selection } from './components/Sidebar'
import { AccountCard, type Reveal } from './components/AccountCard'
import { AccountRow } from './components/AccountRow'
import { AccountForm } from './components/AccountForm'
import { ChangePasswordDialog, CheckingScreen, OfflineScreen, SignInScreen, UnlockScreen } from './components/AuthScreen'
import { useViewPreferences, type ViewMode } from './stores/view-preferences'
import { StatusText } from './components/StatusText'
import { Eyebrow, Icon, Toggle } from './components/ui'

type Sort = 'recent' | 'name'
/** `groupId` preselects a group when the dialog is opened from the sidebar. */
type Editor = { mode: 'add'; groupId?: string } | { mode: 'edit'; draft: AccountDraft } | null

export default function App() {
  const { state } = useVault()
  switch (state.status) {
    case 'checking':
      return <CheckingScreen />
    case 'offline':
      return <OfflineScreen error={state.error} />
    case 'signed-out':
      return <SignInScreen notice={state.notice} />
    case 'locked':
      return <UnlockScreen username={state.session.user.username} notice={state.notice} />
    case 'unlocked':
      return <Dashboard session={state.session} />
  }
}

/** An account card or list row wired to its own delete request, so each one shows its own status. */
function ConnectedAccount({
  account,
  path,
  reveal,
  onEdit,
  view,
  ref,
}: {
  account: Account
  path: string[]
  reveal: Reveal
  onEdit: () => void
  view: ViewMode
  ref?: Ref<HTMLElement>
}) {
  const remove = useDeleteAccount()
  const status = remove.isPending ? (
    <StatusText>Deleting…</StatusText>
  ) : remove.isError ? (
    <StatusText tone="error" onDismiss={remove.reset}>
      Couldn't delete this account. {describeError(remove.error)}
    </StatusText>
  ) : null

  const Item = view === 'list' ? AccountRow : AccountCard
  return (
    <Item
      ref={ref}
      account={account}
      path={path}
      reveal={reveal}
      status={status}
      onEdit={onEdit}
      onDelete={() => !remove.isPending && confirm(`Delete "${account.title}"? This can't be undone.`) && remove.mutate(account.id)}
    />
  )
}

const matches = (a: Account, q: string) =>
  [a.title, a.url, a.description, a.username, a.email, ...a.subAccounts.flatMap((s) => [s.label, s.username, s.email, s.notes])].some(
    (s) => s?.toLowerCase().includes(q),
  )

function Dashboard({ session }: { session: SessionInfo }) {
  const vault = useVault()
  const groupsQuery = useGroups()
  const accountsQuery = useAccounts()
  const groups = useMemo<Group[]>(() => groupsQuery.data ?? [], [groupsQuery.data])
  const accounts = useMemo<Account[]>(() => accountsQuery.data ?? [], [accountsQuery.data])

  const createAccount = useCreateAccount()
  const editAccount = useUpdateAccount()
  const createGroup = useCreateGroup()
  const renameGroup = useUpdateGroup()
  const deleteGroup = useDeleteGroup()

  const [selection, setSelection] = useState<Selection>({ kind: 'all' })
  const [sort, setSort] = useState<Sort>('recent')
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<Editor>(null)
  const [openError, setOpenError] = useState<string>()
  const [encrypting, setEncrypting] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const viewMode = useViewPreferences((s) => s.viewMode)
  const setViewMode = useViewPreferences((s) => s.setViewMode)

  const reveal = useCallback<Reveal>((sealed, ref) => vault.decrypt(sealed, ref), [vault])

  /* ----- Editor: decrypt on open, encrypt on save ----- */

  const openAdd = (groupId?: string) => {
    createAccount.reset()
    setOpenError(undefined)
    setEditor({ mode: 'add', groupId })
  }

  const openEdit = async (account: Account) => {
    editAccount.reset()
    setOpenError(undefined)
    const plain = (sealed: string | null, ref: FieldRef) => (sealed ? vault.decrypt(sealed, ref) : Promise.resolve(null))
    try {
      const [password, passwordHint, subAccounts] = await Promise.all([
        plain(account.password, { kind: 'account', id: account.id, field: 'password' }),
        plain(account.passwordHint, { kind: 'account', id: account.id, field: 'passwordHint' }),
        Promise.all(
          account.subAccounts.map(async (s) => ({
            ...s,
            password: await plain(s.password, { kind: 'sub', id: s.id, field: 'password' }),
            passwordHint: await plain(s.passwordHint, { kind: 'sub', id: s.id, field: 'passwordHint' }),
          })),
        ),
      ])
      const { createdAt: _c, updatedAt: _u, ...rest } = account
      setEditor({ mode: 'edit', draft: { ...rest, password, passwordHint, subAccounts } })
    } catch (error) {
      setOpenError(`Couldn't open "${account.title}" for editing. ${describeError(error)}`)
    }
  }

  const closeEditor = useCallback(() => setEditor(null), [])

  const encryptDraft = async (draft: AccountDraft): Promise<AccountInput> => {
    const seal = (text: string | null, ref: FieldRef) => (text ? vault.encrypt(text, ref) : Promise.resolve(null))
    return {
      ...draft,
      password: await seal(draft.password, { kind: 'account', id: draft.id, field: 'password' }),
      passwordHint: await seal(draft.passwordHint, { kind: 'account', id: draft.id, field: 'passwordHint' }),
      subAccounts: await Promise.all(
        draft.subAccounts.map(async (s) => ({
          ...s,
          password: await seal(s.password, { kind: 'sub', id: s.id, field: 'password' }),
          passwordHint: await seal(s.passwordHint, { kind: 'sub', id: s.id, field: 'passwordHint' }),
        })),
      ),
    }
  }

  const saveAccount = async (draft: AccountDraft) => {
    setEncrypting(true)
    let input: AccountInput
    try {
      input = await encryptDraft(draft)
    } finally {
      setEncrypting(false)
    }
    if (editor?.mode === 'edit') {
      const { id, ...changes } = input
      editAccount.mutate({ id, input: changes }, { onSuccess: closeEditor })
    } else createAccount.mutate(input, { onSuccess: closeEditor })
  }
  const accountSave = editor?.mode === 'edit' ? editAccount : createAccount

  /** Addresses used before with this sign-in method, most used first. Normal logins offer every saved address. */
  const emailSuggestions = useCallback(
    (authType: AuthType) => {
      const counts = new Map<string, number>()
      const add = (email: string | null) => email && counts.set(email, (counts.get(email) ?? 0) + 1)
      for (const a of accounts) {
        if (authType === 'password' || a.authType === authType) add(a.email)
        if (authType === 'password') a.subAccounts.forEach((s) => add(s.email))
      }
      return [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([e]) => e)
    },
    [accounts],
  )

  /* ----- What's on screen ----- */

  const selectedGroup = selection.kind === 'group' ? groups.find((g) => g.id === selection.id) : undefined
  const selectedGroupId = selectedGroup?.id ?? null

  const visible = useMemo(() => {
    let list = accounts
    if (selection.kind === 'ungrouped') list = list.filter((a) => !a.groupId)
    if (selection.kind === 'group') {
      const ids = subtreeIds(groups, selection.id)
      list = list.filter((a) => a.groupId && ids.has(a.groupId))
    }
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((a) => matches(a, q))
    return [...list].sort((a, b) =>
      sort === 'name' ? a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) : b.updatedAt.localeCompare(a.updatedAt),
    )
  }, [accounts, groups, selection, query, sort])

  const heading =
    selection.kind === 'all' ? 'All accounts' : selection.kind === 'ungrouped' ? 'Ungrouped' : (selectedGroup?.name ?? '')
  const parentPath = selectedGroup ? groupPath(groups, selectedGroup.parentId) : []
  const subCount = visible.reduce((n, a) => n + a.subAccounts.length, 0)

  /* ----- Sidebar status: loading, then whichever group request is active or failed ----- */
  const groupMutations = [
    { m: createGroup, pending: `Adding “${createGroup.variables?.name ?? ''}”…`, failed: "Couldn't add the group." },
    { m: renameGroup, pending: 'Renaming…', failed: "Couldn't rename the group." },
    { m: deleteGroup, pending: 'Deleting group…', failed: "Couldn't delete the group." },
  ]
  const activeGroupMutation = groupMutations.find(({ m }) => m.isPending) ?? groupMutations.find(({ m }) => m.isError)
  const sidebarStatus = groupsQuery.isPending ? (
    <StatusText>Loading groups…</StatusText>
  ) : groupsQuery.isError ? (
    <StatusText tone="error" onRetry={() => groupsQuery.refetch()}>
      Couldn't load groups. {describeError(groupsQuery.error)}
    </StatusText>
  ) : activeGroupMutation?.m.isPending ? (
    <StatusText>{activeGroupMutation.pending}</StatusText>
  ) : activeGroupMutation ? (
    <StatusText tone="error" onDismiss={activeGroupMutation.m.reset}>
      {activeGroupMutation.failed} {describeError(activeGroupMutation.m.error)}
    </StatusText>
  ) : null

  const footer = (
    <div className="sidebar__user">
      <span className="sidebar__who" title={`Signed in as ${session.user.username}`}>
        <Icon name="user" size={14} /> {session.user.username}
      </span>
      <span className="sidebar__user-actions">
        <button type="button" title="Change password" aria-label="Change password" onClick={() => setChangingPassword(true)}>
          <Icon name="key" size={15} />
        </button>
        <button type="button" title="Lock vault" aria-label="Lock vault" onClick={() => vault.lock()}>
          <Icon name="lock" size={15} />
        </button>
        <button type="button" title="Sign out" aria-label="Sign out" onClick={() => void vault.signOut()}>
          <Icon name="logout" size={15} />
        </button>
      </span>
    </div>
  )

  return (
    <div className="app">
      <Sidebar
        groups={groups}
        accounts={accounts}
        selection={selection}
        onSelect={setSelection}
        onCreate={(name, parentId) => createGroup.mutate({ name, parentId })}
        onRename={(id, name) => renameGroup.mutate({ id, input: { name } })}
        onDelete={(id) => {
          if (selection.kind === 'group' && subtreeIds(groups, id).has(selection.id)) setSelection({ kind: 'all' })
          deleteGroup.mutate(id)
        }}
        onAddAccount={(groupId) => openAdd(groupId)}
        status={sidebarStatus}
        footer={footer}
      />

      <main className="main">
        <section className="hero">
          <div>
            <Eyebrow>{parentPath.length ? parentPath.join(' / ') : selection.kind === 'group' ? 'Group' : 'Vault'}</Eyebrow>
            <AnimatePresence mode="wait">
              <motion.h1
                key={heading}
                initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
                transition={{ duration: 0.28 }}
              >
                {heading}
              </motion.h1>
            </AnimatePresence>
            {accountsQuery.isSuccess && (
              <p className="hero__meta">
                <span className="hero__count">{visible.length}</span> account{visible.length === 1 ? '' : 's'}
                {subCount > 0 && (
                  <>
                    {' '}
                    · {subCount} sub-account{subCount === 1 ? '' : 's'}
                  </>
                )}
              </p>
            )}
          </div>
          <div className="hero__actions">
            <button type="button" className="btn btn--primary btn--lg mono" onClick={() => openAdd(selectedGroupId ?? undefined)}>
              <Icon name="plus" size={16} /> Add account
            </button>
          </div>
        </section>

        <div className="toolbar">
          <Toggle
            left={{ value: 'recent', label: 'Recent' }}
            right={{ value: 'name', label: 'A–Z' }}
            value={sort}
            onChange={setSort}
          />
          <div className="view-switch" role="radiogroup" aria-label="Layout">
            {(
              [
                ['cards', 'grid', 'Cards'],
                ['list', 'list', 'List'],
              ] as const
            ).map(([mode, icon, label]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={viewMode === mode}
                title={`Show as ${label.toLowerCase()}`}
                className={`view-switch__btn ${viewMode === mode ? 'is-active' : ''}`}
                onClick={() => setViewMode(mode)}
              >
                {viewMode === mode && <motion.span layoutId="view-switch" className="view-switch__thumb" />}
                <Icon name={icon} size={15} />
                <span className="sr-only">{label}</span>
              </button>
            ))}
          </div>
          <label className="search">
            <Icon name="search" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search accounts…" aria-label="Search accounts" />
          </label>
        </div>

        <div className="status-bar">
          {accountsQuery.isPending && <StatusText>Loading accounts…</StatusText>}
          {accountsQuery.isError && (
            <StatusText tone="error" onRetry={() => accountsQuery.refetch()}>
              Couldn't load accounts. {describeError(accountsQuery.error)}
            </StatusText>
          )}
          {accountsQuery.isRefetching && <StatusText>Refreshing accounts…</StatusText>}
          {openError && (
            <StatusText tone="error" onDismiss={() => setOpenError(undefined)}>
              {openError}
            </StatusText>
          )}
        </div>

        <motion.div layout className={viewMode === 'list' ? 'list' : 'grid'}>
          <AnimatePresence mode="popLayout">
            {visible.map((account) => (
              <ConnectedAccount
                key={account.id}
                view={viewMode}
                account={account}
                reveal={reveal}
                path={selection.kind === 'group' && account.groupId === selection.id ? [] : groupPath(groups, account.groupId)}
                onEdit={() => void openEdit(account)}
              />
            ))}
          </AnimatePresence>
        </motion.div>

        <AnimatePresence>
          {accountsQuery.isSuccess && visible.length === 0 && (
            <motion.div className="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Eyebrow>Empty</Eyebrow>
              <p>{query ? 'No accounts match your search.' : 'Nothing saved here yet.'}</p>
              {!query && (
                <button type="button" className="btn btn--ghost mono" onClick={() => openAdd(selectedGroupId ?? undefined)}>
                  Add the first account <Icon name="arrow" size={14} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {editor && (
          <AccountForm
            key="editor"
            groups={groups}
            initial={editor.mode === 'edit' ? editor.draft : undefined}
            defaultGroupId={editor.mode === 'add' ? (editor.groupId ?? selectedGroupId) : null}
            emailSuggestions={emailSuggestions}
            onClose={closeEditor}
            onSave={(draft) => void saveAccount(draft)}
            saving={encrypting || accountSave.isPending}
            serverError={accountSave.isError ? describeError(accountSave.error) : undefined}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{changingPassword && <ChangePasswordDialog key="password" onClose={() => setChangingPassword(false)} />}</AnimatePresence>
    </div>
  )
}
