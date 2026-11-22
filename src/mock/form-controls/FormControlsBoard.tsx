import { useCallback, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { AccountDraft, AuthType, Group } from '../../types'
import { Button, Checkbox, SelectField, TextArea, TextField } from '../../components/form'
import { AccountForm, groupOptions } from '../../components/AccountForm'
import { CopyableText, CredentialRow, PasswordField, SecretValue } from '../../components/secrets'
import { Annotated, Eyebrow, Icon, Toggle } from '../../components/ui'
import { TokenPanel } from './TokenPanel'

/* Sample groups; the artboard never calls the API. */
const at = '2026-11-01T15:00:00.000Z'
const GROUPS: Group[] = [
  { id: 'g-personal', name: 'Personal', parentId: null, createdAt: at, updatedAt: at },
  { id: 'g-banking', name: 'Banking', parentId: 'g-personal', createdAt: at, updatedAt: at },
  { id: 'g-shopping', name: 'Shopping', parentId: 'g-personal', createdAt: at, updatedAt: at },
  { id: 'g-work', name: 'Work', parentId: null, createdAt: at, updatedAt: at },
  { id: 'g-apps', name: 'Apps I built', parentId: 'g-work', createdAt: at, updatedAt: at },
]
const BANKING_ID = 'g-banking'
const APPS_ID = 'g-apps'
const OPTIONS = [{ value: '', label: 'Ungrouped' }, ...groupOptions(GROUPS)]
const SAMPLE_EMAILS: Record<AuthType, string[]> = {
  password: ['me@example.com', 'me.work@example.com'],
  google: ['me@gmail.example', 'me.alt@gmail.example'],
  microsoft: [],
  apple: [],
  github: [],
  other: [],
}
const emailSuggestions = (t: AuthType) => SAMPLE_EMAILS[t]
/** Stand-in for decryption: the artboard has no vault. */
const fakeReveal = (value: string) => () => new Promise<string>((r) => setTimeout(() => r(value), 120))

/** One specimen on the board, with its state written underneath. */
function Specimen({ caption, children, wide }: { caption: string; children: ReactNode; wide?: boolean }) {
  return (
    <figure className={`specimen ${wide ? 'specimen--wide' : ''}`}>
      <div className="specimen__body">{children}</div>
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

/** A control family: specimens on the left, a leader line out to the note on the right. */
function Plate({
  id,
  component,
  title,
  note,
  children,
}: {
  id: string
  component: string
  title: string
  note: ReactNode
  children: ReactNode
}) {
  return (
    <section className="plate" id={id} aria-labelledby={`${id}-title`}>
      <div className="plate__stage">{children}</div>
      <aside className="plate__note">
        <Eyebrow>{component}</Eyebrow>
        <h2 id={`${id}-title`}>{title}</h2>
        <div className="plate__copy">{note}</div>
      </aside>
    </section>
  )
}

function ButtonsPlate() {
  const variants = ['primary', 'ghost', 'dashed'] as const
  return (
    <Plate
      id="buttons"
      component="<Button>"
      title="Buttons"
      note={
        <>
          <p>Primary is for the single action that saves. Everything else is ghost; dashed is for “create something new” in lists.</p>
          <p>Saving replaces the icon with a spinner and blocks repeat clicks while the request is out.</p>
        </>
      }
    >
      <div className="specimen-grid specimen-grid--buttons">
        {variants.map((v) => (
          <div className="specimen-row" key={v}>
            <span className="specimen-row__name">{v[0].toUpperCase() + v.slice(1)}</span>
            <Specimen caption="Rest">
              <Button variant={v}>Save</Button>
            </Specimen>
            <Specimen caption="Hover">
              <Button variant={v} forceState="hover">
                Save
              </Button>
            </Specimen>
            <Specimen caption="Focus">
              <Button variant={v} forceState="focus">
                Save
              </Button>
            </Specimen>
            <Specimen caption="Disabled">
              <Button variant={v} disabled>
                Save
              </Button>
            </Specimen>
            <Specimen caption="Saving">
              <Button variant={v} loading>
                Saving…
              </Button>
            </Specimen>
          </div>
        ))}
        <div className="specimen-row">
          <span className="specimen-row__name">Large</span>
          <Specimen caption="With icon" wide>
            <Button variant="primary" size="lg" icon={<Icon name="plus" size={16} />}>
              Add account
            </Button>
          </Specimen>
          <Specimen caption="Link out" wide>
            <Button icon={null}>
              Open site <Icon name="arrow" size={14} />
            </Button>
          </Specimen>
        </div>
      </div>
    </Plate>
  )
}

function TextPlate() {
  const [value, setValue] = useState('bank.example.com/login')
  return (
    <Plate
      id="text"
      component="<TextField>"
      title="Text fields"
      note={
        <>
          <p>Focus swaps the border to a dashed accent line, borrowed from the annotation frames in the reference.</p>
          <p>Errors say what to type, not what went wrong. They sit directly under the field and are announced to screen readers.</p>
        </>
      }
    >
      <div className="specimen-grid specimen-grid--fields">
        <Specimen caption="Empty">
          <TextField label="Web address" placeholder="https://example.com/login" />
        </Specimen>
        <Specimen caption="Filled">
          <TextField label="Web address" value={value} onChange={(e) => setValue(e.target.value)} />
        </Specimen>
        <Specimen caption="Focus">
          <TextField label="Title" forceState="focus" defaultValue="Online banking" />
        </Specimen>
        <Specimen caption="Error">
          <TextField label="Web address" defaultValue="my bank" error="Enter a web address, like example.com/login" />
        </Specimen>
        <Specimen caption="Hint">
          <TextField label="Title" placeholder="What is this account for?" hint="Shown on the card and used by search." />
        </Specimen>
        <Specimen caption="Disabled">
          <TextField label="Web address" disabled defaultValue="github.com/login" />
        </Specimen>
        <Specimen caption="Search, with prefix" wide>
          <TextField label="Search" placeholder="Search accounts…" prefix={<Icon name="search" />} />
        </Specimen>
      </div>
    </Plate>
  )
}

function LongFormPlate() {
  const [cat, setCat] = useState(BANKING_ID)
  return (
    <Plate
      id="longform"
      component="<TextArea> · <SelectField>"
      title="Description and group"
      note={
        <p>
          The group list is the tree flattened in order, with subgroups indented under their parent, so an account can be
          filed at any depth.
        </p>
      }
    >
      <div className="specimen-grid specimen-grid--fields">
        <Specimen caption="Description, empty">
          <TextArea label="Description" optional placeholder="Notes, recovery details, what this account is for…" />
        </Specimen>
        <Specimen caption="Description, focus">
          <TextArea
            label="Description"
            optional
            forceState="focus"
            defaultValue="Joint account. Security questions are in the hint."
          />
        </Specimen>
        <Specimen caption="Group">
          <SelectField label="Group" value={cat} onChange={(e) => setCat(e.target.value)} options={OPTIONS} />
        </Specimen>
        <Specimen caption="Group, focus">
          <SelectField label="Group" forceState="focus" defaultValue={APPS_ID} options={OPTIONS} />
        </Specimen>
      </div>
    </Plate>
  )
}

function SecretsPlate() {
  const [password, setPassword] = useState('correct-horse-battery')
  return (
    <Plate
      id="secrets"
      component="<SecretValue> · <PasswordField>"
      title="Secrets"
      note={
        <>
          <p>Saved passwords and hints stay masked until you ask. Showing one decrypts it in the browser; it hides itself again after 30 seconds.</p>
          <p>Copy works without showing the value. In the form, the dice generate a strong random password.</p>
        </>
      }
    >
      <div className="rating-stage">
        <Annotated className="rating-stage__hero">
          <dl className="creds">
            <CredentialRow icon="user" label="Username">
              <CopyableText value="jefe" label="username" />
            </CredentialRow>
            <CredentialRow icon="key" label="Password">
              <SecretValue label="password" reveal={fakeReveal('correct-horse-battery')} />
            </CredentialRow>
          </dl>
        </Annotated>
      </div>
      <div className="specimen-grid specimen-grid--fields">
        <Specimen caption="Password, masked">
          <SecretValue label="password" reveal={fakeReveal('hunter2-but-longer')} />
        </Specimen>
        <Specimen caption="Hint, masked">
          <SecretValue label="hint" reveal={fakeReveal('first car + year')} />
        </Specimen>
        <Specimen caption="Can't decrypt">
          <SecretValue label="password" reveal={() => Promise.reject(new Error('DecryptError'))} />
        </Specimen>
        <Specimen caption="Email, copyable">
          <CopyableText value="me@gmail.example" label="email" />
        </Specimen>
        <Specimen caption="Password field" wide>
          <PasswordField label="Password" value={password} onChange={setPassword} />
        </Specimen>
        <Specimen caption="Password field, error" wide>
          <PasswordField label="Password" value="" onChange={() => {}} error="Enter your password." generate={false} />
        </Specimen>
      </div>
    </Plate>
  )
}

function ChoicePlate() {
  const [sort, setSort] = useState<'recent' | 'name'>('recent')
  const [a, setA] = useState(true)
  const [b, setB] = useState(false)
  return (
    <Plate
      id="choices"
      component="<Toggle> · <Checkbox>"
      title="Toggles and checkboxes"
      note={
        <p>
          The toggle is for a choice between two views of the same list. Checkboxes are for independent on/off settings;
          the check draws in so the change is visible.
        </p>
      }
    >
      <div className="specimen-grid specimen-grid--fields">
        <Specimen caption="Sort toggle" wide>
          <Toggle
            left={{ value: 'recent', label: 'Recent' }}
            right={{ value: 'name', label: 'A–Z' }}
            value={sort}
            onChange={setSort}
          />
        </Specimen>
        <Specimen caption="Checked">
          <Checkbox label="Remember me for 30 days" checked={a} onChange={setA} />
        </Specimen>
        <Specimen caption="Unchecked">
          <Checkbox label="Remember me for 30 days" checked={b} onChange={setB} />
        </Specimen>
        <Specimen caption="Focus">
          <Checkbox label="Remember me for 30 days" checked={false} forceState="focus" />
        </Specimen>
        <Specimen caption="Disabled">
          <Checkbox label="Remember me for 30 days" checked={false} disabled />
        </Specimen>
        <Specimen caption="Chip">
          <span className="chip chip--auth">
            <Icon name="shield" size={12} /> Google
          </span>
        </Specimen>
      </div>
    </Plate>
  )
}

type Outcome = { kind: 'saved'; at: string } | null

/** What the request body looks like on the wire: secrets are ciphertext, never plaintext. */
const sealed = (v: string | null) => (v ? 'v1.<iv>.<AES-256-GCM ciphertext>' : null)
const sealedPreview = (d: AccountDraft) => ({
  ...d,
  password: sealed(d.password),
  passwordHint: sealed(d.passwordHint),
  subAccounts: d.subAccounts.map((s) => ({ ...s, password: sealed(s.password), passwordHint: sealed(s.passwordHint) })),
})

function ComposedPlate() {
  const [draft, setDraft] = useState<AccountDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string>()
  const [failNext, setFailNext] = useState(false)
  const [slow, setSlow] = useState(true)
  const [outcome, setOutcome] = useState<Outcome>(null)
  const [formKey, setFormKey] = useState(0)
  const timer = useRef<number>(undefined)

  const onDraftChange = useCallback((d: AccountDraft) => setDraft(d), [])

  // Stand-in for the REST call: no request is made; this only plays out the states.
  const save = () => {
    setServerError(undefined)
    setOutcome(null)
    setSaving(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(
      () => {
        setSaving(false)
        if (failNext) setServerError('The server is unavailable right now. Try again in a moment.')
        else setOutcome({ kind: 'saved', at: new Date().toLocaleTimeString() })
      },
      slow ? 1400 : 250,
    )
  }

  const reset = () => {
    window.clearTimeout(timer.current)
    setSaving(false)
    setServerError(undefined)
    setOutcome(null)
    setFormKey((k) => k + 1)
  }

  return (
    <Plate
      id="composed"
      component="<AccountForm>"
      title="Add an account, end to end"
      note={
        <>
          <p>The real form, built from the controls above. Save it to walk through the request states.</p>
          <p>
            The panel beside it shows the body the form would send. In the app, password and hint values are replaced by
            AES-256-GCM ciphertext before the request leaves the browser.
          </p>
          <div className="plate__switches">
            <Checkbox label="Slow network" checked={slow} onChange={setSlow} />
            <Checkbox label="Server rejects the save" checked={failNext} onChange={setFailNext} />
          </div>
        </>
      }
    >
      <div className="composed">
        <AccountForm
          key={formKey}
          inline
          groups={GROUPS}
          defaultGroupId={BANKING_ID}
          emailSuggestions={emailSuggestions}
          initial={undefined}
          onSave={save}
          onClose={reset}
          saving={saving}
          serverError={serverError}
          onDraftChange={onDraftChange}
        />
        <div className="request">
          <div className="request__line">
            <span className="request__method">POST</span>
            <code>/api/accounts</code>
            <span className={`request__status ${saving ? 'is-pending' : serverError ? 'is-error' : outcome ? 'is-ok' : ''}`}>
              {saving ? 'Pending' : serverError ? '503 Unavailable' : outcome ? '201 Created' : 'Not sent'}
            </span>
          </div>
          <pre className="request__body">{draft ? JSON.stringify(sealedPreview(draft), null, 2) : '{}'}</pre>
          <AnimatePresence>
            {outcome && (
              <motion.p className="request__note" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                Saved at {outcome.at}. In the app the dialog would close and the card would appear at the top of the list.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Plate>
  )
}

const SECTIONS = [
  ['buttons', 'Buttons'],
  ['text', 'Text fields'],
  ['longform', 'Description and group'],
  ['secrets', 'Secrets'],
  ['choices', 'Toggles and checkboxes'],
  ['composed', 'Add an account'],
] as const

export function FormControlsBoard() {
  return (
    <div className="artboard">
      <div className="artboard__main">
        <header className="artboard__head">
          <a className="artboard__back" href="/">
            Back to the app
          </a>
          <h1>Form controls</h1>
          <p>
            Every control used to add and edit accounts, in each of its states. Adjust the tokens in Tweaks to try a new look
            here; when you like it, Copy CSS gives you the values to paste into <code>src/styles.css</code> so the app picks
            them up.
          </p>
          <nav className="artboard__toc" aria-label="Sections">
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </nav>
        </header>

        <ButtonsPlate />
        <TextPlate />
        <LongFormPlate />
        <SecretsPlate />
        <ChoicePlate />
        <ComposedPlate />
      </div>
      <TokenPanel />
    </div>
  )
}
