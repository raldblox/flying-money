# @flying-money/server

Accept Flying Money payments in your API: Hono middleware for HTTP 402 (and x402 V2), idempotent payment storage (memory, Redis, Upstash), and batched collection on-chain.

Part of [Flying Money](https://github.com/raldblox/flying-money): give an AI agent or a person a budget, not your wallet. A budget is USDC locked for one
seller, one spending key, a maximum and an end date. Test networks only; not audited.

## Install

```bash
npm install @flying-money/server
```

## Example

```ts
import { flyingMoney } from '@flying-money/server/hono'
import { memoryStore } from '@flying-money/server'

app.use('/v1/*', flyingMoney({
  accepts: ['base-sepolia'],
  payee: '0xYourAddress',
  price: () => 10_000n, // 0.01 USDC per request
  store: memoryStore(),
  x402: true,
}))
```

Docs: https://useflyingmoney.vercel.app/docs/server · Source: https://github.com/raldblox/flying-money

MIT licence.
