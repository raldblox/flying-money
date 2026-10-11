import type { Metadata } from 'next'
import { NetworkHub } from '@/components/network-hub'

export const metadata: Metadata = {
  title: 'Test networks',
  description: 'Flying Money on test networks: try the demos with practice money on the chain you build on.',
}

export default function TestnetPage() {
  return <NetworkHub type="testnet" />
}
