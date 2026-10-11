// A stranger's ordinary x402 endpoint on Base Sepolia (no Flying Money anywhere), for tester agents.
//   pnpm --filter @flying-money/bridge exec tsx spike/stranger.ts      (port 8791; prints the URL and its payTo address)
import { serve } from '@hono/node-server'
import { HTTPFacilitatorClient } from '@x402/core/server'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import { paymentMiddleware, x402ResourceServer } from '@x402/hono'
import { Hono } from 'hono'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const payTo = privateKeyToAccount(generatePrivateKey()).address
const resource = new x402ResourceServer(
  new HTTPFacilitatorClient({ url: process.env.X402_FACILITATOR ?? 'https://x402.org/facilitator' }),
).register('eip155:84532', new ExactEvmScheme())
const app = new Hono()
app.use(
  paymentMiddleware(
    {
      'GET /premium': {
        accepts: { scheme: 'exact', price: '$0.001', network: 'eip155:84532', payTo },
        description: 'A premium fact',
      },
    },
    resource,
  ),
)
app.get('/premium', (c) =>
  c.json({
    fact: 'In 804 Tang merchants left money with an agent and carried home a certificate.',
    source: 'stranger x402 site',
  }),
)
const port = Number(process.env.PORT ?? 8791)
serve({ fetch: app.fetch, port, hostname: '127.0.0.1' })
console.log(`stranger x402 site: http://127.0.0.1:${port}/premium  (0.001 USDC, pays ${payTo})`)
