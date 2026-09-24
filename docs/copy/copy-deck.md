# Flying Money copy deck

Version 1 · 24 Sep 2026 · Status: proposed, for founder review. Nothing here changes code names, contracts or protocol.

**How to use this file.** Every block is ready to paste. Square brackets like `[amount]` are variables. Lines marked
*(note)* are for us, not for the page.

**Rules this deck follows.**
- Only three safety claims, never stronger: (a) every valid payment is backed by money set aside for that seller
  until the end date; (b) the spender can't authorize more than the budget; (c) anyone can submit a payment for
  collection, but the money only reaches the named seller.
- People & shops screens use Giver / Holder / Place / Certificate / Give / Collect / Take back leftovers / Ask.
  Agent screens use Owner / Agent / Service / Budget / Fund / Collect / Budget request. Never both on one screen.
- "Digital dollars (USDC)" once per page, then "USDC".
- No event names in site copy. The only place an event appears is the form in section 7, where the form asks.

---

## 1. Positioning

### One sentence per audience

| Audience | Positioning sentence |
|---|---|
| Consumers (parents, gift givers, regulars) | Load money for one place, like a school canteen or your usual café, with a limit and an end date; they pay with their phone, and whatever they don't spend comes back to you. |
| Shops (cafés, canteens, stalls, suppliers) | Take prepaid payments at the counter by QR code, checked on the spot even when your Wi‑Fi is down for regulars, and collect the whole day's takings in one transfer. |
| Developers and agent builders | Let your AI agent pay per request from a budget you set, for one API, that it can't raise or spend past, with a drop-in `fetch`, an SDK for sellers and an MCP server for Claude. |
| Investors | Flying Money is open-source payment rails for spending on someone else's behalf, starting with AI agents buying API calls for fractions of a cent, where cards are too risky and paying on the blockchain per call is too slow. |
| Innovators and partners | One small contract and SDK that turns any stablecoin chain into prepaid, capped tabs: build agent budgets, allowances, canteen cards or supplier deposits on it without asking us. |

### Master tagline candidates (ranked)

1. **Hand over a budget, not your wallet.**
   It names the fear everyone already has (giving an agent, a kid or an employee your card) and the fix, in six
   words that work for both audiences.
2. **Prepay once. Pay per use. Never past the limit.**
   It describes the whole product in three beats; slightly longer, and less emotional.
3. **Spending money with a limit that holds.**
   Plain and true for kids, staff and agents; weaker on what makes it different.
4. **Let it spend. Set the limit.**
   Short and punchy, but "it" needs the page around it to make sense.
5. **Money for one place, one person, one end date.**
   Precise, and good as a subline, but it reads like a spec, not a promise.

**Recommended: "Hand over a budget, not your wallet."** Use #2 as the supporting line wherever there is room
(README, deck title slide, social cards).

*(note)* This replaces "Give your AI agent a sealed certificate, not your wallet." The structure that worked (X, not
your wallet) is kept; the unfamiliar noun is replaced with the one everyone already uses: budget.

---

## 2. Landing page (`/`)

*(note)* The hero toggle swaps the H1, sub, visual, **and** the "Problem" and "How it works" sections below it, so
no screen shows both vocabularies. Default door: **For AI agents**. Remember the choice in localStorage.

### Hero

- **Eyebrow:** `FLYING MONEY · OPEN SOURCE · TEST NETWORK`
- **Toggle labels:** `For AI agents` · `For families & shops`

**Door A: For AI agents (default)**
- **H1:** Let your AI agent pay for what it uses. Never more than you allow.
- **Sub:** Set a budget in digital dollars (USDC) for one API or service. Your agent pays per request, the service
  checks each payment on the spot, and collects the total later in one transaction. The agent can't raise its budget
  or spend past it, even if its key is stolen. Whatever's left comes back to you.
- **CTA 1 (primary):** `Watch an agent pay →` (→ /demo)
- **CTA 2 (secondary):** `Add it to your agent` (→ /docs/agents)

