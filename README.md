# 飛錢 Flying Money

**Give a budget. Not your wallet.** Prepaid, capped USDC budgets for AI agents and the people you pay for.

Flying Money lets an owner set aside USDC for one seller, one spender and one end date. The spender (an AI agent or a phone) pays with signed slips carrying the running total. After verifying funding, the seller checks slips against its local payment records and collects accrued spending on-chain before expiry, without a blockchain transaction for every purchase. The spender can't authorize more than the budget, the money can only reach the named seller, and the owner can reclaim the remainder on-chain after expiry. No project token, no protocol fees (network gas still applies), no admin keys. MIT.

[Live demo](https://useflyingmoney.vercel.app/demo) · [Get started](https://useflyingmoney.vercel.app/start) · [Docs](https://useflyingmoney.vercel.app/docs) · [Deployments](https://useflyingmoney.vercel.app/chains) · [Demo video (3 min)](https://youtu.be/nXiIVI49u2g)

> **Status:** unaudited, invariant-tested, test networks only. Live on the Arbitrum, Base, Ethereum and Tempo test networks.

## Try it in 5 minutes (no install)

1. **Watch a real run.** Open the [live demo](https://useflyingmoney.vercel.app/demo) and press **Run it for real**. A scripted agent pays the Silk Road Oracle API 20 times from a 0.30 test-USDC budget on the test network you pick (Arbitrum, Base, Ethereum or Tempo); every collection links to the explorer. Tick **Cut the network** or **Steal the agent key** first to watch payments continue during a seller RPC outage, and a thief get refused three ways.
2. **Read the contract.** Verified source on every network: [Arbitrum Sepolia](https://arbitrum-sepolia.blockscout.com/address/0xb9ae3158f9cA841d9Da3C3725014D8352ca967F2?tab=contract), [Base Sepolia](https://base-sepolia.blockscout.com/address/0xb9ae3158f9cA841d9Da3C3725014D8352ca967F2?tab=contract), [Ethereum Sepolia](https://eth-sepolia.blockscout.com/address/0x4c7cfbadadab3c394f10a9b00c6fbf2baa20c3e6?tab=contract), [Tempo testnet](https://explore.testnet.tempo.xyz/address/0xb9ae3158f9cA841d9Da3C3725014D8352ca967F2). No owner, no admin, no pause, no fee, no upgrade.
3. **Try it as a person or shop.** Open [Get started](https://useflyingmoney.vercel.app/start). Giving a budget needs a browser wallet on one of those test networks with test USDC ([Circle faucet](https://faucet.circle.com); on Tempo, the [Tempo faucet](https://docs.tempo.xyz/quickstart/faucet)) and a little gas. Then, in two windows of one browser: open the hand-over link in the [wallet](https://useflyingmoney.vercel.app/wallet) (no crypto wallet needed), [open a till](https://useflyingmoney.vercel.app/shop) for the same shop address, and pay with **Copy the code** instead of a camera.
4. **Connect an assistant.** [Connect an assistant](https://useflyingmoney.vercel.app/app/connect) gives one message for Claude, Cursor or any MCP client; the assistant follows [/agent.md](https://useflyingmoney.vercel.app/agent.md), asks you for a budget, and you approve it in Requests. The MCP server is on npm: `npx -y @flying-money/mcp`.

What is real and what isn't: the demo's buyer is scripted (not an autonomous AI), and its slips travel in-process to the seller; the transactions and test USDC are real. Testnet only, unaudited. Details: [security model and limits](docs/SECURITY.md).

## The idea in 30 seconds

1. **Fund.** Lock 5 USDC for **one seller**, spendable only by **one agent key**, until a date.
2. **Pay.** Every request carries a signed payment slip over the running total.
3. **Serve.** The seller checks the slip against previously verified funding and its own payment records. A purchase does not need its own blockchain transaction.
4. **Collect.** Before the end date, the seller collects the increase in the signed running total since its last collection. After the end date, the owner can take back the rest with one transaction.

In the code a budget is a *certificate* and a slip is a *note*. The same budgets work for people: a café tab, an allowance, a gift. The holder pays by showing a QR code at the counter. Offline acceptance requires previously verified funding and authoritative local payment records; collection still requires blockchain connectivity before expiry.

## Try it

```bash
git submodule update --init --recursive
pnpm install
pnpm build
pnpm --filter @flying-money/web exec next dev --webpack --port 3000   # the site, account app, demo, till, wallet
pnpm verify                                                            # the full gate: lint, build, types, tests, secret scan
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

Install with `npm install @flying-money/client viem`. Make the key where the agent runs: `npx @flying-money/client keygen --out .env`. Never share or commit the generated file. See [the agent quickstart](docs/site/agents.md).

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

**x402 V2.** Add `x402: true` and the same middleware also speaks [x402](https://docs.x402.org): every 402 carries a standard `PAYMENT-REQUIRED` header with the [`flying-money` scheme](docs/design/x402-flying-money-scheme.md), and slips arriving in `PAYMENT-SIGNATURE` pass exactly the same checks. The buyer SDK and MCP server pay x402-only sellers too. It's live on the demo seller.

## Guarantees

| Party | Guarantee | Conditions |
|---|---|---|
| Payee | Every redeemable note is backed by funds reserved exclusively for it; redeeming pays exactly `cumulative − redeemed` | Redeems before expiry; token not frozen; chain live; its acceptance state is authoritative |
| Funder | Spending is bounded by the face value; can reclaim the remainder after expiry | Successful on-chain reclaim; chain live; token not frozen; gas required |
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
| `apps/web` | Site, docs, account app, live demo, till and wallet (Next.js) |
| `apps/oracle` · `apps/agent` | The Silk Road Oracle (a paid API) and the Merchant agent that buys from it |

Gas (measured on an EVM test network): `redeem` 85,758; `redeemMany` of 10 notes 328,192.

## The story

In 804, merchants in Tang-dynasty China, short of copper coin, stopped carrying strings of cash. They deposited coin with an official office and carried a certificate instead, paid out when its tallies matched. People called it 飛錢, *flying money*. The value travelled; the coins stayed put.

Twelve centuries later, AI agents are the new merchants and APIs are the new cities. They need the same three properties: **prefunded, scoped, verifiable**. [Read the story](docs/site/story.md) (sources: [Wikipedia](https://en.wikipedia.org/wiki/Flying_cash), [Britannica](https://www.britannica.com/topic/feiqian)).

## Why no offline cash

We started out building offline cash between strangers. Our own adversarial review proved software alone can't stop someone paying two offline strangers with the same money, so we removed it. A shop's till does keep accepting budgets it has already checked while offline, and says **Accepted at your own risk: not checked yet** for new ones. We only ship what the math guarantees.

## Status

Testnet, unaudited, invariant-tested (contract invariants I1–I7; off-chain C1 and S1–S4). Specification: [protocol](docs/site/protocol.md) and [contract](docs/site/contract.md). Security model and test evidence: [docs/SECURITY.md](docs/SECURITY.md). Design notes: [x402 and MPP comparison](docs/design/compatibility-x402-mpp.md).

## Contributing

Issues and pull requests are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Report security problems privately ([how](docs/SECURITY.md#reporting-a-vulnerability)). Using a coding agent? Point it at [AGENTS.md](AGENTS.md).

## License

MIT
