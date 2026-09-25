import type { Metadata } from 'next'
import { OfflineReady } from '@/components/offline-ready'
import { Wallet } from './wallet-client'

// per request, so the strict CSP nonce (proxy.ts, audit F11) reaches every script
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Wallet',
  description: 'Your Flying Money budgets on this device. Pay at the counter by showing a QR code.',
  robots: { index: false },
}

export default function WalletPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="smallcaps text-sm text-seal">Wallet · on this device</p>
        <OfflineReady />
      </div>
      <Wallet />
    </div>
  )
}
