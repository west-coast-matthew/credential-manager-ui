import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Account, Group } from '../types'
import { subtreeIds } from '../lib/groups'
import { Eyebrow, Icon } from './ui'

export type Selection = { kind: 'all' } | { kind: 'ungrouped' } | { kind: 'group'; id: string }

interface Props {
  groups: Group[]
  accounts: Account[]
  selection: Selection
  onSelect: (s: Selection) => void
  onCreate: (name: string, parentId: string | null) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  /** Open the Add account dialog with this group preselected. */
  onAddAccount: (groupId: string) => void
  /** Loading / saving / error text for group data, shown above the "New group" button. */
  status?: ReactNode
  /** Signed-in user and vault actions, pinned to the bottom. */
  footer?: ReactNode
}

/** Inline text field used for creating and renaming groups. */
function InlineInput({
  initial = '',
  placeholder,
  onSubmit,
  onCancel,
}: {
  initial?: string
  placeholder: string
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial)
  // Enter and blur both submit; make sure only the first one counts.
  const done = useRef(false)
  const finish = (fn: () => void) => {
    if (done.current) return
    done.current = true
    fn()
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    finish(() => (trimmed ? onSubmit(trimmed) : onCancel()))
  }
  return (
    <motion.form
      className="inline-input"
      onSubmit={submit}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <input
        autoFocus
        value={name}
        placeholder={placeholder}
        onChange={(e) => setName(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => e.key === 'Escape' && finish(onCancel)}
      />
    </motion.form>
  )
}

export function Sidebar({
  groups,
  accounts,
  selection,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onAddAccount,
  status,
  footer,
}: Props) {
  // Track collapsed rather than expanded nodes so groups that arrive later start open.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [adding, setAdding] = useState<string | 'root' | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)

  const countFor = (id: string) => {
    const ids = subtreeIds(groups, id)
    return accounts.filter((a) => a.groupId && ids.has(a.groupId)).length
  }
  const ungroupedCount = accounts.filter((a) => !a.groupId).length

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const remove = (c: Group) => {
    const subs = subtreeIds(groups, c.id).size - 1
    const msg =
      `Delete "${c.name}"` +
      (subs ? ` and ${subs} subgroup${subs === 1 ? '' : 's'}` : '') +
      `? Its accounts will move ${c.parentId ? 'to the parent group' : 'to Ungrouped'}.`
    if (!confirm(msg)) return
    if (selection.kind === 'group' && subtreeIds(groups, c.id).has(selection.id)) onSelect({ kind: 'all' })
    onDelete(c.id)
  }

  const renderNode = (c: Group, depth: number) => {
    const children = groups.filter((x) => x.parentId === c.id)
    const isOpen = !collapsed.has(c.id)
    const active = selection.kind === 'group' && selection.id === c.id
    return (
      <motion.li key={c.id} layout="position" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
        {renaming === c.id ? (
          <InlineInput
            initial={c.name}
            placeholder="Group name"
            onSubmit={(name) => {
              onRename(c.id, name)
              setRenaming(null)
            }}
            onCancel={() => setRenaming(null)}
          />
        ) : (
          <div className={`nav-item ${active ? 'is-active' : ''}`} style={{ paddingLeft: 10 + depth * 16 }}>
            <button
              type="button"
              className="nav-item__chevron"
              onClick={() => toggle(c.id)}
              aria-label={isOpen ? 'Collapse' : 'Expand'}
              style={{ visibility: children.length ? 'visible' : 'hidden' }}
            >
              <motion.span animate={{ rotate: isOpen ? 90 : 0 }} style={{ display: 'inline-flex' }}>
                <Icon name="chevron" size={14} />
              </motion.span>
            </button>
            <button type="button" className="nav-item__name" onClick={() => onSelect({ kind: 'group', id: c.id })}>
              {c.name}
            </button>
            <span className="nav-item__count mono">{countFor(c.id)}</span>
            <span className="nav-item__actions">
              <button type="button" title={`Add an account to ${c.name}`} aria-label={`Add an account to ${c.name}`} onClick={() => onAddAccount(c.id)}>
                <Icon name="key" size={14} />
              </button>
              <button
                type="button"
                title="Add subgroup"
                onClick={() => {
                  setAdding(c.id)
                  setCollapsed((p) => {
                    const next = new Set(p)
                    next.delete(c.id)
                    return next
                  })
                }}
              >
                <Icon name="plus" size={14} />
              </button>
              <button type="button" title="Rename" onClick={() => setRenaming(c.id)}>
                <Icon name="edit" size={14} />
              </button>
              <button type="button" title="Delete" onClick={() => remove(c)}>
                <Icon name="trash" size={14} />
              </button>
            </span>
            {active && <motion.span layoutId="nav-active" className="nav-item__indicator" />}
          </div>
        )}
        <AnimatePresence initial={false}>
          {isOpen && (children.length > 0 || adding === c.id) && (
            <motion.ul
              className="nav-tree"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <AnimatePresence initial={false}>{children.map((child) => renderNode(child, depth + 1))}</AnimatePresence>
              <AnimatePresence>
                {adding === c.id && (
                  <li style={{ paddingLeft: 10 + (depth + 1) * 16 }}>
                    <InlineInput
                      placeholder="Subgroup name"
                      onSubmit={(name) => {
                        onCreate(name, c.id)
                        setAdding(null)
                      }}
                      onCancel={() => setAdding(null)}
                    />
                  </li>
                )}
              </AnimatePresence>
            </motion.ul>
          )}
        </AnimatePresence>
      </motion.li>
    )
  }

  const fixedItem = (sel: Selection, label: string, count: number) => {
    const active = selection.kind === sel.kind
    return (
      <div className={`nav-item nav-item--fixed ${active ? 'is-active' : ''}`}>
        <button type="button" className="nav-item__name" onClick={() => onSelect(sel)}>
          {label}
        </button>
        <span className="nav-item__count mono">{count}</span>
        {active && <motion.span layoutId="nav-active" className="nav-item__indicator" />}
      </div>
    )
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand__mark" />
        <span className="brand__name">Credential Manager</span>
      </div>

      <nav>
        {fixedItem({ kind: 'all' }, 'All accounts', accounts.length)}
        {fixedItem({ kind: 'ungrouped' }, 'Ungrouped', ungroupedCount)}

        <div className="sidebar__section">
          <Eyebrow>Groups</Eyebrow>
        </div>
        <ul className="nav-tree">
          <AnimatePresence initial={false}>
            {groups.filter((c) => c.parentId === null).map((c) => renderNode(c, 0))}
          </AnimatePresence>
        </ul>
        <AnimatePresence>
          {adding === 'root' && (
            <InlineInput
              placeholder="Group name"
              onSubmit={(name) => {
                onCreate(name, null)
                setAdding(null)
              }}
              onCancel={() => setAdding(null)}
            />
          )}
        </AnimatePresence>
      </nav>

      {status}

      <button type="button" className="btn btn--dashed mono" onClick={() => setAdding('root')}>
        <Icon name="plus" size={14} /> New group
      </button>

      {footer}
    </aside>
  )
}
