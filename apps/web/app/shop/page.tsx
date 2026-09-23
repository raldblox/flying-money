import type { Metadata } from 'next'
import { Providers } from '@/app/app/providers'
import { OfflineReady } from '@/components/offline-ready'
import { OpenShop } from './open-shop'

export const metadata: Metadata = {
  title: 'Shop mode',
  description: 'Take Flying Money certificates at your counter: a till that works offline, and a QR for customers.',
}

export default function ShopPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="smallcaps text-sm text-seal">Shop mode</p>
        <OfflineReady />
      </div>
      <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
        Open a <em className="text-seal">till</em>.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-2">
        Customers pay with a certificate made for your shop: a budget someone set aside that only you can collect. Your
        till shows a price code, scans the customer’s code, and tells you at once whether the payment is guaranteed. It
        keeps working when the Wi‑Fi drops, and you collect everything later in one transaction.
      </p>
      <Providers>
        <OpenShop />
      </Providers>
    </div>
  )
}
