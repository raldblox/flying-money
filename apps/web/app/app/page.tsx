import type { Hex } from '@flying-money/core'
import type { Metadata } from 'next'
import { ContactsNav } from '@/components/app/contacts-nav'
import { CountingHouse } from './counting-house'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Counting House',
  description: 'Everything you’ve given, and everything you can collect.',
}

export default function AppPage() {
  // The demo Oracle's payee is public (it receives the payments); it is pre-listed as a Place (§12.2).
  const payee = process.env.PAYEE_ADDRESS
  const oraclePayee = payee && /^0x[0-9a-fA-F]{40}$/.test(payee) ? (payee as Hex) : undefined
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <ContactsNav current="app" />
      <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight sm:text-6xl">Counting House</h1>
      <p className="mt-3 max-w-3xl text-lg text-ink-2">
        Everything you’ve given, and everything you can collect. You set where, how much and how long up front. You
        can’t cancel early: that’s what lets a shop accept on the spot. You can always choose not to renew.
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