**Door B: For families & shops**
- **H1:** Lunch money that only works at the canteen.
- **Sub:** Load a certificate for one place (a canteen, a café, a supplier) with a limit and an end date. Your kid,
  employee or friend pays by showing a QR code on their phone. They don't need a crypto wallet and never pay a fee.
  Whatever they don't spend comes back to you.
- **CTA 1 (primary):** `See how a café uses it →` (→ /shops)
- **CTA 2 (secondary):** `Open a till for your shop` (→ /shop)

**Status line under the CTAs (both doors):**
Live on Arbitrum Sepolia with test money · Open source (MIT) · Not yet audited · [See networks →](/chains)

*(note)* The current line "Arbitrum · Monad · Arc · Base: the same certificates on every network" reads as live on
four networks. Only Arbitrum Sepolia is deployed today. Use the line above until more deployments exist.

**Hero visual caption (Door A):** Budget 5.00 USDC · Silk Road Oracle · Research agent · ends in 7 days
**Hero visual caption (Door B):** 20.00 USDC · Lantern Café · Mia · ends in 30 days

### Problem (swaps with the toggle)

**Door A: H2:** Your agent needs to pay. Every way to let it is bad.
- **Give it your card.** One bad loop or one prompt injection, and there's no ceiling on the bill.
- **Pay on the blockchain for every call.** Each payment waits for a transaction and costs more than the call itself.
- **Pay later on trust.** A seller has no reason to trust an agent it has never met.

Closing line: **Flying Money gives the agent a budget instead: one service, one amount, one end date.**

**Door B: H2:** Handing over money for one thing shouldn't mean handing over your card.
- **Cash** gets lost, spent elsewhere, and you never see where it went.
- **A spare card** works everywhere, so the limit is only a promise.
- **A shop's own prepaid card** means one plastic card, one app, one sign-up per shop.

Closing line: **Flying Money is money for one place, with a limit that holds, and leftovers that come back.**

### How it works (4 steps, swaps with the toggle)

**Door A: H2:** Four steps. The agent never touches your wallet.
1. **Fund.** Set aside 5 USDC for one service, spendable only by your agent's key, until a date you pick.
2. **Pay.** Every request carries a signed payment slip with the running total: "total so far: 0.37".
3. **Serve.** The service checks the slip on its own machine in milliseconds and answers. No transaction, no waiting.
4. **Collect.** The service collects the latest total in one transaction. After the end date, you take back the leftovers.

**Door B: H2:** Four steps. The holder never needs a crypto wallet.
1. **Give.** Choose the place, the amount and the end date. Send it to Mia as a link or a QR code.
2. **Pay.** At the counter, the till shows the price. Mia scans it, enters her PIN, and shows her payment code.
3. **Accept.** The till checks the code in milliseconds. It works for returning customers even when the shop's Wi‑Fi is down.
4. **Collect.** The shop collects the day's payments in one transfer. After the end date, you take back the leftovers.

### Trust (both doors)

**H2:** What's protected, and what isn't.

**Protected**
- The spender can't pay more than the budget. A stolen key can spend at most what's left, and only at that one place.
- Every valid payment slip is backed by money set aside for that seller until the end date.
- Anyone can submit a slip for collection, but the money only ever goes to the named seller.
- After the end date, whatever wasn't spent goes back to whoever put it in.

**Not protected**
- That the seller delivers what was paid for.
- That the seller collects before the end date. (Our seller software does this automatically.)
- That the USDC issuer never freezes funds.
- That the code is free of bugs. It is test software and has not been audited.

**Why there's no cancel button:** a shop can accept a payment on the spot, even offline, only because the money
can't be pulled back halfway through the month. You control where, how much and how long, and whether to renew.

Link: `Read the full guarantees →`

### Use cases

**H2:** One idea, many kinds of spending.
*(note)* Cards are self-contained scenarios, so no taxonomy words collide.

- **Research agent.** 5 USDC for one data API, this week. It stops at 5.00.
- **Claude with a budget.** Let Claude call paid tools inside a limit it can't raise.
- **School lunch.** 50 USDC at the school canteen, this term.
- **Morning coffee.** 20 USDC at your usual café. Faster than a card, and no fee for you.
- **Field staff.** Fuel money for one station, with no company card to lose.
- **A gift for one shop.** Sent as a link. Unspent money returns to the sender after the end date, and the gift page says so.

