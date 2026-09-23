import { type ChainConfig, chainKeys, getChain, rpcUrl, setLocalDeployment } from '@flying-money/chains'
import type { Chain, Hex } from 'viem'
import { createConfig, http, injected, mock } from 'wagmi'

/**
 * Local end-to-end test mode ONLY (never set in production): the Counting House talks to a private anvil and uses
 * wagmi's mock connector, whose transactions are signed by anvil's unlocked, publicly known dev accounts.
 */
const E2E = {
  rpc: process.env.NEXT_PUBLIC_FM_E2E_ANVIL,
  usdc: process.env.NEXT_PUBLIC_FM_E2E_USDC as Hex | undefined,
  contract: process.env.NEXT_PUBLIC_FM_E2E_CONTRACT as Hex | undefined,
  account: process.env.NEXT_PUBLIC_FM_E2E_ACCOUNT as Hex | undefined,
}
export const e2eMode = Boolean(E2E.rpc && E2E.usdc && E2E.contract && E2E.account)
if (e2eMode) setLocalDeployment({ usdc: E2E.usdc!, flyingMoney: E2E.contract! })

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
