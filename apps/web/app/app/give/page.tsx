import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Give } from '@/components/account/give'

export const metadata: Metadata = { title: 'Give a budget', robots: { index: false } }

export default function GivePage() {
  return (
    <Suspense>
      <Give />
    </Suspense>
  )
}
