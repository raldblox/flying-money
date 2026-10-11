import type { Metadata } from 'next'
import { NetworkHub } from '@/components/network-hub'

export const metadata: Metadata = {
  title: 'Networks',
  description:
    'Every network Flying Money runs on, mainnets and test networks kept apart: contract, caps, and where to start.',
}

export default function NetworksPage() {
  return <NetworkHub type="all" />
}
