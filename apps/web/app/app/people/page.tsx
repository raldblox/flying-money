import type { Metadata } from 'next'
import { People } from './people-client'

export const metadata: Metadata = { title: 'People & agents', robots: { index: false } }

export default function PeoplePage() {
  return (
    <div>
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        People & agents, <em className="text-seal">who</em> spends.
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-2">
        Give each person or agent certificates for the places they use: “Give Mia 10 at the canteen for 7 days.” You
        choose where, how much and how long. You can’t freeze a certificate once issued, so keep amounts small and renew
        instead.
      </p>
      <People />
    </div>
  )
}
