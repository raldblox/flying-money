import type { Metadata } from 'next'
import { HolderControl } from './holder-client'

export const metadata: Metadata = { title: 'Holder', robots: { index: false } }

export default async function HolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div>
      <HolderControl id={id.slice(0, 40)} />
    </div>
  )
}
