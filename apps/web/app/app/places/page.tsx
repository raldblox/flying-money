import type { Metadata } from 'next'
import { Places } from './places-client'

export const metadata: Metadata = { title: 'Sellers', robots: { index: false } }

export default function PlacesPage() {
  return (
    <div>
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        Sellers, <em className="text-seal">where</em> money can go.
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-2">
        Every budget pays exactly one place. Save the places you use, verified by scanning their code in person or by
        their web domain.
      </p>
      <Places />
    </div>
  )
}
