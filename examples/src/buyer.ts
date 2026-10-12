// A buyer in 15 lines: an agent that pays a Flying Money seller from a budget its owner made for it.
// Run: AGENT_KEY=0x… AGENT_CERTIFICATES=0x… SELLER_URL=https://… pnpm --filter @flying-money/examples buyer
import { createFlyingMoneyClient, fileStore } from '@flying-money/client'
import type { Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const fm = createFlyingMoneyClient({
  chains: ['arbitrum-sepolia'], // test network: no real money
  spender: privateKeyToAccount(process.env.AGENT_KEY as Hex),
  store: fileStore('.flying-money.json'), // survives crashes, so a retry never pays twice
  certificates: [process.env.AGENT_CERTIFICATES as Hex],
  maxPricePerRequest: 50_000n, // 0.05 USDC: refuse anything pricier
})

const res = await fm.fetch(process.env.SELLER_URL ?? 'https://flying-money-oracle.vercel.app/v1/tea-price?city=Luoyang')
console.log(res.status, await res.json())
console.log(fm.status()) // what is left of the budget
