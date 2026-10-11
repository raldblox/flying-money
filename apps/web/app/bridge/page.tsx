import type { Metadata } from 'next'
import { BridgeMonitor } from './bridge-monitor'

export const metadata: Metadata = {
  title: 'Check a bridge',
  description:
    'See a Flying Money x402 bridge’s wallet, what it owes and is owed, and what it paid, and check the numbers against the chain.',
}

export default function BridgePage() {
  return <BridgeMonitor />
}
