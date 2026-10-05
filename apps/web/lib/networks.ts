import { deployedChains } from './wagmi'

/** "Arbitrum, Base, Ethereum and Tempo": every network the contract is live on, from the registry, in one fair list. */
export function liveNetworks(): string {
  const names = [...new Set(deployedChains().map((c) => c.brand))].sort()
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}
