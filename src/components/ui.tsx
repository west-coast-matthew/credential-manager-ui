import type { ReactNode } from 'react'
import { motion } from 'motion/react'

/** The "/ WHAT /" eyebrow label from the reference. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="eyebrow mono">
      <span>/</span> {children} <span>/</span>
    </div>
  )
}

/** Dashed annotation frame with orange corner nodes. */
export function Annotated({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`annotated ${className}`}>
      <i className="annotated__dot annotated__dot--tl" />
      <i className="annotated__dot annotated__dot--tr" />
      <i className="annotated__dot annotated__dot--bl" />
      <i className="annotated__dot annotated__dot--br" />
      {children}
    </div>
  )
}

/** Two-state switch styled after the Monthly / Yearly toggle. */
export function Toggle<T extends string>({
  left,
  right,
  value,
  onChange,
}: {
  left: { value: T; label: string }
  right: { value: T; label: string }
  value: T
  onChange: (v: T) => void
}) {
  const isRight = value === right.value
  return (
    <div className="toggle">
      <button type="button" className={`toggle__label ${!isRight ? 'is-active' : ''}`} onClick={() => onChange(left.value)}>
        {left.label}
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={isRight}
        aria-label={`Sort: ${isRight ? right.label : left.label}`}
        className="toggle__track"
        onClick={() => onChange(isRight ? left.value : right.value)}
        style={{ justifyContent: isRight ? 'flex-end' : 'flex-start' }}
      >
        <motion.span layout className="toggle__knob" transition={{ type: 'spring', stiffness: 700, damping: 32 }} />
      </button>
      <button type="button" className={`toggle__label ${isRight ? 'is-active' : ''}`} onClick={() => onChange(right.value)}>
        {right.label}
      </button>
    </div>
  )
}

const paths = {
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  chevron: 'M9 6l6 6-6 6',
  arrow: 'M7 17L17 7M8 7h9v9',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  folder: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  close: 'M6 6l12 12M18 6L6 18',
  spark: 'M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4',
  check: 'M5 12l5 5 9-10',
  alert: 'M12 3.5l9 16H3l9-16zM12 10v4.5M12 17.25v.01',
  link: 'M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1 1M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1-1',
  import: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 15v3a2 2 0 002 2h10a2 2 0 002-2v-3',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10.6 10.6 0 0112 5c6.4 0 10 7 10 7a17.6 17.6 0 01-3.2 4.2M6.6 6.6A17.4 17.4 0 002 12s3.6 7 10 7a9.9 9.9 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3',
  key: 'M14.5 4a5.5 5.5 0 11-4.9 8L4 17.6V20h2.4v-2h2v-2h2l1.2-1.2A5.5 5.5 0 0114.5 4zM16 8.5h.01',
  user: 'M12 4a4 4 0 100 8 4 4 0 000-8zM4.5 20a7.5 7.5 0 0115 0',
  users: 'M9 4a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM2.5 19.5a6.5 6.5 0 0113 0M16 4.3a3.5 3.5 0 010 6.4M18 13.5a6.5 6.5 0 013.5 6',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  logout: 'M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 16l-4-4 4-4M6 12h11',
  dice: 'M4 4h16v16H4zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3z',
}

export function Icon({ name, size = 16 }: { name: keyof typeof paths; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const units: [number, string][] = [
    [60, 'm'],
    [24, 'h'],
    [7, 'd'],
    [4.35, 'w'],
    [12, 'mo'],
    [Infinity, 'y'],
  ]
  let n = s / 60
  for (const [size, label] of units) {
    if (n < size) return `${Math.floor(n)}${label} ago`
    n /= size
  }
  return ''
}
