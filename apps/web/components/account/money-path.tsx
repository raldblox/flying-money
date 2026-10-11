import type { ChainConfig } from '@flying-money/chains'
import type { Certificate } from '@flying-money/core'
import { short, usdc } from '@/lib/fmt'

function Stop({
  title,
  who,
  amount,
  note,
  tone = 'plain',
}: {
  title: string
  who: string
  amount?: string
  note: string
  tone?: 'plain' | 'locked'
}) {
  return (
    <li
      className={`grid content-start gap-1 rounded-md border p-3 ${tone === 'locked' ? 'border-seal/50 bg-seal/5' : 'border-line bg-paper'}`}
    >
      <span className="smallcaps text-[0.7rem] text-ink-2">{title}</span>
      <span className="font-medium">{who}</span>
      {amount && <span className="font-display text-2xl tabular-nums">{amount} USDC</span>}
      <span className="text-xs text-ink-2">{note}</span>
    </li>
  )
}

function Arrow({ label }: { label: string }) {
  return (
    <li aria-hidden className="grid place-items-center text-xs text-ink-2 md:px-1">
      <span className="hidden md:block">→</span>
      <span className="md:hidden">↓</span>
      <span className="text-center">{label}</span>
    </li>
  )
}

/**
 * Where one budget's money is, and who can move it. Only what the contract itself shows is stated as a number: what is
 * locked, what was paid out to the seller, and what comes back to the funder. Notes the agent signed that the seller has
 * not collected yet are not on-chain, so they are described, never counted.
 */
export function MoneyPath({
  cert,
  chain,
  seller,
  agent,
}: {
  cert: Certificate
  chain: ChainConfig
  /** the seller's name, or its short address */
  seller: string
  /** the agent's or person's name, or its short address */
  agent: string
}) {
  const left = cert.faceValue - cert.redeemed
  const now = BigInt(Math.floor(Date.now() / 1000))
  const ended = now > cert.expiresAt
  const ends = new Date(Number(cert.expiresAt) * 1000).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return (
    <div className="grid gap-3 text-sm">
      <ol className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch" aria-label="Where the money is">
        <Stop
          title="1 · You funded it"
          who="Your wallet"
          amount={usdc(cert.faceValue)}
          note={`Moved into the Flying Money contract on ${chain.chain.name}, once.`}
        />
        <Arrow label="locked" />
        <Stop
          tone="locked"
          title="2 · Locked for one seller"
          who="The contract"
          amount={usdc(left)}
          note={
            ended
              ? 'The end date has passed: this is yours to take back.'
              : `Only ${seller} can be paid from it, until ${ends}.`
          }
        />
        <Arrow label="paid out when collected" />
        <Stop
          title="3 · Paid to the seller"
          who={seller}
          amount={usdc(cert.redeemed)}
          note="Already collected by the seller, on-chain. This is final."
        />
      </ol>
      <ul className="grid gap-1 text-ink-2">
        <li>
          <strong className="text-ink">{agent}</strong> only signs payments to {seller}, up to {usdc(cert.faceValue)}{' '}
          USDC in total. Its key never holds or moves money, and can’t send it anywhere else.
        </li>
        <li>
          The seller collects with those signed payments before {ends}. Payments signed but not yet collected are not
          visible on-chain, so they are not counted above.
        </li>
        <li>
          {ended ? (
            <>
              <strong className="text-ink">{usdc(left)} USDC</strong> is yours to take back now.
            </>
          ) : (
            <>
              Whatever isn’t collected by {ends} returns to you: only your wallet ({short(cert.funder)}) can take it
              back.
            </>
          )}
        </li>
      </ul>
    </div>
  )
}
