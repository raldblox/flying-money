---
title: Client SDK
description: "@flying-money/client: the buyer side. A fetch that pays with signed payment slips and a durable outbox."
---

# Client SDK (`@flying-money/client`)

The buyer side of the protocol (§6.6 of the spec). It wraps `fetch`, answers `402` offers with signed notes, and keeps a **durable outbox** so crashes and timeouts never make the agent owe more.

## `createFlyingMoneyClient(config)`

| Option | Type | |
|---|---|---|
| `chains` | `ChainKey[]` | Registry keys this agent may pay on, e.g. `['arbitrum-sepolia']` |
| `preferredChains` | `ChainKey[]` | Order to use when a seller accepts several chains |
| `spender` | `LocalAccount` | The agent's spending key (`privateKeyToAccount`) |
| `store` | `ClientStore` | `fileStore(path)` for agents; `memoryStore()` for tests |
| `certificates` | `Hex[]` | Certificate ids issued to this key |
| `maxPricePerRequest` | `bigint` | Refuse offers above this (base units) |
| `onPayment` | `(e) => void` | Called after each paid request (price, total, certificate) |
| `onEvent` | `(e) => void` | Every step: sealed, retry, receipt, rejected |
| `env` | `Record<string, string>` | `RPC_<CHAIN>` overrides |
| `retry` | `{ attempts, backoffMs }` | Resend policy for the same pending note |

Returns:

```ts
import type { CertificateStatus } from '@flying-money/client'

interface FlyingMoneyClient {
  fetch(input: string | URL, init?: RequestInit): Promise<Response>
  status(): CertificateStatus[] // face value, spent, credit, redeemed on-chain, remaining, expiry
  resolvePending(): Promise<void> // resend any saved note (runs on start)
  refresh(): Promise<void> // re-read certificates from the chain
  ready: Promise<void>
}
```

## Stores

- `fileStore(path)`: JSON file, written to a temp file, fsynced, then renamed over the old one. A crash leaves the old or the new state, never a torn file.
- `memoryStore()`: for tests and short scripts.

The store is the outbox of §6.6: a note is saved **before** it is sent, and resent byte for byte until the seller returns a final receipt.

## Counter payments (people & shops)

`@flying-money/client/counter` is the browser-safe wallet logic behind `/wallet`:

```ts
import {
  confirmCounterPayment,
  memoryCounterStore,
  prepareCounterPayment,
} from '@flying-money/client/counter'
```

`prepareCounterPayment` signs `max(accepted, consumed + price)` with `memo = keccak256(orderId)`, saves it, and returns the QR text. Until the customer confirms or abandons it, the same QR is shown again and other orders are refused (DECISIONS D20).

## CLI

```bash
npx @flying-money/client keygen --out .env   # writes AGENT_KEY, prints only the address
```