### Developers

**H2:** A few lines to pay. A few lines to charge.
**Sub:** Your agent uses a drop-in `fetch` that answers HTTP 402 "Payment Required" by itself. Your API adds one
middleware, checks every payment on its own server, and collects in batches of up to 20.
- **Tab labels:** `Pay (agent)` · `Charge (API)` · `Claude (MCP)`
- **Links:** `Agent quickstart →` · `Seller quickstart →` · `llms.txt for your agent →`

### Story (short)

**H2:** Named after an idea from 804.
In Tang-dynasty China, tea merchants were tired of hauling heavy strings of coin. They deposited the coin at an
official office and travelled with a certificate that paid out when its halves matched. People called it
飛錢, flying money. We use the same idea: put the money aside first, carry a proof instead, settle later.
Link: `Read the story →`

### Closing CTA

**H2:** Watch an agent make 20 paid calls and settle them in 3 transactions.
**Sub:** It runs live on a test network in about 30 seconds. Cut its connection. Steal its key. Watch what gets refused.
- `Run the live demo →`
- `Read the docs`

### Button and link microcopy

| Place | Label |
|---|---|
| Header CTA | `Try the demo` |
| Header nav | `Agents` · `Shops` · `Docs` · `Guarantees` · `Dashboard` |
| Footer tagline | Hand over a budget, not your wallet. |
| Footer status | Test network · open source · not yet audited |
| Copy-code button | `Copy` → `Copied` |

---

## 3. Audience pages

### `/shops` (families, givers and shop owners)

**H1:** Prepaid money for one place. With a limit that holds.
**Sub:** Give lunch money that only works at the canteen, a café tab for your regular, or fuel money for one station.
They pay with their phone. The shop gets paid from money already set aside for it.

**Section: For givers**
**H2:** You decide where, how much and how long.
- Pick the place, the amount and the end date, then send it as a link or QR code.
- Top up or extend at any time. When the end date comes, take back the leftovers.
- The holder needs no crypto wallet and pays no fees. You need USDC to give.
- What you can't do: cancel a certificate early or block one purchase. That is what lets the shop accept on the spot.

**Section: For holders**
**H2:** Pay by showing your phone.
- Open the link, choose a PIN. Your certificate lives on this phone.
- At the counter: tap **Pay**, scan the price, check the amount, enter your PIN, show your code.
- Running low? Tap **Ask for more** and your giver gets a request.

**Section: For shops**
**H2:** Regulars pay in seconds. You collect once a day.
- Open a till in your browser. No card terminal, no monthly fee from us.
- Each payment is checked on the till itself, so returning customers can still pay when your Wi‑Fi is down.
- New customers while you're offline are marked **Unverified**, and your risk is capped by a first-visit limit you set (5 USDC by default).
- Tap **Collect** to move the day's payments to your account in one transfer.
- Print your counter QR, or offer **Open a tab here** so a parent or employer can load money for you on the spot.

**Honest line (small print):** Payments are public on the blockchain but not linked to names. Test network, not yet audited.

**CTAs:** `Open a till` · `Give a certificate` · `Watch the café demo`

### Agents and developers page intro (`/docs/agents` and the agents landing section)

**H1:** Give your agent a budget it can't raise.
**Intro:** Your owner funds a budget in USDC for one service. Your agent gets its own spending key, which holds no
money and pays no gas. Each paid request carries a signed slip with the running total, the service checks it in
milliseconds, and collects later in one transaction. The agent can ask for a bigger budget, but only the owner can
fund one.

**Three quick facts under the intro:**
- **Capped.** A stolen agent key can spend at most what's left, at that one service.
- **Crash-safe.** A timeout never raises what the agent owes. It resends the same slip; it never signs a higher one.
- **Standard.** Plain HTTP 402 "Payment Required", a TypeScript SDK and an MCP server.

