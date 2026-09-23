/**
 * Brush-drawn line icons in the ink style. All decorative (aria-hidden); the text beside them carries meaning.
 */
const base = {
  viewBox: '0 0 64 64',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  focusable: false,
  filter: 'url(#ink-bleed)',
}

/** Issue: coins go into the office's strongbox. */
export function IconIssue({ className = 'size-14' }: { className?: string }) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <path d="M12 30 h40 v22 h-40 z" />
      <path d="M12 30 l6 -8 h28 l6 8" />
      <path d="M30 40 h4" />
      <circle cx="26" cy="12" r="5" />
      <circle cx="38" cy="16" r="5" />
      <path d="M26 12 h0.1 M38 16 h0.1" />
    </svg>
  )
}

/** Seal: a note stamped with the seal. */
export function IconSeal({ className = 'size-14' }: { className?: string }) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <path d="M10 14 h30 v38 h-30 z" />
      <path d="M16 24 h18 M16 31 h18 M16 38 h10" />
      <rect x="34" y="34" width="20" height="20" rx="2" stroke="var(--seal)" transform="rotate(-8 44 44)" />
      <path d="M40 40 l8 8 M48 40 l-8 8" stroke="var(--seal)" strokeWidth="1.8" />
    </svg>
  )
}

/** Serve: the seller hands over a bowl of tea. */
export function IconServe({ className = 'size-14' }: { className?: string }) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <path d="M12 32 h40 c0 12 -8 20 -20 20 s-20 -8 -20 -20 z" />
      <path d="M22 56 h20" />
      <path d="M24 24 c-3 -4 3 -6 0 -10 M32 24 c-3 -4 3 -6 0 -10 M40 24 c-3 -4 3 -6 0 -10" />
    </svg>
  )
}

/** Redeem: the two halves of the tally meet. */
export function IconRedeem({ className = 'size-14' }: { className?: string }) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <path d="M8 16 h22 l-3 6 l3 6 l-3 6 l3 6 l-3 6 l3 6 h-22 z" />
      <path d="M56 16 h-20 l-3 6 l3 6 l-3 6 l3 6 l-3 6 l3 6 h20 z" />
      <rect x="26" y="26" width="12" height="12" stroke="var(--seal)" transform="rotate(-6 32 32)" />
    </svg>
  )
}

export function IconTea({ className = 'size-12' }: { className?: string }) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <path d="M14 26 h30 v10 c0 9 -7 16 -15 16 s-15 -7 -15 -16 z" />
      <path d="M44 30 c8 0 8 12 0 12" />
      <path d="M22 18 c-2 -3 2 -5 0 -8 M30 18 c-2 -3 2 -5 0 -8" />
    </svg>
  )
}

export function IconBowl({ className = 'size-12' }: { className?: string }) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <path d="M10 30 h44 c0 12 -10 20 -22 20 s-22 -8 -22 -20 z" />
      <path d="M22 30 c2 -6 8 -8 12 -6 c4 -4 10 -2 12 6" />
      <path d="M40 8 l-8 20 M48 10 l-10 18" />
    </svg>
  )
}

export function IconGift({ className = 'size-12' }: { className?: string }) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <path d="M10 18 h44 v30 h-44 z" />
      <path d="M10 18 l22 16 l22 -16" />
      <rect x="27" y="36" width="10" height="10" stroke="var(--seal)" transform="rotate(-6 32 41)" />
    </svg>
  )
}

export function IconAgent({ className = 'size-12' }: { className?: string }) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <path d="M12 14 h40 v32 h-40 z" />
      <path d="M20 26 l6 5 l-6 5 M30 37 h12" />
      <path d="M24 54 h16 M32 46 v8" />
    </svg>
  )
}

export function IconWorker({ className = 'size-12' }: { className?: string }) {
  return (
    <svg {...base} aria-hidden="true" className={className}>
      <circle cx="32" cy="18" r="8" />
      <path d="M16 52 c2 -12 8 -18 16 -18 s14 6 16 18" />
      <path d="M22 16 h20" />
    </svg>
  )
}
