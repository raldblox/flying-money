import type { ChainKey } from '@flying-money/chains'
import type { PickerNetwork } from '@/components/network-picker'
import { deployedChains } from './wagmi'

const joinNames = (names: string[]): string => {
  const sorted = [...new Set(names)].sort()
  if (sorted.length <= 1) return sorted[0] ?? ''
  return `${sorted.slice(0, -1).join(', ')} and ${sorted.at(-1)}`
}

/** "Arbitrum, Base, Ethereum and Tempo": every test network the contract is live on, from the registry, in one fair list. */
export function liveNetworks(): string {
  return joinNames(
    deployedChains()
      .filter((c) => !c.mainnet)
      .map((c) => c.brand),
  )
}

/** "Arc": the mainnets the contract is live on, each under immutable launch caps. Empty when there are none. */
export function liveMainnets(): string {
  return joinNames(
    deployedChains()
      .filter((c) => c.mainnet)
      .map((c) => c.brand),
  )
}

/** Registry chains → picker entries, alphabetical by brand, so no network is featured first. */
export function toPickerNetworks(
  chains: Array<{ key: ChainKey; brand: string; chain: { name: string } }>,
): PickerNetwork[] {
  return [...chains]
    .sort((a, b) => a.brand.localeCompare(b.brand))
    .map((c) => ({ key: c.key, brand: c.brand, name: c.chain.name }))
}
