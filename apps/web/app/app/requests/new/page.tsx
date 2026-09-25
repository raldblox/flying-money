import type { Hex } from '@flying-money/core'
import type { Metadata } from 'next'
import { RequestReview } from './request-review'

// PAYEE_ADDRESS is read when the page is opened: the build step does not receive server env (turbo strict env)
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Budget request',
  description: 'Review a budget request from your agent, and fund it from your own wallet if you agree.',
  robots: { index: false },
}

/** /app/requests/new#fm1.… (§21.4.2 link channel): the request lives in the fragment and never reaches a server. */
export default function NewRequestPage() {
  const payee = process.env.PAYEE_ADDRESS
  const oraclePayee = payee && /^0x[0-9a-fA-F]{40}$/.test(payee) ? (payee as Hex) : undefined
  return (
    <div>
      <p className="smallcaps text-sm text-seal">Account · Requests</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Your agent is asking.</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-2">
        Nothing moves unless you fund it from your own wallet. Check who can be paid, then decide how much.
      </p>
      <div className="mt-8">
        <RequestReview oraclePayee={oraclePayee} />
      </div>
    </div>
  )
}
