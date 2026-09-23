import type { ReactNode } from 'react'

const styles = {
  open: 'border-indigo/40 text-indigo',
  expired: 'border-line text-ink-2',
  closed: 'border-line text-ink-2',
  sealed: 'border-seal/50 text-seal',
  accepted: 'border-seal/50 text-seal',
  redeemed: 'border-celadon text-ink',
  unverified: 'border-amber/60 text-amber',
  failed: 'border-line text-ink-2',
} as const

export type ChipKind = keyof typeof styles

/** StatusChip (§11.3): Open/Expired/Closed; Sealed → Accepted by seller → Redeemed on-chain (§11.4). */
export function StatusChip({ kind, children }: { kind: ChipKind; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[kind]}`}
    >
      {kind === 'redeemed' && <span aria-hidden className="size-1.5 rounded-full bg-celadon" />}
      {children}
    </span>
  )
}
