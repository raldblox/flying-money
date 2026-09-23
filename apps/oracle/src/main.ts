// Silk Road Oracle server (§13.1). Config from env (.env.example):
//   ORACLE_ACCEPTS, PAYEE_ADDRESS, REDEEMER_KEY (optional; enables the redeemer), PORT,
//   UPSTASH_REDIS_REST_URL/TOKEN or REDIS_URL (durable seller store; memory if unset — demo only),
//   ORACLE_DOCS_URL, CORS_ORIGIN. For local anvil: FM_ANVIL_USDC, FM_ANVIL_CONTRACT.
import { existsSync } from 'node:fs'
import { type ChainKey, isChainKey, setLocalDeployment } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import { memoryStore, type NoteStore, redisStore, upstashStore } from '@flying-money/server'
import { serve } from '@hono/node-server'
import { privateKeyToAccount } from 'viem/accounts'
import { createOracle } from './app.js'

for (const p of ['.env', '../../.env']) if (existsSync(p)) process.loadEnvFile(p)
const env = process.env

const accepts = (env.ORACLE_ACCEPTS ?? 'arbitrum-sepolia').split(',').map((s) => s.trim())
for (const k of accepts) if (!isChainKey(k)) throw new Error(`ORACLE_ACCEPTS: unknown chain ${k}`)
if (accepts.includes('anvil')) {
  if (!env.FM_ANVIL_USDC || !env.FM_ANVIL_CONTRACT) throw new Error('anvil needs FM_ANVIL_USDC and FM_ANVIL_CONTRACT')
  setLocalDeployment({ usdc: env.FM_ANVIL_USDC as Hex, flyingMoney: env.FM_ANVIL_CONTRACT as Hex })
}
const payee = env.PAYEE_ADDRESS as Hex | undefined
if (!payee || !/^0x[0-9a-fA-F]{40}$/.test(payee)) throw new Error('PAYEE_ADDRESS is required (human input H3)')

let store: NoteStore
if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
  store = upstashStore({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
  console.log('store: Upstash Redis')
} else if (env.REDIS_URL) {
  store = redisStore(env.REDIS_URL)
  console.log('store: Redis')
} else {
  store = memoryStore()
  console.warn('store: MEMORY (not durable; demo only — set UPSTASH_REDIS_REST_URL/TOKEN for a real seller, §6.5)')
}

const oracle = createOracle({
  accepts: accepts as ChainKey[],
  payee,
  store,
  env,
  ...(env.ORACLE_DOCS_URL ? { docsUrl: env.ORACLE_DOCS_URL } : {}),
  ...(env.CORS_ORIGIN ? { corsOrigin: env.CORS_ORIGIN.split(',') } : {}),
  ...(env.REDEEMER_KEY ? { redeemer: { account: privateKeyToAccount(env.REDEEMER_KEY as Hex) } } : {}),
})
oracle.events.on('note', (e) => console.log(`note ${e.status} ${e.path} cumulative ${e.accepted}`))
oracle.events.on('redeemed', (e) => console.log(`redeemed ${e.paid} on chain ${e.chainId}: ${e.txHash}`))
oracle.events.on('error', (e) => console.error('redeemer:', e))
oracle.server.startSweeper(60_000)
if (oracle.redeemer) oracle.redeemer.start(10_000)
else console.warn('no REDEEMER_KEY: notes are accepted but not redeemed by this process')

const port = Number(env.PORT ?? 8787)
serve({ fetch: oracle.app.fetch, port })
console.log(`Silk Road Oracle on :${port} accepting ${accepts.join(', ')} for payee ${payee}`)
