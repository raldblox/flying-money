import type { ChainKey } from '@flying-money/chains'
import type { PickerNetwork } from '@/components/network-picker'
import { deployedChains } from './wagmi'

/** "Arbitrum, Base, Ethereum and Tempo": every network the contract is live on, from the registry, in one fair list. */
export function liveNetworks(): string {
  const names = [...new Set(deployedChains().map((c) => c.brand))].sort()
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

/** Registry chains → picker entries, alphabetical by brand, so no network is featured first. */
export function toPickerNetworks(
  chains: Array<{ key: ChainKey; brand: string; chain: { name: string } }>,
): PickerNetwork[] {
  return [...chains]
    .sort((a, b) => a.brand.localeCompare(b.brand))
    .map((c) => ({ key: c.key, brand: c.brand, name: c.chain.name }))
}
