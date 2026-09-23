import { Seal } from './seal'

/**
 * Certificate (§11.3): a paper card made of two matching halves, like the Tang-dynasty tallies.
 * The seal is semantic: pass `sealed` only for a certificate that really exists on-chain.
 */
export function CertificateCard({
  face,
  payee,
  holder,
  expires,
  sealed = false,
  caption,
}: {
  face: string
  payee: string
  holder: string
  expires: string
  sealed?: boolean
  caption?: string
}) {
  return (
    <figure className="mx-auto w-full max-w-md">
      <div className="tally-join relative flex select-none">
        <div className="half-left flex-1 rounded-l-md border border-r-0 border-line bg-paper-2 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-2">Certificate</p>
          <p className="mt-2 font-display text-5xl font-semibold lining-nums tabular-nums">{face}</p>
          <p className="text-xs text-ink-2">USDC face value</p>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-20 text-ink-2">Payable to</dt>
              <dd className="font-medium">{payee}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 text-ink-2">Spent by</dt>
              <dd className="font-medium">{holder}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 text-ink-2">Valid until</dt>
              <dd className="font-medium">{expires}</dd>
            </div>
          </dl>
        </div>
        <div
          aria-hidden
          className="half-right relative w-16 rounded-r-md border border-line bg-paper-2 shadow-sm [clip-path:polygon(14%_0,100%_0,100%_100%,14%_100%,0_92%,14%_84%,0_76%,14%_68%,0_60%,14%_52%,0_44%,14%_36%,0_28%,14%_20%,0_12%)]"
        >
          <span className="absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-line" />
        </div>
        {sealed && (
          <span className="absolute -right-3 -top-3">
            <Seal size={48} animate label="Sealed on-chain" />
          </span>
        )}
      </div>
      {caption && <figcaption className="mt-3 text-center text-sm text-ink-2">{caption}</figcaption>}
    </figure>
  )
}
