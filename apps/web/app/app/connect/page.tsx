import type { Metadata } from 'next'
import { ConnectAgent } from './connect-client'

export const metadata: Metadata = { title: 'Connect an assistant', robots: { index: false } }

export default function ConnectPage() {
  return <ConnectAgent />
}
