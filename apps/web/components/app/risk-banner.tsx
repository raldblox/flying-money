import type { ReactNode } from 'react'

/**
 * A warning that stays in view while the person carries on (the way banking apps flag a new or unusual payee).
 * `caution` = something we can't vouch for; `danger` = several unknowns at once, check before paying.
 */
export function RiskBanner({
  tone = 'caution',
  title,
  children,
}: {
  tone?: 'caution' | 'danger'
  title: string
  children?: ReactNode
}) {
  const danger = tone === 'danger'
  return (
    <div
      role="alert"
      className={`flex gap-3 rounded-md border-l-4 p-4 ${
        danger ? 'border-seal bg-seal/10' : 'border-amber bg-amber/10'
      }`}
    >
      <span
        aria-hidden
        className={`grid size-7 shrink-0 place-items-center rounded-full font-bold text-paper ${
          danger ? 'bg-seal' : 'bg-amber'
        }`}
      >
        !
      </span>
      <div className="min-w-0">
        <p className={`font-semibold ${danger ? 'text-seal' : 'text-amber'}`}>{title}</p>
        {children && <div className="mt-1 text-sm text-ink-2">{children}</div>}
      </div>
    </div>
  )
}
