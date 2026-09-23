// Live demo on a public TESTNET (§17 Phase 4 ✅). Keys from .env only (never printed):
// DEMO_FUNDER_KEY, DEMO_AGENT_KEY, REDEEMER_KEY, PAYEE_ADDRESS.
//   pnpm --filter @flying-money/agent demo:testnet [--chain arbitrum-sepolia] [--face 0.50] [--certificate 0x…]
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { isChainKey } from '@flying-money/chains'
import { fileStore } from '@flying-money/client'
import type { Hex } from '@flying-money/core'
import { formatUnits, parseUnits } from 'viem'
import { keyFromEnv } from './keys.js'
import { runLiveDemo } from './live.js'

const root = join(import.meta.dirname, '..', '..', '..')
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'))
const argv = process.argv.slice(2)
const arg = (n: string) => {
  const i = argv.indexOf(n)
  return i >= 0 ? argv[i + 1] : undefined
}
const chain = arg('--chain') ?? 'arbitrum-sepolia'
if (!isChainKey(chain)) throw new Error(`unknown chain ${chain}`)
const payee = process.env.PAYEE_ADDRESS as Hex
if (!/^0x[0-9a-fA-F]{40}$/.test(payee ?? '')) throw new Error('PAYEE_ADDRESS is not set')
const usd = (v: string) => formatUnits(BigInt(v), 6)

const done = await runLiveDemo({
  chain,
  funder: keyFromEnv('DEMO_FUNDER_KEY'),
  agent: keyFromEnv('DEMO_AGENT_KEY'),
  redeemer: keyFromEnv('REDEEMER_KEY'),
  payee,
  faceValue: parseUnits(arg('--face') ?? '0.50', 6),
  env: process.env,
  ...(arg('--certificate') ? { certificateId: arg('--certificate') as Hex } : {}),
  agentStore: fileStore(join(root, `.flying-money.${chain}.json`)),
  onEvent: (e) => {
    if (e.type === 'issued')
      console.log(`issued certificate ${e.certificateId} · ${usd(e.faceValue)} USDC · 7 days: ${e.txUrl}`)
    else if (e.type === 'step' || e.type === 'info') console.log(e.text)
    else if (e.type === 'sealed') console.log(`  402 → sealed note, cumulative ${usd(e.cumulative)}`)
    else if (e.type === 'redeemed')
      console.log(`REDEEMED on-chain ${usd(e.paid)} USDC (cumulative ${usd(e.cumulative)}): ${e.txUrl}`)
  },
})
console.log(
  `\ncalls ${done.calls} · served ${done.served} · consumed ${usd(done.consumed)} · redeemed ${usd(done.redeemed)} in ${done.redemptions} tx · remaining ${usd(done.remaining)} returns to the funder after expiry`,
)
process.exit(done.served >= 20 && done.redemptions >= 1 && done.redeemed === done.consumed ? 0 : 1)
