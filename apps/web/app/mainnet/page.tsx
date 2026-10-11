import type { Metadata } from 'next'
import { NetworkHub } from '@/components/network-hub'

export const metadata: Metadata = {
  title: 'Mainnets',
  description: 'Flying Money on mainnet: real USDC under immutable caps. Not audited.',
}

export default function MainnetPage() {
  return <NetworkHub type="mainnet" />
}
