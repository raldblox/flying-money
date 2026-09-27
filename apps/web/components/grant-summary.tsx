import { dayLabel, usdc } from '@/lib/fmt'

/**
 * The budget in one sentence (BUILD_SPEC §22.4): how much, where, who, until when, that it can't be cancelled early,
 * and that what's left is *taken back* after the end date (it never returns by itself). Used wherever a budget
 * appears: the fund review, the request review, rows, the budget page and the holder's card.
 */
export interface GrantProps {
  /** base units: the budget's face value, or the amount being funded */
  amount: bigint
  seller: string
  /** who can use it ("Mia", "Research agent", "you") */
  user: string
  expiresAt: bigint
  /** test network: amounts read "test USDC" */
  test: boolean
  /** whose screen this is: the funder's (default) or the holder's */
  perspective?: 'funder' | 'holder'
  /** the holder's view names who can take the rest back */
  funder?: string
}

export function grantSentence(p: GrantProps): string {
  const unit = p.test ? 'test USDC' : 'USDC'
  const rest =
    p.perspective === 'holder'
      ? `after that, ${p.funder ?? 'whoever funded it'} can take back what’s left`
      : 'after that, you can take back what’s left'
  return [
    `Up to ${usdc(p.amount)} ${unit}`,
    `at ${p.seller}`,
    `used by ${p.user}`,
    `until ${dayLabel(p.expiresAt)}`,
    'can’t be cancelled early',
    rest,
  ].join(' · ')
}

export function GrantSummary(p: GrantProps & { className?: string }) {
  const unit = p.test ? 'test USDC' : 'USDC'
  return (
    <p className={`text-ink-2 ${p.className ?? ''}`}>
      Up to{' '}
      <strong className="text-ink">
        {usdc(p.amount)} {unit}
      </strong>{' '}
      · at <strong className="text-ink">{p.seller}</strong> · used by <strong className="text-ink">{p.user}</strong> ·
      until{' '}
      <strong className="text-ink" suppressHydrationWarning>
        {dayLabel(p.expiresAt)}
      </strong>{' '}
      · <span className="text-ink">can’t be cancelled early</span> ·{' '}
      {p.perspective === 'holder'
        ? `after that, ${p.funder ?? 'whoever funded it'} can take back what’s left`
        : 'after that, you can take back what’s left'}
    </p>
  )
}
