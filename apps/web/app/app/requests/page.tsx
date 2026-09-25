import type { Metadata } from 'next'
import { Requests } from '@/components/account/requests'

export const metadata: Metadata = { title: 'Requests', robots: { index: false } }

export default function RequestsPage() {
  return <Requests />
}
