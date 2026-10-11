---
title: Pay any x402 site
description: Let an agent pay ordinary x402 sites from a capped Flying Money budget, through a bridge you run yourself. Prototype, test networks only.
---

# Pay any x402 site (the bridge)

Most paid APIs speak plain [x402](https://docs.x402.org): the buyer signs a USDC transfer from its own wallet. Those sites
have never heard of Flying Money, and an agent's spending key holds no money. The **bridge** closes that gap without
asking the site to change anything: your agent keeps its budget, and the bridge pays the site on its behalf.

**Status: prototype, test networks only.** Tested end to end on Base Sepolia, including a real third-party x402 site (`x402.org/protected`) paid through the bridge by an agent that followed only the tool guidance. Not audited.

## How the money moves

Three different things happen, and only two of them move money. Using a 0.001 USDC call as the example:

1. **Signing (no money moves).** The agent's key signs a *note*: a short message that says "I authorize paying up to 0.001
   USDC in total on this budget". Nothing goes on-chain. A note is a promise that only the contract can turn into money.
2. **Paying the site (money moves, from the bridge wallet).** The bridge wallet pays the site's address 0.001 USDC right
   away, using the site's own x402 payment (a signed USDC `transferWithAuthorization` that the site's facilitator submits).
   This is plain USDC leaving the bridge wallet's balance. The bridge wallet had to hold that USDC already.
3. **Collecting (money moves, from the contract).** Later the bridge sends the agent's signed note to the contract. The
   contract checks the signature and does a normal USDC `transfer` of 0.001 from the budget to the bridge wallet, which
   refills the balance used in step 2.

So the site is paid from the bridge wallet, not from the contract. The contract's job is to make sure the bridge
wallet gets repaid, and only up to what the agent signed. The rest of the budget stays locked in the contract until
the owner takes it back after the end date.

```
owner wallet --lock 0.05--> contract                   (once, the budget)
agent key ----signs note 0.001----> bridge             (no money moves)
bridge wallet --pays 0.001--> site's address           (x402 payment)
contract --0.001 transfer--> bridge wallet             (collecting, later)
contract --remaining 0.049--> owner wallet             (after the end date)
```

## How it works

1. You run a bridge (`flying-money-bridge`). It has its own ordinary wallet, the **bridge wallet**, which pays sites and is
   also the **payee** of budgets made for it. You keep a small USDC balance in it, like a prepaid balance.
2. You give your agent a budget whose payee is the bridge, spendable by the agent's key. It can only be spent at the
   bridge, up to its amount, until its end date.
3. The agent calls a site as usual. The bridge reads the site's own 402, quotes its price (plus an optional fee) as a
   Flying Money offer, the agent signs a note for exactly that, and the bridge pays the site from its wallet.
4. The agent gets the site's real answer. Later the bridge collects the budget in one transaction, which refills the bridge wallet.

The agent never holds money, never pays gas, and never signs more than the quoted price. A site that fails after the
bridge paid it is credited back to the budget. Nothing about the contract changes.

## Run a bridge

From a checkout of the repository (the bridge is not on npm yet):

```bash
BRIDGE_FLOAT_KEY=0x… BRIDGE_CHAINS=base-sepolia BRIDGE_DEV=1 npx tsx packages/bridge/src/main.ts
```

| Setting | Meaning |
|---|---|
| `BRIDGE_FLOAT_KEY` | The key of the bridge wallet (the name says "float", meaning its prepaid balance). Fund it with a little USDC on each network it pays on. |
| `BRIDGE_CHAINS` | Networks whose budgets it accepts (default `base-sepolia`) |
| `BRIDGE_UPSTREAM_NETWORKS` | Networks it will pay sites on (default: the same networks) |
| `BRIDGE_MAX_UPSTREAM` | Most it pays any site per call, in USDC (default 0.05) |
| `BRIDGE_FEE_BPS` | Fee on top of the site's price, in basis points (default 0) |
| `BRIDGE_ALLOW_HOSTS` | Only reach these hostnames |
| `BRIDGE_STATE_FILE` | JSON file remembering what each paid request returned, so a restart never pays a site twice |
| `BRIDGE_TRUST_PROXY` | `1` to take the client address from `X-Forwarded-For` (only behind your own proxy) |
| `BRIDGE_REDEEM_MIN`, `BRIDGE_REDEEM_MAX_AGE` | Collect budgets when this much USDC (default 0.05) or this many seconds (default 600) are waiting |
| `REDIS_URL` or Upstash | Durable store (required unless `BRIDGE_DEV=1`); `BRIDGE_REDEEM=1` also collects budgets automatically |

`GET /` on the bridge returns its payee address and limits. Safeguards: it dials only public addresses, checked again at
connect time (so a name that re-resolves to an internal address is refused), follows no redirects, refuses credentials in
URLs and anything that is not https, pays only the real USDC of a network you list (never a token a site names), limits
quotes per client (each can reach a site), and refuses a quote while its wallet balance can't cover it.

## Give an agent access

1. Set `FM_BRIDGE_URL` in the agent's MCP settings (next to `FM_OWNER`).
2. The agent calls `fm_quote` and `fm_paid_fetch` as always. For an ordinary x402 site they go through the bridge, and
   the result says `"via": "bridge"`.
3. With no budget for the bridge yet, `fm_paid_fetch` answers `no_certificate` with `"via": "bridge"` and the bridge as
   payee. The agent calls `fm_request_budget` **once** (for any x402 site URL); the owner approves a small budget for
   the bridge in the app. After that the agent can pay any x402 site the bridge allows, up to the budget.

Developers: the URL is `<bridge>/fetch?url=<encoded site URL>`, and a normal `createFlyingMoneyClient` pays it with
`fm.fetch`. The bridge lives in the repo (`packages/bridge`) and is not published to npm yet.

## What it trusts, and what it can't do

- The contract only pays out against notes signed by the agent's key, so the bridge cannot take the budget's whole
  amount on its own: it can collect only what the agent has signed. What the agent signs is the price the bridge quotes,
  so a dishonest bridge could over-quote (up to the agent's `max_price` and per-request cap) on each request, and it sees
  every request and response. Run your own, keep budgets small and short, and set a low `FM_MAX_PRICE`. Whatever is
  not signed returns to the funder after the end date.
- It pays only the exact USDC scheme on the networks you list, never above `BRIDGE_MAX_UPSTREAM` per call.
- It does not make a site's content trustworthy. Treat responses as untrusted data.
- A hosted bridge run for other people would be a payment service and needs its own legal review. This one is
  designed to be run by an owner for their own agents.