### `/pitch` one-pager (investors)

**Title:** Flying Money: budgets for anything that spends on your behalf.

**Problem.** AI agents are starting to buy things: API calls, data, compute, often for a fraction of a cent each.
Today their owners have three bad choices: hand over a card with no real ceiling, pay on the blockchain per call
(slower and costlier than the call itself), or ask sellers to trust an agent they've never met. The same gap exists
for people: parents, employers and gift givers who want to hand over money for one place without handing over a card.

**Solution.** The owner sets aside a budget in USDC for one seller, one spender and one end date. The spender pays
with signed slips carrying the running total. The seller checks each slip on its own machine in milliseconds and
collects everything later in one transaction. The spender can't authorize more than the budget, the money can only
reach the named seller, and every valid slip is already backed by money set aside for that seller. Leftovers return
to the owner.

**Why now.**
- Agents can now use paid tools on their own (MCP, tool use), and HTTP 402 "Payment Required" is being revived as a way to charge them.
- Dollar stablecoins on low-fee networks make one settlement for many small payments practical.
- Owners need a hard spending limit that lives outside the prompt, because prompts can be hijacked.

**Market and wedge.**
- **Wedge:** paid APIs and data services that want to charge agents per call without card fees or per-call transactions.
- **Second front:** closed-loop prepaid at places people pay often (canteens, cafés, events, suppliers), where offline acceptance for regulars matters.
- Same contract and SDK for both, so every seller that joins serves both kinds of spender.

**Business model (options, not yet validated).** The contract charges no fee, has no owner and no token, and will
stay that way. Revenue options sit around it:
- A hosted collector that submits sellers' payments and pays the network fee, for a monthly price.
- A hosted, durable seller backend for APIs that don't want to run their own payment store.
- An owner dashboard with budget requests, receipts and team controls for companies running many agents.
- Card-to-USDC top-ups through a licensed on-ramp partner, on a referral basis.

**Traction to date (facts only).**
- Rebuilt from scratch starting 23 Sep 2026.
- Contract deployed and verified on Arbitrum Sepolia, with 41 Foundry tests including invariant tests at 256 runs × depth 50.
- TypeScript SDK (client, server, core) with 132 tests at last count, including crash and replay tests.
- Live test run: an agent made 20 paid calls, settled in 3 transactions, and the seller received exactly the 0.25 USDC it served. With its network cut, payments kept being accepted; a thief with the stolen key was refused three times.
- Working dashboard, shop till with offline acceptance, phone wallet, and an MCP server for Claude.
- Not yet audited. No mainnet deployment yet. No paying users yet.

**Ask.** Pilot partners (a paid API or data service, and one canteen or café), funding for a security audit before
capped mainnet launch (100 USDC per certificate, 1,000 USDC per deployment), and [amount] to get there.
*(note)* Fill in the amount or remove it; do not invent one.

---

## 4. Product microcopy

### Counting House

*(note)* Keep "Counting House" as the page title (brand), but label the nav link **Dashboard** so new visitors know
what it is. Page eyebrow: `Dashboard`. Page H1: `Counting House`. Sub: `Everything you've given, and everything you can collect.`

**Tabs:** `Give` · `Holders` · `Places` · `Requests` · `Collect`

| Tab | Heading | Empty state |
|---|---|---|
| Give | Give [holder] [amount] at [place] for [duration]. | **Nothing given yet.** Pick a place, an amount and an end date. It takes about a minute. `Give a certificate` |
| Holders | People and agents you give to | **No one here yet.** Add your kid, a colleague or an agent. Names stay on this device. `Add a holder` |
| Places | Where money can be spent | **No places saved.** Scan a shop's counter QR, or enter a service's web address. `Add a place` |
| Requests | Asks waiting for you | **No requests.** When a holder asks for more, it shows up here. Nothing moves until you approve. |
| Collect | Payments you can collect | **Nothing to collect.** Payments made to your address will appear here. `Open a till` |

