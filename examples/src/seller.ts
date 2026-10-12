// A seller in 20 lines: charge 0.01 USDC per call, paid from a budget made for PAYEE_ADDRESS.
// Run: PAYEE_ADDRESS=0x… pnpm --filter @flying-money/examples seller

import { memoryStore } from '@flying-money/server'
import { flyingMoney } from '@flying-money/server/hono'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { Hex } from 'viem'

const app = new Hono()
const paid = flyingMoney({
  accepts: ['arbitrum-sepolia'],
  payee: process.env.PAYEE_ADDRESS as Hex,
  price: () => 10_000n, // 0.01 USDC
  store: memoryStore(), // use upstashStore or redisStore in production
})
app.use('/v1/*', paid)
app.get('/v1/hello', (c) => c.json({ hello: 'paid world', requestId: c.get('flyingMoney').requestId }))
serve({ fetch: app.fetch, port: 8787 })
console.log('seller on http://127.0.0.1:8787/v1/hello')
