'use client'
import type { ChainConfig, ChainKey } from '@flying-money/chains'
import { getChain } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { usePreferredChain } from '@/lib/chain-param'
import { listHolders, listPlaces } from '@/lib/contacts'
import { short } from '@/lib/fmt'
import { deployedChains } from '@/lib/wagmi'

interface AccountCtx {
  chain: ChainConfig
  chains: ChainConfig[]
  setChainKey: (k: ChainKey) => void
  /** the hosted demo service's payee, known by name everywhere in the account */
  oraclePayee?: Hex
  /** a readable name for a payee address: saved places, the demo service, else the short address */
  placeName: (payee: Hex) => string
  /** true when the payee is a saved place on this network, or the demo service */
  isKnownPlace: (payee: Hex) => boolean
  /** a readable name for a spending key: saved people & agents, else null */
  holderName: (spender: Hex, certificateId?: Hex) => string | null
  /** bump after a transaction so every list re-reads the chain */
  refreshKey: number
  refresh: () => void
}

const Ctx = createContext<AccountCtx | null>(null)

export function useAccountCtx(): AccountCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAccountCtx outside the account area')
  return c
}

const same = (a?: string, b?: string) => Boolean(a && b && a.toLowerCase() === b.toLowerCase())

export function AccountProvider({
  children,
  defaultChain,
  oraclePayee,
}: {
  children: ReactNode
  defaultChain: string
  oraclePayee?: Hex
}) {
  // every deployed network, mainnet included: the default is a test network, and a mainnet says it is real money
  const chains = deployedChains()
  const fallback = (chains.find((c) => c.key === defaultChain)?.key ?? chains[0]?.key ?? 'arbitrum-sepolia') as ChainKey
  const [chainKey, setChainKey] = usePreferredChain(
    chains.map((c) => c.key),
    fallback,
  )
  const [places, setPlaces] = useState<Array<{ payee: Hex; name: string; chain: string }>>([])
  const [holders, setHolders] = useState<Array<{ name: string; address?: Hex; ids: string[] }>>([])
  const [refreshKey, setRefreshKey] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey re-reads contacts after a change
  useEffect(() => {
    void listPlaces().then((ps) => setPlaces(ps.map((p) => ({ payee: p.payee, name: p.name, chain: p.chain }))))
    void listHolders().then((hs) =>
      setHolders(
        hs.map((h) => ({
          name: h.name,
          ...(h.address ? { address: h.address } : {}),
          ids: h.certificates.map((c) => c.id.toLowerCase()),
        })),
      ),
    )
  }, [refreshKey])
  const chain = getChain(chainKey)
  const value: AccountCtx = {
    chain,
    chains,
    setChainKey,
    ...(oraclePayee ? { oraclePayee } : {}),
    placeName: (payee) =>
      same(payee, oraclePayee)
        ? 'Silk Road Oracle'
        : (places.find((p) => p.chain === chain.key && same(p.payee, payee))?.name ?? short(payee)),
    isKnownPlace: (payee) =>
      same(payee, oraclePayee) || places.some((p) => p.chain === chain.key && same(p.payee, payee)),
    holderName: (spender, id) =>
      holders.find((h) => same(h.address, spender) || (id && h.ids.includes(id.toLowerCase())))?.name ?? null,
    refreshKey,
    refresh: () => setRefreshKey((k) => k + 1),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