**Other Counting House lines**
- Wizard review: `Give Mia 20.00 USDC at Lantern Café for 30 days. Unused money returns to you on 24 Oct.`
- Success: `Done. Now give it to Mia.` · buttons `Copy link` · `Show QR`
- Hand-over warning: `Anyone with this link can spend it at Lantern Café. Send it privately. We show it once.`
- Unverified place: `We can't confirm who owns this address. Check it twice before giving.`
- Closed card: `12.50 spent · 7.50 returned to you`
- Renew prompt: `Mia's canteen money ends in 2 days. Renew?`
- Request card, untrusted text label: `Written by the holder, not verified`
- Mode banner (test): `Test money only.` · (mainnet): `Real USDC · not yet audited · max 100 USDC per certificate`
- No-cancel explainer: `You can't cancel early. That's what lets the shop accept on the spot. You can always choose not to renew.`

### Wallet (`/wallet`)

- **Pay** button: `Pay`
- Review: `Pay 3.50 USDC to Lantern Café · 16.50 left after this`
- PIN: `Enter your PIN to pay`
- Payment code screen: `Show this to the cashier`
- After scan: `Did the shop accept it?` · `Yes, accepted` · `No, it wasn't accepted`
- **Ask for more:** `Ask for more` → `How much, and why? Your giver will see this.` → `Sent. You'll see it here when they answer.`
- Insufficient at the till: `Not enough left for this. Ask your giver?` · `Ask for 10.00`
- Ask for a new place: `Ask for a new place` → `Scan the shop's QR`
- Leftovers notice: `Unused money returns to Mom on 30 Oct.`
- Balance label: `16.50 left · on this phone`
- Backup nudge: `Add to Home Screen and save a backup. Your phone can clear this site's data if you don't.`
- Empty: `No certificates on this phone yet. Open a link from your giver to add one.`

### Till (`/shop/.../pos`)

| Status | Line |
|---|---|
| Accepted | **Accepted 3.50** · Customer has 16.50 left |
| Unverified · merchant risk | **Unverified · merchant risk.** New customer while you're offline. If this payment is bad, you lose up to 5.00. We'll check it when you're back online. |
| Rejected: not enough | **Rejected.** Not enough left on this certificate (2.10 left). `Offer "Open a tab here"` |
| Rejected: expired | **Rejected.** This certificate has ended. |
| Rejected: wrong place | **Rejected.** This certificate is for a different shop. |
| Rejected: already used | **Rejected.** This payment code was already used. Ask for a new one. |
| Rejected: bad signature | **Rejected.** This code wasn't signed by the certificate's holder. |

- Ledger labels: `Accepted by you` → `Collected`
- Collect button: `Collect [total] USDC` · after: `Collected. [n] payments in one transfer.`
- Settings: `First-visit limit (offline)` · hint `The most a new customer can pay while you're offline. Your risk.`

### Agent errors (plain words; returned by `fm.fetch` and `fm_paid_fetch`)

| Code | Message to the agent (and shown to the owner) |
|---|---|
| `no_certificate` | No budget for [Service] on [chain] yet. You can send your owner one budget request (suggested: [amount] USDC), then wait. Don't retry the payment. |
| `insufficient` | Not enough left: [left] USDC left, this request costs [price]. You can ask your owner to top up this budget. Don't retry. |
| `expiring` | This budget ends before [Service] can collect. Ask your owner to extend it or fund a new one. |
| `wrong-payee` | This budget can only pay [Service A]. This request is for a different service, so nothing was paid. |

---

## 5. Developer copy

### README top section

```
# Flying Money

Hand over a budget, not your wallet. Prepaid, capped USDC budgets for AI agents and the people you pay for.
```

**30-second pitch (under the title):**
Flying Money lets an owner set aside USDC for one seller, one spender and one end date. The spender (an AI agent or
a phone) pays with signed slips carrying the running total. The seller checks each slip on its own machine in
milliseconds and collects everything later in one transaction. The spender can't authorize more than the budget, the
money can only reach the named seller, and leftovers go back to the owner. No token, no fees, no admin keys. MIT.

