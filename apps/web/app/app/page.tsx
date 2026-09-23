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
        Lock a budget for one place, hand a spending key to whoever spends it, and collect sealed notes as the payee.
        Control happens when you issue: there is no freeze or early cancel, which is exactly why a shop can accept a
        note instantly.
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
