import type { Metadata } from 'next'
import { ContactsNav } from '@/components/app/contacts-nav'
import { Places } from './places-client'

export const metadata: Metadata = { title: 'Places', robots: { index: false } }

export default function PlacesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <ContactsNav current="places" />
      <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight">
        Places, <em className="text-seal">where</em> money can go.
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-2">
        Every certificate pays exactly one place. Save the places you use, verified by scanning their code in person or
        by their web domain.
      </p>
      <Places />
    </div>
  )
}