**Quickstart intro lines:**
- `## Try it in two commands` — Clone, install, and run a whole agent-pays-an-API demo on a local test chain. No keys, no faucet.
- `## Pay from an agent` — Make a key where the agent runs, get a budget from your owner, and swap `fetch` for `fm.fetch`.
- `## Charge for your API` — Add one middleware. Every request is checked on your server; collect in batches.

**Status line:** Not yet audited. Live on Arbitrum Sepolia with test money. Mainnets will launch under fixed caps:
100 USDC per certificate and 1,000 USDC per deployment.

### `/docs/agents` quickstart intro

Your agent pays with a budget its owner funded for one service. The agent gets its own spending key, which holds no
money and needs no gas. It signs small slips ("total so far: 0.37") that the service checks instantly and collects
later in one transaction. Three steps: make a key, get a budget, swap `fetch` for `fm.fetch`.

### MCP one-paragraph pitch

Give Claude a budget it can't raise. The Flying Money MCP server lets Claude, or any MCP agent, pay for API calls
from a USDC budget you fund for one service. It can check prices for free, pay per request up to a price cap you set,
and ask you for more when it runs low. It has no tool to fund, top up or reveal its key, so the limit lives in the
contract, not in the prompt.

### npm package descriptions

| Package | Description (≤ 160 chars) |
|---|---|
| `@flying-money/client` | Let an AI agent pay HTTP 402 APIs from a prepaid USDC budget it can't exceed. Drop-in fetch, crash-safe retries. |
| `@flying-money/server` | Charge per request in USDC. Check each payment on your own server in milliseconds, then collect many in one transaction. |
| `@flying-money/mcp` | MCP server that lets Claude or any MCP agent pay per request from a capped USDC budget. No tool can raise the budget. |

---

## 6. Investors and innovators

### 10-slide deck

1. **Flying Money**
   - Hand over a budget, not your wallet.
   - Prepay once. Pay per use. Never past the limit.
2. **Agents are becoming buyers**
   - They buy API calls, data and compute, often for under a cent each.
   - Someone has to pay, and it's usually a person's card.
3. **Every option today is bad**
   - A card: no real ceiling if the agent loops or is hijacked.
   - A blockchain payment per call: slower and costlier than the call.
   - Pay later: sellers can't trust an agent they've never met.
4. **A budget for one seller**
   - The owner sets aside USDC for one seller, one agent key, one end date.
   - Leftovers go back to the owner after the end date.
5. **Pay per request, settle once**
   - Each request carries a signed slip with the running total.
   - The seller checks it in milliseconds and collects many slips in one transaction.
6. **What's protected**
   - The spender can't authorize more than the budget, even with a stolen key.
   - Every valid slip is backed by money set aside for that seller; money only reaches the named seller.
   - Not protected: delivery. Not yet audited.
7. **Demo**
   - 20 paid calls, 3 transactions, 0.25 USDC paid for exactly what was served.
   - Network cut: still accepted. Stolen key: refused three times.
8. **Same rails for people**
   - Canteen money, café tabs, fuel for field staff, gifts for one shop.
   - Pay by QR at the counter; returning customers can pay while the shop is offline.
9. **Built so far**
   - Contract on Arbitrum Sepolia, 41 Foundry tests including invariants. SDK, MCP server, dashboard, till, wallet.
   - No token, no fees, no admin. MIT.
10. **Next and ask**
    - Pilots with paid APIs and one café or canteen; audit; capped mainnet launch.
    - Looking for pilot partners, audit funding and [amount].

### 60-second verbal pitch

AI agents are starting to spend money. They buy API calls and data, often for a fraction of a cent each. Right now
you have three choices: give the agent your card and hope, pay on the blockchain for every call, which costs more
than the call, or ask the seller to trust an agent it has never met.

Flying Money is a fourth choice. You set aside, say, five dollars in USDC for one service, usable only by your
agent's key, until a date. The agent pays per request with a signed slip that says "total so far". The service checks
it on its own server in milliseconds, and collects everything later in one transaction. The agent can't spend past
five dollars, even if its key is stolen, and the money can only go to that service. What's left comes back to you.

