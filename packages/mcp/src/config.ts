import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { type ChainKey, isChainKey } from '@flying-money/chains'
import { createFlyingMoneyClient, type FlyingMoneyClient, fileRequestStore, fileStore } from '@flying-money/client'
import type { Hex } from '@flying-money/core'
import { parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { loadOrCreateAgentKey } from './agent-key.js'
import { allowHostsFromEnv, guardedFetch } from './net-guard.js'

export interface McpEnvConfig {
  client: FlyingMoneyClient
  maxPricePerRequest: bigint
  /** An owner is configured, so the agent may ask for budgets (§21.4). */
  canRequest: boolean
  /** Public internet only (audit F6): used by the tools and by the payment client alike. */
  fetch: typeof fetch
  /** Where the owner reviews requests (for URL-mode elicitation). */
  approvalBase: string
  /** The address budgets are issued to (public; the key itself is never exposed). */
  spendingAddress: Hex
  /** The key was made on this start (§22.10 b): the agent should tell its owner the address. */
  keyCreated: boolean
}

/** Where approval links open by default (§21.4.2 link channel). */
export const DEFAULT_REQUEST_LINK_BASE = 'https://useflyingmoney.vercel.app'

/**
 * Configuration from the environment (§8.4). The key is read once into the client and never exposed.
 *   AGENT_KEY            spending key (0x…, 32 bytes); optional. Without it the server makes one on first run and
 *                        keeps it in FM_KEY_FILE (default: agent-key next to FM_STORE, mode 0600) (§22.10 b)
 *   FM_KEY_FILE          where the made key is kept
 *   AGENT_CERTIFICATES   comma-separated certificate ids issued to that key
 *   AGENT_CHAINS         comma-separated registry keys (default: AGENT_CHAIN or arbitrum-sepolia)
 *   FM_MAX_PRICE         per-request cap in USDC (default 0.05)
 *   FM_STORE             durable outbox file (default ~/.flying-money/outbox.json); requests go next to it
 *   FM_OWNER             owner address to ask for budgets (§21.4); optional
 *   FM_REQUEST_LINK_BASE where approval links open (default https://useflyingmoney.vercel.app)
 *   FM_OWNER_GRANT       the owner's permission to ask (fm1, from the site); requests then go to the owner's inbox
 *   FM_RELAY_URL         the inbox (default <FM_REQUEST_LINK_BASE>/api/requests)
 *   RPC_<CHAIN>          optional RPC overrides
 *   FM_ALLOW_HOSTS       host:port pairs that may be private, e.g. a local Oracle (localhost:8787); default none
 */
export function configFromEnv(env: Record<string, string | undefined> = process.env): McpEnvConfig {
  const given = env.AGENT_KEY?.trim()
  if (given && !/^0x[0-9a-fA-F]{64}$/.test(given)) throw new Error('AGENT_KEY is malformed (expected 0x + 64 hex)')
  const certificates = (env.AGENT_CERTIFICATES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const owner = env.FM_OWNER?.trim()
  if (owner && !/^0x[0-9a-fA-F]{40}$/.test(owner)) throw new Error('FM_OWNER must be an address (0x + 40 hex)')
  if (certificates.some((c) => !/^0x[0-9a-fA-F]{64}$/.test(c)))
    throw new Error('AGENT_CERTIFICATES must list certificate ids (0x + 64 hex), comma-separated')
  if (certificates.length === 0 && !owner)
    throw new Error('set AGENT_CERTIFICATES (budgets to use), or FM_OWNER so the agent can ask its owner for one')
  const chains = (env.AGENT_CHAINS ?? env.AGENT_CHAIN ?? 'arbitrum-sepolia').split(',').map((s) => s.trim())
  for (const c of chains) if (!isChainKey(c)) throw new Error(`unknown chain in AGENT_CHAINS: ${c}`)
  const maxPricePerRequest = parseUnits(env.FM_MAX_PRICE ?? '0.05', 6)
  const storePath = env.FM_STORE ?? join(homedir(), '.flying-money', 'outbox.json')
  const made = given
    ? undefined
    : loadOrCreateAgentKey(env.FM_KEY_FILE?.trim() || join(dirname(storePath), 'agent-key'))
  const spender = privateKeyToAccount((given ?? made?.key) as Hex)
  const fetch = guardedFetch({ allowHosts: allowHostsFromEnv(env.FM_ALLOW_HOSTS) })
  const client = createFlyingMoneyClient({
    fetch,
    chains: chains as ChainKey[],
    spender,
    store: fileStore(storePath),
    certificates: certificates as Hex[],
    maxPricePerRequest,
    env,
    ...(owner
      ? {
          owner: owner as Hex,
          requestLinkBase: env.FM_REQUEST_LINK_BASE ?? DEFAULT_REQUEST_LINK_BASE,
          ...(env.FM_OWNER_GRANT?.trim()
            ? {
                ownerGrant: env.FM_OWNER_GRANT.trim(),
                relayUrl:
                  env.FM_RELAY_URL?.trim() ||
                  `${(env.FM_REQUEST_LINK_BASE ?? DEFAULT_REQUEST_LINK_BASE).replace(/\/$/, '')}/api/requests`,
              }
            : {}),
          requestStore: fileRequestStore(storePath.replace(/\.json$/, '') + '.requests.json'),
        }
      : {}),
  })
  return {
    client,
    maxPricePerRequest,
    canRequest: Boolean(owner),
    fetch,
    approvalBase: env.FM_REQUEST_LINK_BASE ?? DEFAULT_REQUEST_LINK_BASE,
    spendingAddress: spender.address,
    keyCreated: made?.created ?? false,
  }
}
