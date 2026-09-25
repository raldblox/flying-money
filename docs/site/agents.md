---
title: Quickstart for agents
description: Pay a Flying Money API from an AI agent in a few lines.
---

# Give your agent a budget it can't raise

Your owner funds a budget in USDC for one service. Your agent gets its own spending key, which holds no money and pays no gas. Each paid request carries a signed payment slip with the running total ("total so far: 0.37"), the service checks it in milliseconds, and collects later in one transaction. Only the owner can fund or top up a budget.

- **Capped.** A stolen agent key can spend at most what's left, at that one service.
- **Crash-safe.** A timeout never raises what the agent owes. It resends the same slip; it never signs a higher one.
- **Standard.** Plain HTTP 402 "Payment Required", a TypeScript SDK and an MCP server.

## 1. Make a spending key where the agent runs

```bash
npx @flying-money/client keygen --out .env
```

This writes `AGENT_KEY=…` to `.env` and prints only the address. The key holds no money, so a leak can cost at most the remaining value of the certificates issued to it, at those sellers only.

## 2. Ask a funder for a certificate

The funder opens the Counting House (`/app`), picks the seller, pastes the agent's address as "who can spend", and sets a budget and an end date. They send you the certificate id (`0x…`, 32 bytes).

## 3. Pay with `fetch`

```ts
import { createFlyingMoneyClient, fileStore } from '@flying-money/client'
import type { Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const fm = createFlyingMoneyClient({
  chains: ['arbitrum-sepolia'],
  spender: privateKeyToAccount(process.env.AGENT_KEY as Hex),
  store: fileStore('.flying-money.json'), // durable outbox: survives crashes
  certificates: [process.env.AGENT_CERTIFICATES as Hex],
  maxPricePerRequest: 50_000n, // 0.05 USDC; refuse anything pricier
})

const res = await fm.fetch('https://oracle.example/v1/tea-price?city=Luoyang')
console.log(res.status, await res.json())
console.log(fm.status()) // remaining budget per certificate
```

`fm.fetch` behaves like `fetch`. When the server answers `402` with a `Flying-Money-Offer` header, the client signs a note for the price, saves it, and retries with a `Flying-Money-Note` header. You get the paid response.

## Rules the client follows (and your agent should too)

- **You can only pay the seller named on the certificate**, and never more than its face value in total.
- **A network failure never raises what you owe.** On a timeout the client resends the *same* note. It never signs a higher one because of a failure.
- **Never ask a user for their main wallet key.** Agents only ever need their own spending key.
- Amounts are integers in USDC base units (6 decimals): `10_000n` is 0.01 USDC.

## Errors you may see

| Error | Meaning |
|---|---|
| `NoCertificateError` | None of your certificates pays this seller on this chain, has enough left, or lives long enough |
| `PriceTooHighError` | The price is above `maxPricePerRequest` |
| `InsufficientBudgetError` | Paying would go past the certificate's face value |
| `PaymentRejectedError` | The seller refused the note without taking payment |
| `PendingUnresolvedError` | A previous note hasn't been confirmed yet; it will be resent, never re-signed |

**Using Claude or another MCP agent?** Skip the code: the [MCP server](/docs/mcp) gives it `fm_quote` and `fm_paid_fetch` tools with the same rules.

See also: [Client reference](/docs/client) · [Protocol](/docs/protocol) · [Guarantees](/docs/guarantees)
