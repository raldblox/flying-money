# 飛錢 Flying Money

**Payments that work without the internet.** *Give a budget. Not your wallet.*

Flying Money lets an owner set USDC aside for one seller, until an end date. The payer (an AI agent, a phone, soon a robot) holds only its own key, which holds no money, and pays with a signed slip of about 150 bytes carrying the running total. The slip travels by anything that can carry it: a QR code, a sound, a link, a file, HTTP 402 (and x402), or MCP. The seller checks it on the spot, with no internet needed, and for a budget it has checked once while online the payment is guaranteed, because the money is locked for that seller and can't be pulled back before the end date. Back online, the seller collects everything in one transaction; after the end date, the owner takes back what's left. No project token, no protocol fees (network gas still applies), no admin keys. MIT.

[Offline counter demo](https://useflyingmoney.vercel.app/demo/counter) · [Slip demo](https://useflyingmoney.vercel.app/demo/slip) · [Agent demo](https://useflyingmoney.vercel.app/demo) · [Get started](https://useflyingmoney.vercel.app/start) · [Docs](https://useflyingmoney.vercel.app/docs) · [Deployments](https://useflyingmoney.vercel.app/chains) · [Demo video (3 min)](https://youtu.be/nXiIVI49u2g)

> **Status:** unaudited, invariant-tested, test networks only. Live on the Arbitrum, Base, Ethereum and Tempo test networks.

## Try it in 5 minutes (no install)

1. **Pay with no internet.** Open the [offline counter](https://useflyingmoney.vercel.app/demo/counter) on a laptop (the till) and give your phone a small test budget by QR code. Put the phone in airplane mode and pay: the slip travels by QR code or sound, the till accepts it as guaranteed with no connection, and collects on-chain in one transaction once it's back online.
2. **Carry a slip between devices.** The [slip demo](https://useflyingmoney.vercel.app/demo/slip): our agent funds a 0.01 test budget and signs one slip; carry it to another device by QR, sound, share, link or file and spend it there for a 飛錢 certificate. Spend it twice and it's refused.
3. **Watch an agent pay an API.** Open the [live demo](https://useflyingmoney.vercel.app/demo) and press **Run it for real**. A scripted agent pays the Silk Road Oracle API 20 times from a 0.30 test-USDC budget on the test network you pick (Arbitrum, Base, Ethereum or Tempo); every collection links to the explorer. Tick **Cut the network** or **Steal the agent key** first to watch payments continue during a seller RPC outage, and a thief get refused three ways.
4. **Read the contract.** Verified source on every network: [Arbitrum Sepolia](https://arbitrum-sepolia.blockscout.com/address/0xb9ae3158f9cA841d9Da3C3725014D8352ca967F2?tab=contract), [Base Sepolia](https://base-sepolia.blockscout.com/address/0xb9ae3158f9cA841d9Da3C3725014D8352ca967F2?tab=contract), [Ethereum Sepolia](https://eth-sepolia.blockscout.com/address/0x4c7cfbadadab3c394f10a9b00c6fbf2baa20c3e6?tab=contract), [Tempo testnet](https://explore.testnet.tempo.xyz/address/0xb9ae3158f9cA841d9Da3C3725014D8352ca967F2). No owner, no admin, no pause, no fee, no upgrade.
5. **Try it as a person or shop.** Open [Get started](https://useflyingmoney.vercel.app/start). Giving a budget needs a browser wallet on one of those test networks with test USDC ([Circle faucet](https://faucet.circle.com); on Tempo, the [Tempo faucet](https://docs.tempo.xyz/quickstart/faucet)) and a little gas. Then, in two windows of one browser: open the hand-over link in the [wallet](https://useflyingmoney.vercel.app/wallet) (no crypto wallet needed), [open a till](https://useflyingmoney.vercel.app/shop) for the same shop address, and pay with **Copy the code** instead of a camera.
6. **Connect an assistant.** [Connect an assistant](https://useflyingmoney.vercel.app/app/connect) gives one message for Claude, Cursor or any MCP client; the assistant follows [/agent.md](https://useflyingmoney.vercel.app/agent.md), asks you for a budget, and you approve it in Requests. The MCP server is on npm: `npx -y @flying-money/mcp`.

What is real and what isn't: the demo's buyer is scripted (not an autonomous AI), and its slips travel in-process to the seller; the transactions and test USDC are real. Testnet only, unaudited. Details: [security model and limits](docs/SECURITY.md).

## The idea in 30 seconds

1. **Fund.** Lock 5 USDC for **one seller**, spendable only by **one agent key**, until a date.
2. **Pay.** Every purchase is a signed slip over the running total, about 150 bytes, carried by any channel: QR, sound, link, file, HTTP 402.
3. **Check.** The seller checks the slip against funding it verified earlier and its own payment records, on the spot, with no internet needed. A purchase does not need its own blockchain transaction.
4. **Collect.** Before the end date, the seller collects the increase in the signed running total since its last collection. After the end date, the owner can take back the rest with one transaction.

In the code a budget is a *certificate* and a slip is a *note*. The same budgets work for people: a café tab, an allowance, a gift. The holder pays by showing a QR code at the counter. Offline acceptance requires previously verified funding and authoritative local payment records; collection still requires blockchain connectivity before expiry.

## Offline and local payments

A slip is about 150 bytes, so it travels by anything that can carry it, and the seller checks it the same way every time:

- **Face to face:** a phone held up to a till; each screen shows a code and reads the other's. Price, slip and receipt cross by themselves; the buyer enters a PIN. No internet on either side.
- **The local network:** a seller announces itself on a shop's or office's own Wi-Fi (mDNS, `_flying-money._tcp`); agents, phones and devices on the same network find it and pay it, with no internet and no registry (`announceSeller` in `@flying-money/server`, `discoverSellers` in `@flying-money/client/discover`, `fm_discover` in the MCP server).
- **QR code, sound and ultrasound, AirDrop / Quick Share, link, file, copy and paste**, and **HTTP 402 / x402 and MCP** for APIs and agents.
- **Next:** Bluetooth LE, NFC, MQTT, ROS 2, LoRa. The compact slip format and its frames already fit them ([protocol: Carriers](docs/site/protocol.md#carriers)).

What the guarantee covers offline, and what a network needs for local discovery: [Offline and local payments](docs/site/offline.md).

## Try it

```bash
git submodule update --init --recursive
pnpm install
pnpm dev                                                               # the site + the demo seller, packages rebuilt as you edit
pnpm dev:https                                                         # the same over HTTPS, for camera and microphone on a phone
pnpm verify                                                            # the full gate: lint, build, types, tests, secret scan
pnpm contracts:test                                                    # Foundry unit + invariant tests
pnpm --filter @flying-money/agent demo:local                           # agent ↔ Oracle on a local anvil
```

Requires Node 22+, pnpm 10 and (for contracts) Foundry. Keys only ever come from `.env` (git-ignored); see `.env.example`.

`pnpm dev` prints the addresses: the site on `localhost:3000` (and on your Wi-Fi address, for a phone), and the demo seller on `localhost:8787`, announced on the local network so an agent can find it with `fm_discover`. The local seller keeps its own records, never the hosted one's. Ctrl+C stops everything.

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

Twelve centuries later, agents, phones and machines are the new merchants. They need the same three properties: **prefunded, scoped, verifiable**, and a proof that can travel without the network: today that proof is a slip of about 150 bytes. [Read the story](docs/site/story.md) (sources: [Wikipedia](https://en.wikipedia.org/wiki/Flying_cash), [Britannica](https://www.britannica.com/topic/feiqian)).

## What offline means here

We started out building offline cash between strangers. Our own adversarial review proved software alone can't stop someone paying two offline strangers with the same money, so we removed it. A shop's till does keep accepting budgets it has already checked while offline, and says **Accepted at your own risk: not checked yet** for new ones. We only ship what the math guarantees.

## Status

Testnet, unaudited, invariant-tested (contract invariants I1–I7; off-chain C1 and S1–S4). Specification: [protocol](docs/site/protocol.md) and [contract](docs/site/contract.md). Security model and test evidence: [docs/SECURITY.md](docs/SECURITY.md). Design notes: [x402 and MPP comparison](docs/design/compatibility-x402-mpp.md).

## Contributing

Issues and pull requests are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Report security problems privately ([how](docs/SECURITY.md#reporting-a-vulnerability)). Using a coding agent? Point it at [AGENTS.md](AGENTS.md).

## License

MIT
