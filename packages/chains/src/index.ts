import type { Hex } from 'viem'
import deploymentsJson from './deployments.json' with { type: 'json' }
import { baseRegistry, type ChainConfig, type ChainKey, chainKeys, isChainKey } from './registry.js'

export * from './registry.js'

/** Written by `pnpm deploy:all` (§7.5). Keyed by ChainKey. */
export interface DeploymentRecord {
  flyingMoney: Hex
  deployedBlock: string
}
export const deployments = deploymentsJson as Partial<Record<ChainKey, DeploymentRecord>>

const local: { usdc?: Hex; flyingMoney?: Hex; deployedBlock?: bigint } = {}

/**
 * Register a LOCAL anvil deployment (MockUSDC + FlyingMoney) at runtime. Only `anvil` can be set this way;
 * public chains come exclusively from the committed registry + deployments.json.
 */
export function setLocalDeployment(d: { usdc: Hex; flyingMoney: Hex; deployedBlock?: bigint }): void {
  local.usdc = d.usdc
  local.flyingMoney = d.flyingMoney
  local.deployedBlock = d.deployedBlock ?? 0n
}

export function getChain(key: ChainKey | string): ChainConfig {
  if (!isChainKey(key)) throw new Error(`Unknown chain key: ${key}`)
  const b = baseRegistry[key]
  if (key === 'anvil') {
    return {
      ...b,
      usdc: local.usdc ?? b.usdc,
      ...(local.flyingMoney ? { flyingMoney: local.flyingMoney, deployedBlock: local.deployedBlock ?? 0n } : {}),
    }
  }
  const d = deployments[key]
  return d ? { ...b, flyingMoney: d.flyingMoney, deployedBlock: BigInt(d.deployedBlock) } : { ...b }
}

export function getChainById(chainId: number): ChainConfig | undefined {
  const key = chainKeys.find((k) => baseRegistry[k].chain.id === chainId)
  return key ? getChain(key) : undefined
}

export function allChains(): ChainConfig[] {
  return chainKeys.map(getChain)
}
