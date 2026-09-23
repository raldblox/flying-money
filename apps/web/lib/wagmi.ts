import { type ChainConfig, chainKeys, getChain, rpcUrl } from '@flying-money/chains'
import type { Chain } from 'viem'
import { createConfig, http, injected, mock } from 'wagmi'
import { E2E, e2eMode } from './e2e'

export { e2eMode }

/** Chains the Counting House can use: those with a recorded deployment (from @flying-money/chains). */
export function deployedChains(): ChainConfig[] {
  return chainKeys
    .filter((k) => (e2eMode ? k === 'anvil' : k !== 'anvil'))
    .map(getChain)
    .filter((c) => Boolean(c.flyingMoney))
}

export function makeWagmiConfig() {
  const chains = deployedChains()
  const list = chains.map((c) => c.chain) as unknown as [Chain, ...Chain[]]
  return createConfig({
    chains: list,
    connectors: e2eMode ? [mock({ accounts: [E2E.account!] })] : [injected({ shimDisconnect: true })],
    transports: Object.fromEntries(chains.map((c) => [c.chain.id, http(e2eMode ? E2E.rpc : rpcUrl(c.key))])),
    ssr: true,
  })
}
