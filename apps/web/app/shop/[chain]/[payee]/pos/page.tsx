import { type ChainKey, chainKeys, getChain } from '@flying-money/chains'
import type { Metadata } from 'next'
import '@/lib/e2e'
import { notFound } from 'next/navigation'
import { isAddress } from 'viem'
import { OfflineReady } from '@/components/offline-ready'
import { Pos } from './pos-client'

export const metadata: Metadata = { title: 'Till', robots: { index: false } }

export default async function PosPage({
  params,
  searchParams,
}: {
  params: Promise<{ chain: string; payee: string }>
  searchParams: Promise<{ name?: string }>
}) {
  const { chain, payee } = await params
  const { name } = await searchParams
  if (!(chainKeys as readonly string[]).includes(chain) || !isAddress(payee)) notFound()
  const c = getChain(chain as ChainKey)
  if (!c.flyingMoney) notFound()
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="smallcaps text-sm text-seal">
          The till · {c.chain.name}
          {c.mainnet ? ' · real money' : ' · test money'}
        </p>
        <OfflineReady />
      </div>
      <Pos chainKey={c.key} payee={payee} initialName={name?.slice(0, 60)} />
    </div>
  )
}
