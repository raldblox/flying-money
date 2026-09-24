import type { Metadata } from 'next'
import { GiftForward } from './forward'

export const metadata: Metadata = { title: 'A gift for you', robots: { index: false } }

/** /gift/#add=… (§10.1): opens a gift certificate into the wallet. The key stays in the fragment (never sent). */
export default function GiftPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <p className="smallcaps text-sm text-seal">A gift certificate</p>
      <h1 className="mt-2 font-display text-5xl font-semibold">Opening your wallet…</h1>
      <GiftForward />
    </div>
  )
}
