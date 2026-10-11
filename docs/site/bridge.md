---
title: Pay any x402 site
description: Let an agent pay ordinary x402 sites from a capped Flying Money budget, through a bridge you run yourself. Prototype, test networks only.
---

# Pay any x402 site (the bridge)

Most paid APIs speak plain [x402](https://docs.x402.org): the buyer signs a USDC transfer from its own wallet. Those sites
have never heard of Flying Money, and an agent's spending key holds no money. The **bridge** closes that gap without
asking the site to change anything: your agent keeps its budget, and the bridge pays the site on its behalf.

**Status: prototype, test networks only.** Tested end to end on Base Sepolia, including a real third-party x402 site (`x402.org/protected`) paid through the bridge by an agent that followed only the tool guidance. Not audited.

## The hosted bridge (Base mainnet, beta)

There is a public bridge you can use without running anything: **`https://flying-money-bridge.vercel.app`**. It runs as
serverless functions with its state in Redis and a scheduled collector, on **Base mainnet with real USDC**, and it is **not
audited**. Its limits are small on purpose (at most 0.01 USDC per call; a 1% fee plus 0.0002 USDC per call; budgets need at
least 36 hours left). Its wallet is public, and `GET /status` and the [/bridge](/bridge) page show its balance, what it
has paid and collected, and fees. It describes itself to agents at `/skill.md`.

Use it by setting `FM_BRIDGE_URL=https://flying-money-bridge.vercel.app` and asking your owner for a small budget for its
wallet (see [Pay any x402 site](/docs/x402)). It is operated by the Flying Money project as a beta, with no uptime
promise. For anything that matters, run your own.

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
| `BRIDGE_FEE_FLAT` | Flat fee per call in USDC (default 0); it pays for collecting |
| `BRIDGE_REDEEMER_KEY` | Optional separate gas-only key that sends the collection transactions |
| `BRIDGE_ALLOW_HOSTS` | Only reach these hostnames |
| `BRIDGE_STATE_FILE` | JSON file remembering what each paid request returned, so a restart never pays a site twice |
| `BRIDGE_TRUST_PROXY` | `1` to take the client address from `X-Forwarded-For` (only behind your own proxy) |
| `BRIDGE_REDEEM_MIN`, `BRIDGE_REDEEM_MAX_AGE`, `BRIDGE_REDEEM_SAFETY` | Collect when this much USDC (default 1) is owed, or has waited this many seconds (default 86400), or a budget is this close to ending (default 21600 seconds) |
| `BRIDGE_NOTES_FILE` | Durable file for the notes the bridge has accepted (one self-hosted process). Required on a mainnet unless Redis or Upstash is set |
| `BRIDGE_LEDGER_FILE` | Activity log (one JSON line per payment or collection) behind `GET /status`, kept across restarts |
| `BRIDGE_LABEL` | The name shown on `/status` and on the app's bridge page |
| `REDIS_URL` or Upstash | Durable store (required unless `BRIDGE_DEV=1`); `BRIDGE_REDEEM=1` also collects budgets automatically |

`GET /` on the bridge returns its payee address and limits. Safeguards: it dials only public addresses, checked again at
connect time (so a name that re-resolves to an internal address is refused), follows no redirects, refuses credentials in
URLs and anything that is not https, pays only the real USDC of a network you list (never a token a site names), limits
quotes per client (each can reach a site), and refuses a quote while its wallet balance can't cover it.

## Liquidity: why the bridge wallet needs USDC

Yes: the bridge **pays the site first and collects from the contract later**, so its wallet must already hold USDC to
pay with. It also needs a little of the network's fee token (ETH on Base) to send the collection transactions.

- **How much:** at least what it pays out between collections. Example: at 0.001 USDC per call, 1,000 calls is 1 USDC. A
  quiet personal bridge needs a few USDC; set `BRIDGE_REDEEM_MIN` and `BRIDGE_REDEEM_MAX_AGE` so it collects often and
  the wallet refills.
- **What is at risk:** the bridge is repaid from a budget the owner already locked in the contract, up to what the agent
  signed, so a collected call costs it nothing. The risks are timing and forgetting: USDC it paid out but has not yet
  collected, and notes it never collects before the budget's end date (the money then returns to the owner and the bridge
  has paid for nothing). Collect before the end date.
- **When it runs short:** the bridge refuses a quote it can't fund, before the agent signs anything, and `GET /status`
  reports `health: low` or `empty`.
- **No wallet balance needed?** A bridge could collect first and pay after, but that costs a collection transaction per
  call. This prototype keeps a balance instead.

## Costs, fees and when it collects

Paying a site costs the bridge **no gas**: the site's own payment processor submits the transfer. Only **collecting**
(the contract paying the bridge wallet) is an on-chain transaction the bridge pays for.

**Measured on Base mainnet** (one real collection, `0xb56e…c86db`): 80,826 gas, about 0.0000005 ETH, roughly
**0.1 cent**. It is a fixed cost per collection, not per call, because the agent's signed note is a running total: one
collection pays the bridge for every call made on that budget.

| Calls on a budget before it is collected | Collection cost per call (at 0.1 cent per collection) |
|---|---|
| 1 | 0.1 cent |
| 10 | 0.01 cent |
| 1,000 | 0.0001 cent |

