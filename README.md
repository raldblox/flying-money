# 飛錢 Flying Money

Sealed spending certificates for AI agents, people and devices. Money that flies, since 804 CE.

[Live demo](https://useflyingmoney.vercel.app/demo) · [Docs](https://useflyingmoney.vercel.app/docs) · [Deployments on every chain](https://useflyingmoney.vercel.app/chains) · [Shop mode](https://useflyingmoney.vercel.app/shops) · 2-min video (coming)

> **Status:** unaudited, invariant-tested. Live on Arbitrum Sepolia (test money). Mainnets will run under immutable caps (100 USDC per certificate, 1,000 USDC per deployment).

## The idea in 30 seconds

1. **Issue.** Lock 5 USDC for **one seller**, spendable only by **one agent key**, until a date.
2. **Seal.** Every request carries a signed note over the running total: "total so far: 0.37".
3. **Serve.** The seller checks the note locally in milliseconds. No transaction, no waiting.
4. **Redeem.** The seller redeems the latest note in **one** transaction. Leftover funds return to the funder after expiry.

The same certificates work for people: a café tab, an allowance, a gift. The holder pays by showing a QR code at the counter, even when the shop's Wi‑Fi is down.

## Try it

```bash
pnpm install
pnpm build
pnpm --filter @flying-money/web exec next dev --webpack --port 3000   # the site, Counting House, demo, till, wallet
pnpm test                                                              # every package
pnpm contracts:test                                                    # Foundry unit + invariant tests
pnpm --filter @flying-money/agent demo:local                           # agent ↔ Oracle on a local anvil
```

Requires Node 22+, pnpm 10 and (for contracts) Foundry. Keys only ever come from `.env` (git-ignored); see `.env.example`.

## For agents (buyers)

```ts
import { createFlyingMoneyClient, fileStore } from '@flying-money/client'
import type { Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const fm = createFlyingMoneyClient({
  chains: ['arbitrum-sepolia'],
  spender: privateKeyToAccount(process.env.AGENT_KEY as Hex),
  store: fileStore('.flying-money.json'), // durable outbox
  certificates: [process.env.AGENT_CERTIFICATES as Hex],
  maxPricePerRequest: 50_000n, // 0.05 USDC
})
const res = await fm.fetch('https://oracle.example/v1/tea-price?city=Luoyang')
```

Make the key where the agent runs: `npx @flying-money/client keygen --out .env`. See [the agent quickstart](docs/site/agents.md).

## For APIs (sellers)

```ts
import { upstashStore } from '@flying-money/server'
import { flyingMoney } from '@flying-money/server/hono'
import { Hono } from 'hono'
import type { Hex } from 'viem'

const app = new Hono()
app.use(
  '/v1/*',
  flyingMoney({
    accepts: ['arbitrum-sepolia'],
    payee: process.env.PAYEE_ADDRESS as Hex,
    price: () => 10_000n, // 0.01 USDC per request
    store: upstashStore({
      url: process.env.UPSTASH_REDIS_REST_URL ?? '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
    }),
  }),
)
app.get('/v1/tea-price', (c) => c.json({ price: 42 }))
```

Collect with the redeemer (`startRedeemer`): one `redeemMany` for up to 20 notes. See [sellers](docs/site/server.md).

## Guarantees

| Party | Guarantee | Conditions |
|---|---|---|
| Payee | Every redeemable note is backed by funds reserved exclusively for it; redeeming pays exactly `cumulative − redeemed` | Redeems before expiry; token not frozen; chain live; its acceptance state is authoritative |
| Funder | Never loses more than the face value; gets the remainder back after expiry | — |
| Funder (spender key stolen) | Loss ≤ remaining face value of certificates bound to that key | — |
| Spender | Can't be charged more than the highest total it signed; retries never add charges; network failures never raise what it owes | Durable outbox; request-id idempotency |
| Everyone | Funds go only to the payee named at issuance | — |

**Not guaranteed:** that the seller delivers; that notes reach the seller. Full detail: [Guarantees](docs/site/guarantees.md) and [SECURITY.md](docs/SECURITY.md).

## How it's built

```
Funder wallet ──issue──▶ FlyingMoney.sol (escrow, one USDC per chain, no admin) ──redeem──▶ Payee
                               ▲                                                   │
Agent / wallet ──signed notes (HTTP header or QR)──▶ Seller (verifies locally) ─────┘
```

| Path | What |
|---|---|
| `contracts/` | `FlyingMoney.sol` (Solidity 0.8.24, OpenZeppelin 5.1.0), unit + invariant tests, deploy script |
| `packages/chains` | The only place for chain ids, RPCs, USDC addresses, explorers and caps |
| `packages/core` | Types, EIP-712, verification, the `fm1.` wire format |
| `packages/client` | Buyer SDK with a durable outbox; the counter wallet |
| `packages/server` | Seller SDK: middleware, Redis/Upstash stores, redeemer, the shop till |
| `apps/web` | Site, docs, Counting House, live demo, till and wallet (Next.js) |
| `apps/oracle` · `apps/agent` | The Silk Road Oracle (a paid API) and the Merchant agent that buys from it |

Gas (Arbitrum, measured): `redeem` 85,758; `redeemMany` of 10 notes 328,192.

## The story

In 804, merchants in Tang-dynasty China, short of copper coin, stopped carrying strings of cash. They deposited coin with an official office and carried a certificate instead, paid out when its tallies matched. People called it 飛錢, *flying money*. The value travelled; the coins stayed put.

Twelve centuries later, AI agents are the new merchants and APIs are the new cities. They need the same three properties: **prefunded, scoped, verifiable**. [Read the story](docs/site/story.md) (sources: [Wikipedia](https://en.wikipedia.org/wiki/Flying_cash), [Britannica](https://www.britannica.com/topic/feiqian)).

## Why no offline cash

We started out building offline cash between strangers. Our own adversarial review proved software alone can't stop someone paying two offline strangers with the same money, so we removed it. A shop's till does keep accepting certificates it has already checked while offline, and says **Unverified · merchant risk** for new ones. We only ship what the math guarantees.

## Status

Testnet, unaudited, invariant-tested (contract invariants I1–I7; off-chain C1 and S1–S4). Build log: [docs/STATUS.md](docs/STATUS.md). Decisions: [docs/DECISIONS.md](docs/DECISIONS.md). Spec: [docs/BUILD_SPEC.md](docs/BUILD_SPEC.md). For coding agents: [AGENTS.md](AGENTS.md).

## License

MIT
