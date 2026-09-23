import type { Hex } from '@flying-money/core'
import type { Metadata } from 'next'
import { CountingHouse } from './counting-house'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Counting House',
  description: 'Issue and manage sealed spending certificates; redeem the notes you were paid with.',
}

export default function AppPage() {
  // The demo Oracle's payee is public (it receives the payments); it is pre-listed as a Place (§12.2).
  const payee = process.env.PAYEE_ADDRESS
  const oraclePayee = payee && /^0x[0-9a-fA-F]{40}$/.test(payee) ? (payee as Hex) : undefined
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <p className="smallcaps text-sm text-seal">The Counting House</p>
      <h1 className="mt-1 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
        Issue, keep, <em className="text-seal">redeem</em>.
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-2">
        Set aside a budget for one place and give a spending key to whoever will spend it. If you’re the one being paid,
        collect your money here. You set every limit up front: once issued, a certificate can’t be frozen or cancelled
        early. That promise is exactly why a shop can accept it instantly.
      </p>
      <Providers>
        <CountingHouse
          defaultChain={process.env.NEXT_PUBLIC_DEFAULT_CHAIN ?? 'arbitrum-sepolia'}
          oraclePayee={oraclePayee}
        />
      </Providers>
    </div>
  )
}
