---
title: Server SDK (sellers)
description: Accept Flying Money notes on any HTTP API with one middleware, and collect them with the redeemer.
---

# Server SDK (`@flying-money/server`)

The seller side (§6.5). Put the middleware in front of paid routes; run the redeemer to collect.

## Hono middleware

```ts
import { upstashStore } from '@flying-money/server'
import { flyingMoney } from '@flying-money/server/hono'
import { Hono } from 'hono'
import type { Hex } from 'viem'

const app = new Hono()
const paid = flyingMoney({
  accepts: ['arbitrum-sepolia'],
  payee: process.env.PAYEE_ADDRESS as Hex,
  price: () => 10_000n, // 0.01 USDC per request
  store: upstashStore({
    url: process.env.UPSTASH_REDIS_REST_URL ?? '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
  }),
})
app.use('/v1/*', paid)
app.get('/v1/tea-price', (c) => c.json({ price: 42, requestId: c.get('flyingMoney').requestId }))
```

What the middleware does for every paid request:

1. No note → `402` with a `Flying-Money-Offer` header (price, chains, contract, token, payee).
2. Parses the note, checks the chain and contract, reads the certificate (cached), checks payee, lifetime, signature and face value.
3. A `requestId` it has seen returns the stored outcome (replays are never charged twice, S1).
4. Reserves the price atomically against the best note it holds (concurrent requests can't overspend, S4).
5. Runs your handler. A response with status ≥ 400 counts as a failed service: the price becomes **credit** for the buyer (S3).
6. Adds a `Flying-Money-Receipt` header with accepted / consumed / credit / remaining.

**Your handler must be idempotent on `requestId`** (`c.get('flyingMoney').requestId`). For side effects, use `createIdempotency()`.

## Stores

The store is the seller's authoritative ledger. It must be durable.

| Store | Use |
|---|---|
| `upstashStore({ url, token })` | Serverless (Vercel), over HTTPS; Lua scripts make `begin`/`finish` atomic |
| `redisStore(url)` | Any Redis over TCP |
| `memoryStore()` | Tests and demos only; `onCommit` persists snapshots (the shop till uses IndexedDB) |

## Redeemer

```ts
import { redisStore, startRedeemer } from '@flying-money/server'
import type { Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const redeemer = startRedeemer({
  chains: ['arbitrum-sepolia'],
  store: redisStore(process.env.REDIS_URL ?? 'redis://localhost:6379'),
  redeemerAccount: privateKeyToAccount(process.env.REDEEMER_KEY as Hex), // needs gas only
  policy: { minAmount: 100_000n, maxAgeSeconds: 3_600, safetyBeforeExpiry: 1_800 },
  intervalMs: 60_000,
})
```

It redeems **only served value**, batches up to 20 notes into one `redeemMany`, records the transaction hash before broadcasting, and never rebroadcasts. Anyone may send the transaction; the money always goes to the payee.

## Discovery

Sellers should serve `/.well-known/flying-money.json` with their `accepts[]` and price table, so agents can see prices without a 402 round trip. The Silk Road Oracle (`apps/oracle`) is a complete example, with `/openapi.json`.
