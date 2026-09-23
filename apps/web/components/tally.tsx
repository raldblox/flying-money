import { usdc } from '@/lib/fmt'

/** TallyProgress (§11.3): the redeemed/face strip, styled as a paper tally. */
export function Tally({ used, face, label = 'redeemed' }: { used: bigint; face: bigint; label?: string }) {
  const pct = face > 0n ? Number((used * 10_000n) / face) / 100 : 0
  return (
    <div>
      <div
        className="relative h-3 overflow-hidden rounded-sm border border-line bg-paper"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={`${usdc(used)} of ${usdc(face)} USDC ${label}`}
      >
        <div
          className="h-full bg-celadon motion-safe:transition-[width] motion-safe:duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 font-mono text-sm tabular-nums text-ink-2">
        {usdc(used)} / {usdc(face)} USDC {label}
      </p>
    </div>
  )
}
