import { homedir } from 'node:os'
import { join } from 'node:path'
import { type ChainKey, isChainKey } from '@flying-money/chains'
import { createFlyingMoneyClient, type FlyingMoneyClient, fileStore } from '@flying-money/client'
import type { Hex } from '@flying-money/core'
import { parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

export interface McpEnvConfig {
  client: FlyingMoneyClient
  maxPricePerRequest: bigint
}

/**
 * Configuration from the environment (§8.4). The key is read once into the client and never exposed.
 *   AGENT_KEY            spending key (0x…, 32 bytes). Make it with `npx @flying-money/client keygen`.
 *   AGENT_CERTIFICATES   comma-separated certificate ids issued to that key
 *   AGENT_CHAINS         comma-separated registry keys (default: AGENT_CHAIN or arbitrum-sepolia)
 *   FM_MAX_PRICE         per-request cap in USDC (default 0.05)
 *   FM_STORE             durable outbox file (default ~/.flying-money/outbox.json)
 *   RPC_<CHAIN>          optional RPC overrides
 */
export function configFromEnv(env: Record<string, string | undefined> = process.env): McpEnvConfig {
  const key = env.AGENT_KEY?.trim()
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key))
    throw new Error(
      'AGENT_KEY is missing or malformed (expected 0x + 64 hex). Make one with: npx @flying-money/client keygen',
    )
  const certificates = (env.AGENT_CERTIFICATES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (certificates.length === 0 || certificates.some((c) => !/^0x[0-9a-fA-F]{64}$/.test(c)))
    throw new Error('AGENT_CERTIFICATES must list certificate ids (0x + 64 hex), comma-separated')
  const chains = (env.AGENT_CHAINS ?? env.AGENT_CHAIN ?? 'arbitrum-sepolia').split(',').map((s) => s.trim())
  for (const c of chains) if (!isChainKey(c)) throw new Error(`unknown chain in AGENT_CHAINS: ${c}`)
  const maxPricePerRequest = parseUnits(env.FM_MAX_PRICE ?? '0.05', 6)
  const client = createFlyingMoneyClient({
    chains: chains as ChainKey[],
    spender: privateKeyToAccount(key as Hex),
    store: fileStore(env.FM_STORE ?? join(homedir(), '.flying-money', 'outbox.json')),
    certificates: certificates as Hex[],
    maxPricePerRequest,
    env,
  })
  return { client, maxPricePerRequest }
}
