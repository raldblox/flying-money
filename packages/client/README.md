# @flying-money/client

Pay HTTP 402 APIs from a capped USDC budget. `fetch` with payments built in, a crash-safe outbox (a retry never charges twice), and support for x402 sellers.

Part of [Flying Money](https://github.com/raldblox/flying-money): give an AI agent or a person a budget, not your wallet. A budget is USDC locked for one
seller, one spending key, a maximum and an end date. Live on test networks and, under immutable caps, on Arc mainnet; not audited.

## Install

```bash
npm install @flying-money/client
```

## Example

```ts
import { createFlyingMoneyClient, fileStore } from '@flying-money/client'
import { privateKeyToAccount } from 'viem/accounts'

const fm = createFlyingMoneyClient({
  chains: ['base-sepolia'],
  spender: privateKeyToAccount(process.env.AGENT_KEY),
  store: fileStore('.flying-money.json'),
  certificates: [process.env.BUDGET_ID],
  maxPricePerRequest: 50_000n, // 0.05 USDC
})
const res = await fm.fetch('https://flying-money-oracle.vercel.app/v1/tea-price?city=Luoyang')
```

Docs: https://useflyingmoney.vercel.app/docs/client · Source: https://github.com/raldblox/flying-money

MIT licence.
