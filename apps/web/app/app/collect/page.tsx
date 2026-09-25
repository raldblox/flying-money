import type { Metadata } from 'next'
import { Collect } from '@/components/account/collect'

export const metadata: Metadata = { title: 'Collect', robots: { index: false } }

export default function CollectPage() {
  return <Collect />
}