The same idea works for people: lunch money that only works at the canteen, paid by QR code.

It's open source, with no token and no fees, live on a test network with an MCP server so Claude can pay. We're
looking for pilot sellers and funding for an audit.

### 2-minute demo video voiceover

*(note)* Matches the live `/demo` page, plus 20 seconds of the café flow. About 290 words.

**[0:00, landing page]** This is Flying Money. It lets an AI agent pay for things without holding your wallet.

**[0:08, dashboard, funding]** I'm the owner. I set aside half a dollar in USDC for one service, the Silk Road Oracle,
a paid data API. Only my agent's key can spend it, and only for seven days. That's the whole setup.

**[0:25, demo, press play]** Now the agent goes to work. It asks for tea prices, weather and routes. Each call costs
a cent or two. Watch the slips: each one carries the running total. One cent. Three cents. Eight.

**[0:45, seller ledger]** The service checks every slip on its own server, in milliseconds. Nothing is sent to the
blockchain yet, so there's no fee and no waiting per call.

**[0:55, cut the network]** Let's cut the seller's connection to the blockchain. Calls keep going. Payments are still
accepted, because the money behind them is already set aside for this seller.

**[1:10, restore, collect]** Connection back. The seller collects. Twenty calls, three transactions, and exactly what
was served: a quarter of a dollar.

**[1:22, steal the key]** Now the worst case. Someone steals the agent's key and tries to spend a full dollar.
Refused: that's more than the budget. They try a different seller. Refused: this money can only go to the Oracle.

**[1:40, café, two phones]** The same idea works at a counter. Mia's parent loaded twenty dollars for the Lantern
Café. She scans the price, enters her PIN, shows her code. Accepted.

**[1:52, closing card]** Flying Money. Hand over a budget, not your wallet. Open source, on a test network today.

---

## 7. HackQuest project form

**Project name:** Flying Money

**Intro (≤ 200 characters):**
Hand over a budget, not your wallet. Prepaid, capped USDC budgets that AI agents and people spend per use at one seller, checked instantly, collected in one transaction.

**Description (≤ 1,500 characters):**

AI agents are starting to pay for API calls and data, often for fractions of a cent. Owners can hand over a card with no real ceiling, pay on the blockchain for every call, which costs more than the call, or ask sellers to trust an agent they have never met. Flying Money is a fourth option.

An owner sets aside USDC for one seller, one spender key and one end date. The spender pays each request with a signed slip carrying the running total. The seller checks it on its own machine in milliseconds, with no transaction per payment, and later collects everything in one transaction. The contract enforces three things: the spender cannot authorize more than the budget, even with a stolen key; every valid slip is backed by money set aside for that seller until the end date; and anyone can submit a slip for collection, but the money only reaches the named seller. Leftovers return to the owner after the end date.

Agents pay through standard HTTP 402 responses, a TypeScript SDK, or an MCP server that lets Claude pay per request with no tool that can raise its own budget. The same contract serves people: a parent loads canteen money, and the child pays by QR code at a till that keeps accepting returning customers when the shop's Wi-Fi is down.

There is no token and no fee, and the contract has no owner or admin. It is open source under MIT, not yet audited, and live on Arbitrum Sepolia with test money.

**Progress During Buildathon:**

We rebuilt Flying Money from scratch starting 23 Sep 2026. The contract is deployed and verified on Arbitrum Sepolia and passes 41 Foundry tests, including invariant tests. We shipped a TypeScript SDK for agents and sellers, and a live demo in which an agent makes 20 paid HTTP 402 calls that settle in 3 transactions, with the seller receiving exactly what it served. The demo also shows a cut network, where payments keep being accepted, and a stolen key, where every attempt to overspend or pay another seller is refused. We also built the Counting House dashboard for funding and collecting, a shop till with an offline phone wallet, an MCP server for Claude and other agents, and agent-readable docs (llms.txt and a machine-readable seller file).

**What's next:** Pilot with one paid API and one café, get an audit, then launch on mainnet under fixed caps of 100 USDC per certificate.

