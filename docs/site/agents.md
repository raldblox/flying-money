---
title: Agents
description: Connect an AI assistant with one message, or pay a Flying Money API from your own agent in a few lines.
---

# Give your agent a budget it can't raise

Your owner funds a budget in USDC for one service. Your agent gets its own spending key, which holds no money and pays no network fee. Each paid request carries a signed payment slip with the running total, the service checks it in milliseconds, and collects later in one transaction. Only the owner can fund or top up a budget.

## Using Claude, Cursor or another assistant? One message

Open [Connect an assistant](/app/connect), copy the message, and send it to your assistant:

> Set up Flying Money payments for me. Read https://useflyingmoney.vercel.app/agent.md and follow it. My wallet is 0x…

The assistant reads [/agent.md](/agent.md), adds the MCP server (which makes its own spending key), tells you its spending address, and asks you for a budget when a paid service needs one. You approve in [Requests](/app/requests). Nothing to run in a terminal.

## Building your own agent

The rest of this page is for developers using the TypeScript SDK directly.

- **Capped.** A stolen agent key can spend at most what's left, at that one service.
- **Crash-safe.** A timeout never raises what the agent owes. It resends the same slip; it never signs a higher one.
- **Standard.** Plain HTTP 402 "Payment Required", a TypeScript SDK and an MCP server.

### 1. Make a spending key where the agent runs

```bash
npx @flying-money/client keygen --out .env
```

This writes `AGENT_KEY=…` to `.env` and prints only the address. The key holds no money, so a leak can cost at most what's left on the budgets given to it, at those sellers only.

### 2. Ask your owner for a budget

Your owner opens [Fund an agent](/app/give?for=agent), picks the seller, pastes the agent's address as who can spend, and sets an amount and an end date. They send you the budget id (`0x…`, 32 bytes; the SDK calls it a certificate). Or configure `owner` and call `requestBudget` to ask for one.

### 3. Pay with `fetch`

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

const res = await fm.fetch('https://flying-money-oracle.vercel.app/v1/tea-price?city=Luoyang')
console.log(res.status, await res.json())
console.log(fm.status()) // remaining budget per certificate
```

`fm.fetch` behaves like `fetch`. When the server answers `402` with a `Flying-Money-Offer` header, the client signs a payment slip for the price, saves it, and retries with a `Flying-Money-Note` header. You get the paid response.

## Rules the client follows (and your agent should too)

- **You can only pay the seller named on the budget**, and never more than its amount in total.
- **A network failure never raises what you owe.** On a timeout the client resends the *same* slip. It never signs a higher one because of a failure.
- **Never ask a user for their main wallet key.** Agents only ever need their own spending key.
- Amounts are integers in USDC base units (6 decimals): `10_000n` is 0.01 USDC.

## Errors you may see

| Error | Meaning |
|---|---|
| `NoCertificateError` | None of your budgets pays this seller on this network, has enough left, or lasts long enough |
| `PriceTooHighError` | The price is above `maxPricePerRequest` |
| `InsufficientBudgetError` | Paying would go past the budget's amount |
| `PaymentRejectedError` | The seller refused the slip without taking payment |
| `PendingUnresolvedError` | A previous slip hasn't been confirmed yet; it will be resent, never re-signed |

## Error codes

Every SDK error has a stable `code` and a `docUrl` pointing here.

### no_certificate
None of your budgets pays this seller on this chain, has enough left, or lasts long enough. With an owner configured, ask for one (`requestBudget`, or `fm_request_budget` in MCP).

### price_too_high
The price is above your ceiling: `maxPricePerRequest`, or this call's own `maxPrice`. Nothing was signed.

### insufficient_budget
Paying would go past the budget's amount. Ask your owner to top it up.

### payment_rejected
The seller refused the slip without taking payment. Nothing is owed for it.

### pending_unresolved
A previous slip hasn't been confirmed yet. It will be resent as is, never re-signed.

**Using Claude or another MCP agent?** Skip the code: [Connect an assistant](/app/connect), or see the [MCP server](/docs/mcp) reference.

See also: [Client reference](/docs/client) · [Protocol](/docs/protocol) · [Guarantees](/docs/guarantees)
