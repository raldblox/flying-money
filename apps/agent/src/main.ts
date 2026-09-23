// The Merchant (§13.2) against a real Oracle.
//   pnpm --filter @flying-money/agent start [--chain arbitrum-sepolia] [--json]
// env: AGENT_KEY (from `npx @flying-money/client keygen`), AGENT_CERTIFICATES (comma-separated ids),
//      ORACLE_URL, optional AGENT_STORE (default .flying-money.json), RPC_<CHAIN> overrides.
import { existsSync } from 'node:fs'
import { type ChainKey, isChainKey } from '@flying-money/chains'
import { createFlyingMoneyClient, fileStore } from '@flying-money/client'
import type { Hex } from '@flying-money/core'
import { privateKeyToAccount } from 'viem/accounts'
import { runMerchant } from './merchant.js'

for (const p of ['.env', '../../.env']) if (existsSync(p)) process.loadEnvFile(p)

const argv = process.argv.slice(2)
const arg = (name: string) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}
const json = argv.includes('--json')
const chain = arg('--chain') ?? process.env.AGENT_CHAIN ?? 'arbitrum-sepolia'
if (!isChainKey(chain)) throw new Error(`unknown chain ${chain}`)
const key = process.env.AGENT_KEY as Hex | undefined
const certificates = (process.env.AGENT_CERTIFICATES ?? '').split(',').filter(Boolean) as Hex[]
const oracleUrl = process.env.ORACLE_URL
if (!key || certificates.length === 0 || !oracleUrl) {
  console.error('Set AGENT_KEY, AGENT_CERTIFICATES and ORACLE_URL (see .env.example).')
  process.exit(2)
}

const emit = (type: string, data: Record<string, unknown>) =>
  json
    ? console.log(
        JSON.stringify({ type, at: Date.now(), ...data }, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
      )
    : console.log(
        type === 'log'
          ? data.line
          : `[${type}] ${JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v))}`,
      )

const fm = createFlyingMoneyClient({
  chains: [chain as ChainKey],
  spender: privateKeyToAccount(key),
  store: fileStore(process.env.AGENT_STORE ?? '.flying-money.json'),
  certificates,
  maxPricePerRequest: 50_000n, // 0.05 USDC
  env: process.env,
  onEvent: (e) => emit(e.type, e as unknown as Record<string, unknown>),
})
await fm.ready
const status = fm.status()
if (status.length === 0) {
  console.error(`No usable certificate on ${chain} for this agent key.`)
  process.exit(1)
}
emit('status', { certificates: status })
const result = await runMerchant({ fm, oracleUrl, log: (line) => emit('log', { line }) })
emit('summary', {
  calls: result.calls,
  served: result.served,
  failed: result.failed,
  bestTrade: result.bestTrade,
  status: fm.status(),
})