*(note)* Character counts are checked in the appendix at the end of this file.

---

## 8. Words to avoid → use instead

Code names (`Certificate`, `Note`, `issue`, `redeem`, `reclaim`, `funder`, `spender`, `payee`, `faceValue`) do not change.

| Avoid (in UI and marketing) | Use instead | Why |
|---|---|---|
| Sealed certificate | Agents: **budget**. People: **certificate** (after one gloss: "money for one place") | "Budget" is the word owners already use for agents. For people, "certificate" is familiar from gift certificates; "sealed" is what made it foreign, so drop it. Keeps §21.3 intact. |
| Sealed note, note | **Payment slip**, or just **payment** | "Note" sounds like a memo. A slip with a running total is what people picture. *(Changes the "One payment" row in spec §21.3; needs founder sign-off.)* |
| Seal (verb), sealed (status) | **Sign**, **signed** | Status line becomes Signed → Accepted / Unverified · merchant risk → Collected. |
| Issue | **Give** (people) / **Fund** (agents) | Per §21.3. "Issue" is bank language. |
| Redeem | **Collect** | Per §21.3. |
| Reclaim | **Take back leftovers** | Per §21.3. |
| Face value | **Amount** (people) / **budget** (agents) | Nobody says face value about their own money. |
| Funder / spender / payee | Giver / Holder / Place, or Owner / Agent / Service | Per §21.3. Never mix the two sets on one screen. |
| Escrow, reserved, locked | **Set aside** | Plain. "Locked" is fine for owners as a verb once. |
| Guaranteed (as an adjective on its own) | **Backed by money set aside for [seller]** | Ties it to claim (a) and nothing stronger. The till's "Accepted" status is the only place the spec's GUARANTEED appears, and only in docs. |
| Can't be hacked / impossible / fully safe | **Can't spend more than the budget, even with a stolen key** | Claim (b) says exactly this and no more. |
| Anonymous, private | **Not linked to names** | Addresses and amounts are public. |
| Works offline | **Works when the shop's Wi‑Fi is down, for customers the till has seen before** | Offline acceptance for first-time customers is merchant risk. |
| What the math guarantees | **What the code enforces** | "Math" sounds like a boast and hides the audit status. |
| Counting House (as nav label) | **Dashboard** (keep Counting House as the page title) | New visitors need to know what's behind the link. |
| USDC (first mention) | **digital dollars (USDC)** | Once per page, then USDC. |
| On-chain, EIP-712, ECDSA, gas | Plain words in UI; technical terms only in /docs | "Recorded on the blockchain", "signature", "network fee". |
| Money that flies, since 804 | Keep for /story and the footer only | Brand story, not a lead. |

---

## 9. Self-review

- **Claims.** Every safety line maps to (a), (b) or (c), plus the leftover return, which is a feature, not a safety
  claim. No "impossible", "fully safe", "anonymous" or audit claims. "Never more than you allow" in the agent H1 is
  claim (b). Offline acceptance is always qualified ("returning customers", "customers the till has seen before").
- **Event names.** None in sections 1–6 or 8. Section 7 uses "Buildathon" only because the form field is named that.
- **Taxonomy.** Door A and agent pages use Owner / Agent / Service / Budget / Fund / Collect / budget request.
  Door B, `/shops`, wallet and till use Giver / Holder / Place / Certificate / Give / Collect / Take back leftovers /
  Ask. The landing's shared sections (Trust, Use cases, Story) avoid both sets. The Counting House nav is fixed by
  §21.3 and stays as specified.
- **Plain language.** "Digital dollars (USDC)" appears once per page. No emojis, no hype adjectives. Crypto terms only
  in /docs and developer copy.
- **Facts.** Traction lines come from `docs/STATUS.md`: 41 Foundry tests, 132 SDK tests at the Phase 4 count, the
  Arbitrum Sepolia run (20 calls, 3 transactions, 0.25 USDC), no mainnet, not audited, MCP not yet on npm.

## Appendix: character counts

- Intro: 169 characters (limit 200).
- Description: 1,416 characters including paragraph breaks (limit 1,500).