So **collect rarely and in one go**. The defaults wait until a budget owes at least 1 USDC (`BRIDGE_REDEEM_MIN`), or a
day has passed (`BRIDGE_REDEEM_MAX_AGE`), or a budget is within 6 hours of ending (`BRIDGE_REDEEM_SAFETY`, so no budget
is ever missed). Up to 20 budgets are collected in one transaction. Collecting after every 0.001 USDC call would cost more
than the call earns, which is why it doesn't.

**Fees.** The bridge charges the site's price plus a fee you set: `BRIDGE_FEE_BPS` (a percentage, in basis points) and
`BRIDGE_FEE_FLAT` (USDC per call). The agent sees the total in the quote and signs only that. Pick a flat fee of at least
the collection cost divided by the calls you expect per collection (0.1 cent over 6 calls is about 0.017 cent, so
0.0002 USDC covers it), and a percentage for margin. The fee schedule and what the bridge has earned and spent on
collecting are public on `GET /status` and the [/bridge](/bridge) page.

## Business model

None is required to run a bridge for your own agents; the fee only has to cover collecting. If you want to run one as a
service, these are the honest options, none of which touch the contract (it has no protocol fee, owner or admin):

- **Per-call fee** (above): simple and visible. The bridge earns the difference between what the agent is charged and what
  the site was paid, and publishes it.
- **Credit packs or subscription:** the owner pre-funds budgets for a bridge in bigger blocks, and the operator
  charges outside the protocol for service tiers (higher limits, more sites, priority support).
- **Curated service:** an allowlist of vetted x402 sites, usage reports and alerts for owners.

What a service must not do: hold users' money (budgets stay in the contract until collected), hide fees (they are in every
quote and on `/status`), or quote above the agent's limit. **Running a bridge for other people makes you the payer of
record for their purchases, which can bring payment-service, tax and terms-of-service obligations that differ by place. Get
legal advice before offering a hosted bridge.**

## Where to run a bridge

The bridge is a small server, separate from the web app, because it holds a hot wallet key, keeps durable state (accepted
notes, outcomes, a log) and must keep collecting on schedule. Running it inside the public app would put those keys and
payments in the app's blast radius and under its deploy schedule.

| Where | Fit |
|---|---|
| Your own machine, a VM or a container | **Recommended for now.** One process, a durable file store (`BRIDGE_NOTES_FILE`, `BRIDGE_STATE_FILE`, `BRIDGE_LEDGER_FILE`), automatic collection. |
| A separate serverless project (Vercel) | **Built** (`apps/bridge`): the same code with Upstash Redis for state, a daily cron to collect, and a coalesced collection pass after each paid call. This is how the hosted beta runs. Needs `BRIDGE_FLOAT_KEY` (kept as a sensitive variable), the Redis variables, `CRON_SECRET`, and `FM_ENV=mainnet` with a prefix containing "mainnet". |
| Inside the web app | Not recommended: its keys, its deploys and its timeouts are the wrong home for money movement. |

## Security model

What protects the owner, the agent and the public:

- **Funds stay in the contract.** The bridge never holds an owner's money, only its own wallet balance. A budget pays only
  the bridge, only against notes the agent's key signed, and never more than its amount; the rest returns to the owner.
- **The agent signs only the quoted price**, and its own per-request limit and `max_price` always apply.
- **Keys:** the bridge wallet's key signs off-chain payments and need never send a transaction. Put collection gas on a
  separate key (`BRIDGE_REDEEMER_KEY`) and keep only a small USDC balance in the bridge wallet.
- **Outbound requests** go only to public addresses (checked again when connecting), never follow redirects, and never
  carry credentials; it pays only the real USDC of a network you list, up to `BRIDGE_MAX_UPSTREAM` per call.
- **Replay and restarts:** one payment per request id, and the stored outcome is replayed after a restart.
- **Abuse limits:** per-client quote rate limits; a quote the wallet can't fund is refused before any signing.
- **Everything is checkable:** the code is open, the contract source is verified, and `/status` plus the
  [/bridge](/bridge) page compare the bridge's claims with the chain.

What it does **not** protect against, stated plainly: the contract and the bridge are **not audited**; a dishonest
operator can over-quote up to the agent's limits and sees every request; the site's payment processor, your RPC
provider and the host machine are trusted; and a hot key can be stolen. The full threat table is in
[SECURITY.md](https://github.com/raldblox/flying-money/blob/main/docs/SECURITY.md).

## Check a bridge (transparency and monitoring)

Every bridge serves `GET /status` (public, read-only, no secrets): its wallet, the networks it pays on, its limits,
balances, a `liquidity` health (`ok`, `low`, `empty`), what the contract still owes it (`owedByContract`), totals paid
and collected, and the last 25 payments and collections with their transaction hashes. No agent address, note or request
content is included.

The app shows the same on a page anyone can open: **[/bridge](/bridge)** (`/bridge?url=<bridge address>`). It also reads
the bridge's wallet balance, the budgets made out to it and the collected totals **directly from the chain**, and warns
if the bridge's reported balance disagrees with the chain. Trust the chain over the bridge.

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
