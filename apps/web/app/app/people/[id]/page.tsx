import type { Metadata } from 'next'
import { Providers } from '@/app/app/providers'
import { ContactsNav } from '@/components/app/contacts-nav'
import { HolderControl } from './holder-client'

export const metadata: Metadata = { title: 'Holder', robots: { index: false } }

export default async function HolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <ContactsNav current="people" />
      <Providers>
        <HolderControl id={id.slice(0, 40)} />
      </Providers>
    </div>
  )
}
