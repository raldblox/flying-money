// Pay an ordinary x402 site (one that has never heard of Flying Money) through a bridge.
// Run: AGENT_KEY=0x… AGENT_CERTIFICATES=0x… BRIDGE_URL=http://127.0.0.1:8790 SITE_URL=https://… pnpm --filter @flying-money/examples bridge-buyer
import { createFlyingMoneyClient, fileStore } from '@flying-money/client'
import type { Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const bridge = process.env.BRIDGE_URL ?? 'http://127.0.0.1:8790' // GET <bridge>/ shows its payee and limits
const fm = createFlyingMoneyClient({
  chains: ['base-sepolia'],
  spender: privateKeyToAccount(process.env.AGENT_KEY as Hex),
  store: fileStore('.flying-money.json'),
  certificates: [process.env.AGENT_CERTIFICATES as Hex], // a budget whose payee is the bridge
  maxPricePerRequest: 50_000n,
})

const site = encodeURIComponent(process.env.SITE_URL as string)
const res = await fm.fetch(`${bridge}/fetch?url=${site}`)
console.log(res.status, await res.text())
