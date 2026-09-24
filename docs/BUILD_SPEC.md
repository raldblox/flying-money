# FLYING MONEY: Final Build Specification

**Sealed certificates for AI agents. Money that flies, since 804 CE.**

*Version 1.5 (build target), 24 September 2026. **v1.5 adds §21** (founder directives: no GitHub Actions, no event names on the site, the taxonomy/UX, spending requests, Upstash on Vercel, and the hosted seller). §21 overrides earlier sections where they conflict. The protocol, the contract and the invariants are unchanged. History:*
- *v1.1 added multi-chain EVM and the four-submission plan (§5.4, §16, §17).*
- *v1.2 made the product holder-agnostic, with two front doors (§3.7), Shop mode (§12.5, §13.5) and the agent docs kit (§8.4, §10.7).*
- *v1.3 added Contacts and control (§3.8), keys, privacy and what's on-chain (§3.9), no-wallet recipients (§3.10), and the Contacts UI (§12.6).*
- *v1.4 is a narrow correctness patch from an external adversarial review (Appendix A, part 2):*
  - *ECDSA-only spenders.*
  - *A durable client outbox and request idempotency.*
  - *GUARANTEED vs UNVERIFIED offline acceptance.*
  - *One immutable USDC per deployment, plus a deployment-wide liability cap.*
  - *Corrected claims (no absolutes; "same source", not "identical bytecode").*
- *v1.4.1 is a second adversarial pass (Appendix A, part 3):*
  - *Explicit `reserved` accounting, which closes concurrent credit reuse (S4).*
  - *A redeem-only-served policy and conservative recovery.*
  - *Structural key isolation (spender ≠ funder, spender ≠ payee).*
  - *Precise note terminology.*
  - *Type and wording fixes.*

*The architecture is frozen. Do not redesign the protocol. Only fix defects against the invariants in §6.5, §6.6 and §7.*
*This is the single source of truth for rebuilding the Flying Money repository from scratch. It is written for a coding agent with no prior context, and for the founder presenting the project.*

---

## 0. How to use this document

**If you are the coding agent that will rebuild the repository:**

1. Read §1–§3 to understand what Flying Money *is* and why.
2. Execute **§4 (Repository reset)** first. It removes the old codebase safely.
3. Build in the order of **§17 (Build plan)**. Each phase has acceptance criteria. Do not start a phase before the previous one passes.
4. The protocol (§6), contract (§7) and SDK (§8) are normative. Implement them exactly. Anything marked **MUST** is required. **SHOULD** is strongly recommended. **MAY** is optional.
5. The website (§10–§11), app (§12), demo (§13) and story/pitch (§14–§15) are specified to the level of pages, components and copy. Copy is a draft: keep the meaning, and polish the wording if needed.
6. **Do not reintroduce anything listed in §4.2 (deleted).** Those features were removed for proven reasons (§2.3).

**If you are the founder:** §1 is the one-page summary, §14 is the story, §15 is the pitch, and §16 is the hackathon checklist.

### 0.1 What the agent can do alone vs. what a human must provide

A coding agent can build and test **everything locally** (Phases up to and including anvil integration, the web app against anvil, and all property tests) with zero external inputs. **Public-chain and launch steps need these human-provided inputs.** If an input is missing, the agent MUST stop at that step and report, not improvise.

| # | Input | Needed for | Provided as |
|---|---|---|---|
| H1 | A **deployer key** per network class (testnet / mainnet), funded with gas: ETH on Arbitrum Sepolia/One and Base Sepolia/Base; MON on Monad Testnet/143; USDC on Arc Testnet/5042 | Contract deployment (§7.5) | `DEPLOYER_KEY` env var (never committed) |
| H2 | **Testnet USDC** from `faucet.circle.com` for the demo funder on each testnet; **≤ 5 USDC real** per mainnet for the demo runner | Demo, smoke tests | Funded `DEMO_FUNDER_KEY`, `DEMO_AGENT_KEY` |
| H3 | A **redeemer/payee** address and key with gas per chain | The Oracle | `PAYEE_ADDRESS`, `REDEEMER_KEY` |
| H4 | Explorer API keys (Arbiscan, Basescan, Monad and Arc explorers, per their docs) | `forge verify-contract` | `EXPLORER_API_KEYS` |
| H5 | Accounts: Vercel (web), Fly.io/Railway (Oracle + demo runner), optional Upstash Redis | Hosting | Project tokens / linked repos |
| H6 | **Domain name** (checked for availability and trademarks) | Site, llms.txt, well-known URLs | Replace the placeholder `flyingmoney.xyz` |
| H7 | Optional `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Merchant agent LLM mode, MCP demo | Env |
| H8 | **Human review** of Chinese text and heritage copy | §11.1 | Sign-off |
| H9 | Recording the demo videos, making the slides final, and **submitting** to each hackathon (forms, accounts, KYC if any) | §16 | Human |
| H10 | Stopping any other process editing the repo and confirming the legacy archive exists | §4.1 | Human confirmation before the reset |

**Stop-and-ask rules (MUST):**
- Stop if any normative section seems to conflict with another. Report the conflict; don't pick silently.
- Stop before any **mainnet** transaction.
- Stop if a registry value (chain ID, USDC address or decimals) doesn't match what the chain returns.
- Stop if a test for an invariant (I1–I7, C1, S1–S4) can't be made to pass without changing the invariant. **Never weaken an invariant to make a test pass.**

### 0.2 Toolchain bootstrap (exact)

```bash
# Node 20+, pnpm 9+, Foundry (forge/anvil) latest stable
pnpm init && pnpm add -Dw turbo typescript
mkdir -p contracts && cd contracts
forge init --no-commit --no-git .
forge install foundry-rs/forge-std --no-commit
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-commit   # PINNED (see §5.3)
# foundry.toml
#   [profile.default]
#   solc_version = "0.8.24"
#   evm_version  = "shanghai"
#   optimizer = true
#   optimizer_runs = 200
#   remappings = ["@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/", "forge-std/=lib/forge-std/src/"]
#   [invariant]
#   runs = 256
#   depth = 50
```

Pick the TypeScript package versions at build time (latest stable). The pins that matter are **solc 0.8.24, OZ 5.1.0, and evm_version shanghai**, because they were verified against the reference contract in §7.2.

### 0.3 Kickoff prompt for the coding agent

> You are implementing `docs/BUILD_SPEC.md` (Flying Money v1.4.1). It is a **sealed build contract, not a discovery prompt**: do not redesign the protocol, rename concepts, or add features outside the spec. Read §0–§3, then execute §4 (after the human confirms H10) and follow §17 in order, meeting each ✅ before moving on. §6, §7 and §8 are normative. Implement the §7.2 contract exactly, and implement every invariant test (I1–I7, C1, S1–S4) before the code that depends on it. Use only the values in `@flying-money/chains`. Obey §0.1 stop-and-ask rules. After each phase, write a short status note in `docs/STATUS.md` listing what passed, what's blocked and which human inputs (H1–H10) are needed next.

### Fixed decisions (do not relitigate during the build)

| # | Decision |
|---|---|
| F1 | Product name: **Flying Money** (飛錢, *fēiqián*). |
| F2 | Core object: **Certificate**, a prefunded, capped, expiring allowance *scoped to one payee* and spendable by one *spender key*. **The holder can be anyone:** an AI agent (Claude, Hermes, custom agents), a person (customer, employee, child, gift recipient) or a device. The payee can be any seller: an API, a shop, a canteen, a business. |
| F3 | Payment object: **Note**, an EIP-712 signature by the spender over a *cumulative* amount, with `memo = requestId`. The payee keeps its authentic notes indexed by cumulative, and redeems only up to what it has served (§6.5). |
| F4 | **Anyone may redeem** a note. Funds always go to the payee. |
| F5 | **No early cancellation.** The funder reclaims only the unredeemed remainder after expiry. |
| F6 | **No token, no points, no airdrop.** The settlement asset is **Circle USDC**: official testnet USDC on testnets, real USDC on mainnets, **fixed immutably per deployment**. `MockUSDC` is only for local anvil. |
| F7 | **Multi-chain EVM from day one.** The same contract source and protocol, deployed per chain (with chain-specific USDC and caps), and one SDK configured through a chain registry (§5.4). Required chains: **Arbitrum**, **Monad**, **Arc** (mainnet + testnet each), plus **Base** for the Colosseum submission. **Solana is out of scope.** Colosseum's World's Fair accepts EVM tracks. |
| F8 | Removed features: offline person-to-person cash between strangers, shared spending pools, endorsement chains ("lineage"), bundle/state-root settlement, multi-chain router, simulated "World". |
| F9 | Stack: pnpm monorepo, Foundry (contracts), TypeScript + viem (SDK), Next.js (site + app + docs), Hono (demo API). |
| F10 | Visual theme: Tang-dynasty paper, ink and vermilion seal, done respectfully (§11). |
| F11 | **Two front doors, one primitive:** *For agents* (HTTP 402 + SDK + MCP) and *For people & shops* (QR/NFC notes at a counter). Hackathon pitches lead with whichever door fits the track (§16.2). |
| F12 | **Agent-readable by default:** `/llms.txt`, `/llms-full.txt`, markdown twins of every doc page, `/.well-known/flying-money.json`, `AGENTS.md`, and an MCP server (§8.4, §10.7). |

---

## 1. One-page summary

**The problem.** AI agents are starting to buy things: API calls, data, compute, content. Today you have two bad options:
- Give the agent your wallet or card, and hope it doesn't overspend or get hijacked.
- Make a blockchain payment for every request, which is too slow and costs too much when a call is worth a fraction of a cent.

Sellers have the mirror-image problem. They can't tell whether an agent's promise to pay is backed.

**The idea (from 804 CE).** In Tang-dynasty China, merchants stopped carrying copper coins on long trade routes. They deposited coin with an official office and carried a **certificate** (*飛錢, "flying money"*) instead. The certificate was made of matching halves, and they redeemed it in another city. The value flew; the coins stayed put.

**Flying Money does the same for AI agents, and for anyone else who spends on your behalf:**

1. **Issue a certificate.** You lock, say, 5 USDC in the Flying Money contract for **one seller** (for example a data API), usable by **one agent key**, until an expiry date.
2. **The agent pays with sealed notes.** Each request carries a signed note: "total paid on this certificate so far: 0.37". The seller checks it locally in milliseconds. There is no blockchain transaction and no wait. It even works if the network drops mid-session.
3. **Redeem once.** The seller (or anyone acting for it) redeems the *latest* note on-chain in **one transaction** for everything owed.
4. **Hard guarantees:**
   - The agent can **never** spend more than the certificate's face value, even if its key is stolen.
   - **Every redeemable note is backed by funds reserved exclusively for its payee until the certificate expires.** The seller collects by redeeming before expiry.
   - Unused funds return to you after expiry.

**Why now.** Agent commerce needs *bounded, provable budgets*. Card rails weren't designed for machine micro-payments. Per-request on-chain payment is slow at scale. Flying Money is **the prepaid tab for machines**: prefunded, capped, payee-scoped, and settled whenever convenient.

**Not only agents.** The same certificate works for people. A parent gives a child 50 USDC that only works at the school canteen. An employer gives a field worker fuel money at one station. A friend sends a gift for one café. **The person spending needs no wallet and no crypto knowledge**, only a phone browser. They pay by showing a QR, and the shop's till verifies it even offline (§3.7–§3.10).

**What we're submitting:**
- One invariant-tested contract, the same source deployed on Arbitrum, Monad, Arc and Base (testnets, plus mainnets with per-certificate and deployment-wide caps).
- A TypeScript SDK (client, server middleware, core).
- A live demo on any supported chain: an AI agent buying data from a paid API, with the budget enforced, the network cut, and one-transaction redemption. The same seller accepts notes on several chains at once.
- A themed website with story, docs and an app ("the Counting House") to issue and manage certificates, with Contacts (people, agents and places).
- **Shop mode:** a till page and a customer wallet page, for tabs, allowances and gift certificates, working offline at the counter.
- **Agent kit:** an MCP server (Claude, Hermes, any MCP agent), `/llms.txt`, and machine-readable deployments.

**The honest backstory (a strength, not a weakness).** We began by building "offline cash". Our own adversarial review showed that software alone cannot stop someone paying two offline strangers with the same money. So we cut everything that couldn't be guaranteed. What remains is small, provable, and more useful (§14).

---

## 2. What was discovered (condensed rediscovery findings)

This section is the justification for every design decision. The full reports live in the project as `flying-money-discovery-report.md`.

### 2.1 What the old code actually was

The old repository contained four stacked generations:

- **G1:** sender-settled signed claims. These were IOUs the sender could simply never pay.
- **G2:** a simulated "World" economy, a graph lab, Merkle "bundles" whose state root was never verified on-chain, and a six-chain settlement router with a fake Solana adapter.
- **G3:** an in-memory authority model.
- **G4:** `FlyingMoneyVault.sol`, the real system: on-chain spending reservations, EIP-712 payments signed offline, durable IndexedDB inbox/outbox, receipt verification, and endorsement "lineages".

### 2.2 What was genuinely good (kept, in new form)

1. **Irrevocable reservations.** Funds locked until expiry, with no early cancellation. This is the only reason a receiver can rely on a payment before settlement. **Kept (F5).**
2. **Receiver-bound, domain-bound, single-use signed payments** (EIP-712 with chainId and contract). **Kept.**
3. **"Transport cannot supply trust."** Backing is read from the chain, never from the payment payload. **Kept** (servers read the certificate from the chain and cache it).
4. **An honest status vocabulary** (signed ≠ accepted ≠ settled). **Kept** in UI copy.
5. **Idempotent submission discipline** (never blindly rebroadcast). **Kept** in the redeemer worker.
6. **The paper/ink visual direction.** **Kept and deepened** (§11).

### 2.3 What was fundamentally broken (removed)

1. **The shared spending pool.** One reservation could pay *any* receiver. A payer with a 10 USDC authority could give a 10 USDC payment to every offline merchant they met, and only the first to redeem got paid. There was no deterrent. **Without an online authority, witnesses, trusted hardware, an identity or liability system, or shared state, no design can prevent this.** → Replaced by **payee-scoped certificates**. Only one party can ever be paid from a certificate, so cross-payee double-spending cannot happen. The remaining responsibility is the payee's own: keeping its acceptance state consistent across its devices.
2. **Short-deadline payments.** A payer could sign a payment expiring in 30 seconds, and the offline receiver accepted it. → The SDK enforces a **minimum remaining lifetime**, and the contract enforces a **minimum certificate lifetime**.
3. **Endorsement chains.** The endorser could redeem first and silently cancel the downstream holder's value. A single expired branch could block the whole tree ("expiry poisoning"). → **Deleted.**
4. **Receiver-only redemption with native gas.** This blocked relayers and gasless merchants. → **Anyone may redeem** (funds still go only to the payee).
5. **The master key signs everything.** The same key that could withdraw all funds signed offline payments. → A **separate spender key** per certificate (the agent's key). A compromise is bounded by face value.
6. **One redemption transaction per payment.** Uneconomic for micro-payments. → **Cumulative notes.** One redemption covers any number of payments.
7. **"Payment complete ✓ / No double spends" marketing** for offline acceptance, which was false. → Replaced by a public **Guarantees** page (§10.6) stating exactly what is and isn't guaranteed.
8. **Prior-sync requirement.** The receiver had to have already read the payer's authority from the chain. For offline strangers this was fatal. → With payee-scoped certificates, one read per certificate is enough, and after that the seller verifies offline (GUARANTEED, §6.8). First-time customers at an offline till are **UNVERIFIED · merchant risk**, capped by a shop-set first-visit limit. That is the shop's credit decision, not a Flying Money guarantee.

### 2.4 The resulting insight (the "10×")

> Scope the money to the payee, give the agent its own capped key, and let anyone settle. Double-spending disappears, per-request settlement disappears, and the product becomes exactly what machine commerce needs.

"Offline" survives as a *property* (notes can be signed and verified without connectivity), not as the product category.

### 2.5 Honest limits (must appear on the Guarantees page)

- Flying Money guarantees **payment**, not **service**. If the seller doesn't deliver, the payer's loss is bounded by the certificate. There are no chargebacks.
- The payee must redeem **before expiry**. Its SDK does this automatically.
- The stablecoin issuer can freeze funds (a property of USDC-like tokens).
- Chain liveness is assumed at redemption time.
- If a payee runs multiple servers, they must share the "latest accepted note" state (the SDK store interface handles this).

---

## 3. Product definition

### 3.1 Actors

| Actor | Who | Holds |
|---|---|---|
| **Funder** | Whoever puts up the money: a person for their own agent, a parent, an employer, a gift giver, a customer pre-paying a regular shop, a business pre-paying a supplier | A normal wallet (EOA or smart account) |
| **Spender** | Whoever spends it: an AI agent (Claude, Hermes, any framework), a person's phone, an employee, a child, a gift recipient, or a device | A **secp256k1 spending key** (ECDSA only; no smart-contract spenders in v1) that holds no money and needs no gas. It only signs notes. Agent env var or phone/browser key. Key policy in §3.9 |
| **Payee** | The seller: a paid API, a shop, a canteen, a café, a market stall, a business or supplier | An address that receives funds; runs the server SDK (APIs) or the POS page (shops) |
| **Redeemer** | Anyone who submits a note on-chain. Usually the payee's worker; could be a relayer | Gas only |

### 3.2 Objects

**Certificate** (on-chain, funded): `{ id, funder, payee, spender, token, faceValue, redeemed, expiresAt, closed }`.
- **UI names:** "certificate" (full), "cert" (compact).
- **Invariant:** `redeemed ≤ faceValue`. Funds for `faceValue − redeemed` are held by the contract until redemption or reclaim.

**Note** (off-chain, signed by the spender): `{ certificateId, cumulative, memo }` + `signature`.
- `cumulative` = the total amount owed to the payee on this certificate so far.
- `memo` = a 32-byte hash chosen by the client. SHOULD be the hash of the latest request, for audit.
- **UI names:** "sealed note", "note".
- **Obligations only increase.** A payee's budget from a certificate is the highest authentic cumulative it has received.

**Note terminology (normative; use these words precisely):**

| Term | Definition |
|---|---|
| **Authentic note** | The ECDSA signature recovers to the certificate's `spender` under this chain's EIP-712 domain |
| **Redeemable note** | Authentic **and** the certificate is open **and** `now ≤ expiresAt` **and** `redeemed < cumulative ≤ faceValue` |
| **Accepted note** | A seller admitted it under the §6.5 or §6.8 state machine (GUARANTEED, or UNVERIFIED for first-time offline) |
| **Redeemed note** | Its cumulative obligation is already covered on-chain (`cumulative ≤ redeemed`). It is still authentic, but no longer redeemable |

### 3.3 Lifecycle

```
Funder ── issue(payee, spender, faceValue, expiresAt) ──►  Certificate [OPEN]
                                                            │  topUp / extend (funder, only increases)
Spender ── note(cumulative=0.01) ──► Payee verifies locally, serves
Spender ── note(cumulative=0.02) ──► …
                                                            │
Anyone ── redeem(latest note) ──► payee receives (cumulative − redeemed)   [may repeat with higher notes]
                                                            │
after expiresAt: Funder ── reclaim() ──► funder receives faceValue − redeemed   [CLOSED]
```

### 3.4 What each party is guaranteed

| Party | Guarantee | Conditions |
|---|---|---|
| Payee | Every redeemable note is backed by funds reserved exclusively for it; redeeming a redeemable note pays exactly `cumulative − redeemed` | Redeems before `expiresAt`; token not frozen; chain live; its acceptance state is authoritative |
| Funder | Never loses more than `faceValue`; gets the remainder back after expiry | — |
| Funder (spender key stolen) | Loss ≤ remaining face value of certificates bound to that key | — |
| Spender (agent or person) | Cannot be charged more than the highest cumulative it signed; retries never create extra charges; network failures never raise its obligation | Signatures are over cumulative totals; `requestId` idempotency (§6.5); durable outbox (§6.6) |
| Everyone | Funds go only to the payee named at issuance | — |

**Not guaranteed:** that the payee delivers the service; that notes reach the payee (if lost, the payee just doesn't serve).

### 3.5 Positioning statement

> **Flying Money issues sealed spending certificates for anyone who spends on your behalf: AI agents, people and devices.** Lock a budget for one seller. The holder pays with signed notes the seller verifies instantly, even offline.
>
> **The three claims we make (and no stronger ones):**
> 1. *Every redeemable note is backed by funds reserved exclusively for its payee until the certificate expires.*
> 2. *The spender cannot authorize more than the certificate's face value.*
> 3. *Anyone can redeem a redeemable note, but its value can only be delivered to the certificate's payee.*
>
> *Short form (agent tracks):* "Give your AI agent a sealed certificate, not your wallet."
> *Short form (payments tracks):* "Prepaid certificates for the places you pay often. Capped for the holder, reserved for the shop."

### 3.6 Non-goals

- Offline payments between strangers. This can't be guaranteed without an online authority, trusted hardware, an identity or liability system, or shared state, and we say so.
- A general-purpose wallet. The customer view holds only certificate keys and notes, never arbitrary assets.
- Our own token.
- Cross-chain routing or bridging. Each certificate lives on one chain, and sellers may accept several chains (§5.4).
- Refunds and disputes (possible future work).
- Replacing x402 or cards. Flying Money is a *tab scheme* that could sit alongside them (§6.6).

### 3.7 Two front doors, one primitive

The contract, note format and guarantees are identical for every holder. Only the *transport* and the *UI* differ.

| | **For agents** | **For people & shops** |
|---|---|---|
| Spender | Agent key (Claude, Hermes, OpenAI/LLM agents, scripts) | A secp256k1 key in the person's phone/browser |
| Payee | Paid APIs, data, compute, MCP tools | Shops, cafés, canteens, stalls, service businesses, suppliers |
| Transport | HTTP `402` + `Flying-Money-Note` header (§6.4) | **QR at the counter**: the POS shows the price; the customer's phone shows a sealed-note QR; the POS scans it. NFC or a link are optional alternatives |
| Verification | Server SDK, milliseconds | POS page, milliseconds. **Works with the shop offline** after the certificate has been read once |
| Settlement | Redeemer worker | The shop taps "Collect today's notes" (one tx), or the auto-redeemer |
| Integration | `@flying-money/client`, MCP server, llms.txt | Counting House → Shop mode (§12.5), no install (PWA) |

**People-and-shops use cases (all using the same primitive):**

1. **Regulars' tab.** A customer pre-pays 20 USDC at their usual café and pays per cup with sealed notes. It is quicker than card, and the shop gets a single settlement per day.
2. **Allowances.** A parent funds a child's canteen certificate. The child can only spend at the canteen, only up to the face value, and the remainder returns to the parent.
3. **Employee spending.** A business funds a field worker's certificate at a specific supplier or fuel station, with the cap enforced and no corporate card to lose.
4. **Gift certificates.** The funder issues to a shop and sends the spender key as a **gift link** (the key lives in the URL fragment and never reaches a server). The recipient spends it at that shop. *Note: unspent value returns to the giver after expiry, and this is stated on the gift page.*
5. **Events and venues.** An organiser runs one payee per stall, or one venue payee. Attendees pre-load certificates, and the stalls keep working when the venue Wi-Fi dies.
6. **B2B deposits.** A business pre-pays a supplier. The supplier draws against signed delivery notes, which gives an auditable running total.

**Why offline is honest here.** Earlier versions promised offline cash between strangers, which can't be guaranteed under those assumptions. A *payee-scoped* certificate is different, because only this shop can ever be paid from it. We claim **guaranteed offline acceptance for a previously verified certificate**, provided that the shop's acceptance state is authoritative (a single POS, or synced devices within floats), its clock is roughly right, and it redeems before expiry. First-time customers while offline are **UNVERIFIED · merchant risk** (§6.8).

### 3.8 Contacts and control (the "parental control" model)

The Counting House keeps two local address books:

- **People & agents** (who spends): a name, a spending address, a type (person, child, employee, agent), and a key policy (§3.9). Examples: "Mia (daughter)", "Juan (field staff)", "Research Agent (Claude)", "Hermes bot".
- **Places** (where they can spend): a name, a payee address, a chain, and a verification status. Examples: "School Canteen", "Lantern Café", "Silk Road Oracle API".

Issuing becomes a sentence: **Give [holder] [amount] at [place] for [duration].** Each holder has a control page listing all their certificates (remaining, expiry, spent this week) with Top up, Extend and Renew.

**What control means (MUST be stated plainly in the UI and on the Guarantees page):**

| The funder can | The funder cannot |
|---|---|
| Choose exactly where money can be spent (one certificate per place) | Freeze or cancel a certificate before expiry |
| Choose how much, and top up at any time | Lower a limit after issuing |
| Choose how long, and extend it | Block one purchase at an allowed place |
| **Not renew.** Small amounts on short cycles work as an allowance, so the next cycle can be withheld | See purchases before the shop collects, unless the holder's app sends receipts (§12.6) |

**Why there is no freeze button:** the seller accepts notes instantly, even offline, only because the money cannot be pulled back. A revocable certificate would force every till to check online for every sale, and that would lose the offline guarantee. The trade-off is intentional: **control happens at issue and renewal time.**

**Postponed (not before 14 Oct):** scheduled allowances, where a parent locks four weeks upfront and each week unlocks on time. This needs a `startsAt` field in the contract, which means a new deployment and new tests. For now, weekly allowances are renewed manually, and the app reminds the funder.

### 3.9 Keys, privacy and what is on-chain

**Money path:** funder wallet → contract (escrow) → payee. **The spender never holds or moves funds.** No wallet is created for the spender, and the spending key never has a balance and never sends a transaction.

**Visible on-chain (public):** the funder address, the payee address, the spender address (random, holding nothing), the face value, expiry, each redemption (amount, time, memo hash) and the note signatures in redemption calldata. **Not on-chain:** names, contact labels, what was bought (only a memo hash), or anything linking the spender address to a real person.

**Key policy (MUST):**

| Holder type | Key policy | Reason |
|---|---|---|
| Child / private person | **Fresh key per certificate** (default) | Stops different places from being linked through one spending address |
| Agent | **One key per agent** (default; fresh-per-certificate available) | Simpler configuration; agents are not privacy-sensitive in the same way |
| Employee | Organisation's choice; default one key per employee | Easier to audit |

**Rules:**
- Spending keys are generated where they will be used: the agent's machine (`keygen` CLI, the recommended option), the recipient's phone, or the funder's browser for hand-over or gift links (shown once, never stored by the site).
- Keys leave a device only through explicit export, gift-link or hand-over flows.
- **The app states plainly:** "Payments are public on the blockchain but not linked to names. Anyone can see that some address paid a canteen, but not who." A funder MAY use a separate address for allowances so it doesn't link to their main wallet.
- **Do not claim anonymity.** Strong privacy (hiding funder → payee flows) is out of scope.

### 3.10 Recipients without a wallet, and leftovers

- **Spending needs no wallet.** A recipient opens a gift or hand-over link (or scans a hand-over QR), sets a PIN, and can pay immediately. They need no seed phrase, no crypto, no gas and no account.
- **Funding needs a wallet with USDC.** Card-to-USDC on-ramps are post-hackathon.
- **Leftovers return to the funder** after expiry, not to the recipient. Gift and allowance pages say so up front ("Unused balance returns to Mom on 30 Oct").
- **"Money to spend anywhere" is not what Flying Money does.** Every certificate is tied to one place, and that tie is what makes it safe. A plain USDC transfer to a real wallet covers the "anywhere" case. An in-app "claim to a new wallet" would be a different product with real-money key backup, and it is out of scope.
- **Demo line:** "The person spending it doesn't need a wallet or any crypto knowledge. Only the person paying for it does."

---

## 4. Repository reset

### 4.1 Safety steps (MUST, in this order)

1. **Stop any other process or agent** currently editing the repository. The rediscovery found an active implementation loop ("Phase 8"). Two writers will corrupt the rebuild.
2. **Archive the old tree** outside the repository before deleting anything:
   ```bash
   cd ..
   tar --exclude=node_modules --exclude=dist -czf flying-money-legacy-$(date +%Y%m%d).tar.gz flying-money
   ```
   On Windows PowerShell, use `Compress-Archive` equivalently. Keep this archive. It is the only record of the old code, because the repository was never committed.
3. **Move secrets out.** Confirm that no private keys exist in `.env*` or `TEST_WALLETS.md`. `TEST_WALLETS.md` lists public testnet addresses; delete it from the new repo regardless.
4. Initialise a clean repository:
   ```bash
   git init
   ```
   Or, if `.git` exists with no commits, keep it. Create the structure in §5.2. The first commit is the empty skeleton with this document at `docs/BUILD_SPEC.md`.

### 4.2 Delete entirely (do not port)

| Old path(s) | Why deleted |
|---|---|
| `src/simulation/*`, `src/world/*`, `src/ui/world-view.tsx`, `WORLD.md`, `docs/WORLD_REPLAY_VERIFICATION.md` | A simulated economy with a global view. Proves nothing about the real system |
| `src/lib/graph-protocol.ts`, `src/lib/graph-scenarios.ts`, `src/lib/world*.ts` | Fake signatures (digests), simulation only |
| `src/protocol/engine.ts`, `src/protocol/ocx-payment.ts`, `src/protocol/types.ts`, related tests | Superseded in-memory models |
| `src/settlement/router.ts`, `evm-adapters.ts`, `monad-adapter.ts`, `tempo-adapter.ts`, `solana-boundary.ts`, `bundle.ts`, `src/settlement/types.ts` | Multi-chain theatre; Solana adapter returned hard-coded balances; bundles unverifiable |
| `src/lib/payments.ts`, `sync.ts`, `settlement.ts`, `protocol.ts`, `qr.ts`, `transport.ts`, `real-*.ts`, `storage.ts`, `wallet.ts`, `types.ts`, `execution.ts`, `network.ts`, `stablecoins.ts` | G1 sender-settled IOUs, raw-key browser wallet, MON/USDC unit confusion |
| `src/protocol/vault-lineage.ts`, `src/wallets/vault-lineage-*.ts`, `vault-endorsement-outbox.ts`, `src/settlement/vault-lineage-receipt.ts`, `src/ui/vault-lineage-panel.tsx`, `src/ui/vault-forward-panel.tsx`, `docs/VAULT_LINEAGE.md` | Endorsement chains: revocable by the endorser, expiry-poisonable |
| `src/wallets/vault-*.ts`, `src/wallets/use-vault-wallet.ts`, `src/settlement/vault-*.ts`, `src/transports/vault-qr.ts`, `src/ui/vault-*.tsx` | Built around the shared-pool model. Replaced by the new SDK |
| `src/ecosystem/*`, `src/networks/*`, `src/tokens/*`, `src/assets/*`, `src/events/*` | The old multi-chain registries (with fake adapters) and event bus. Multi-chain support returns *honestly* through `@flying-money/chains` (§5.4): the same contract really deployed everywhere, and no simulated adapters |
| `contracts/FlyingMoneySettlement.sol`, `contracts/FlyingMoneyVault.sol`, `contracts/test/*`, `scripts/*`, `hardhat.config.cjs` | Replaced by the new contract (§7) and Foundry |
| `src/App.tsx`, `src/styles.css` (102 KB), `src/ui/*`, `index.html`, `vite.config.ts`, `public/sw.js`, `src/pwa/*` | Replaced by the Next.js site and app |
| `docs/PHASE_6_AUDIT.md`, `docs/PHASE_8_STATUS.md`, `docs/VERIFICATION_SPEC.md`, `README.md` | Superseded; the old README made false finality claims |
| `ChatGPT Image Sep 22, 2026, 02_21_54 AM.png` | Unreferenced artifact. Move it to a private folder if wanted |
| `TEST_WALLETS.md`, `dist/`, `tsconfig.node.tsbuildinfo` | Build output and noise |

### 4.3 Ideas to port (as ideas, not code)

- The EIP-712 domain discipline (name, version, chainId, verifyingContract).
- The block-pinned chain reader idea. Use it in `@flying-money/server` when caching certificates.
- The transaction lifecycle states (`preparing → awaiting-wallet → submitted → confirming → confirmed | failed`), and the rule that a known broadcast hash is never re-submitted.
- The honest status labels.
- The paper/ink palette direction.

---

## 5. Architecture and repository structure

### 5.1 System diagram

```
                ┌──────── Any registered EVM chain: Arbitrum · Monad · Arc · Base ────────┐
                │  FlyingMoney.sol (same source + protocol)        Circle USDC (6 dp)  │
                └──────▲───────────────▲──────────────────────────▲──────────────────┘
                       │ issue/topUp   │ read certificate (cached) │ redeem (1 tx for N calls)
                       │ reclaim       │                           │
┌──────────────────────┴───┐   ┌───────┴───────────────────────────┴────────┐
│ Counting House (web app) │   │ Seller: Demo API "Silk Road Oracle" (Hono)  │
│ funder: issue, manage    │   │ @flying-money/server middleware              │
│ payee: view, redeem      │   │ - 402 offer  - verify note  - store latest   │
└──────────────────────────┘   │ - redeemer worker                           │
                               └──────────────────▲──────────────────────────┘
                                                  │ HTTP + Flying-Money-Note header
                               ┌──────────────────┴──────────────────────────┐
                               │ Buyer: Demo Agent (Node, optional LLM)       │
                               │ @flying-money/client: fetch wrapper, signer  │
                               └─────────────────────────────────────────────┘
Website (Next.js): landing · story · how it works · live demo · docs · guarantees · explorer · app
```

### 5.2 Monorepo layout

```
flying-money/
├─ package.json                 # pnpm workspaces, turbo scripts
├─ pnpm-workspace.yaml
├─ turbo.json
├─ .env.example
├─ README.md                    # story-first README (§14.3)
├─ AGENTS.md                    # instructions for coding agents working IN this repo (§10.7)
├─ LICENSE                      # MIT
├─ docs/
│  ├─ BUILD_SPEC.md             # this document
│  ├─ PROTOCOL.md               # normative spec (§6), generated from this doc
│  ├─ SECURITY.md               # guarantees + threat model (§9)
│  ├─ STORY.md                  # narrative (§14)
│  ├─ PITCH.md                  # pitch + demo script (§15)
│  └─ DECISIONS.md              # decision log (from §0 + §2)
├─ contracts/                   # Foundry project
│  ├─ foundry.toml
│  ├─ src/FlyingMoney.sol
│  ├─ src/MockUSDC.sol
│  ├─ test/FlyingMoney.t.sol
│  ├─ test/FlyingMoney.invariants.t.sol
│  └─ script/Deploy.s.sol
├─ packages/
│  ├─ core/                     # @flying-money/core   (types, EIP-712, verify, encode)
│  ├─ client/                   # @flying-money/client (spender: sign notes, fetch wrapper)
│  ├─ server/                   # @flying-money/server (payee: middleware, store, redeemer)
│  ├─ mcp/                      # @flying-money/mcp: MCP server so Claude/Hermes/any MCP agent can pay (§8.4)
│  ├─ abi/                      # generated ABI
│  └─ chains/                   # @flying-money/chains: chain registry + deployments (§5.4)
├─ apps/
│  ├─ web/                      # Next.js: site + docs + Counting House (incl. Shop mode POS + customer wallet) + live demo UI
│  │   └─ public/llms.txt, llms-full.txt, .well-known/flying-money.json (§10.7)
│  ├─ oracle/                   # Hono demo seller API ("Silk Road Oracle")
│  └─ agent/                    # demo buyer agent (CLI + streamed to web demo)
└─ (no .github/workflows: the local `pnpm verify` gate replaces CI, §21.1)
```

### 5.3 Technology choices

| Concern | Choice | Reason |
|---|---|---|
| Contracts | Solidity **0.8.24**, **Foundry** (forge tests, fuzz, invariants), **OpenZeppelin Contracts pinned to 5.1.0**, `evm_version = "shanghai"` | Invariant testing is essential for the pitch's credibility. The pin matters: newer OZ releases use the Cancun `mcopy` opcode, and Cancun support must not be assumed on every target chain. The reference contract compiles cleanly with this pin (§7.2) |
| Chain lib | **viem** | Typed EIP-712, lightweight, works in Node and the browser |
| Wallet UI | wagmi + ConnectKit (or RainbowKit) | Standard, fast |
| Web | **Next.js (App Router) + Tailwind + MDX docs** | One deployable for site, docs, app and demo |
| Seller API | **Hono** on Node | Tiny, fast, runs anywhere |
| Store (server SDK) | Interface; default in-memory + Redis/Upstash adapter | Payee state must be shared across instances |
| Hosting | Vercel (web), Fly.io/Railway/Render (oracle + agent runner) | Simple |
| Chains | viem chain definitions (`arbitrum`, `arbitrumSepolia`, `monad`, `monadTestnet`, `arc`, `arcTestnet`, `base`, `baseSepolia`) wrapped by `@flying-money/chains` | One source of truth |
| Tests | forge, vitest, Playwright (a few e2e) | — |

### 5.4 Chain registry (`@flying-money/chains`) (normative)

All chain-specific values live in **one** package. No other code may hard-code a chain ID, RPC, token address or explorer URL.

```ts
export interface ChainConfig {
  key: 'arbitrum' | 'arbitrum-sepolia' | 'monad' | 'monad-testnet' | 'arc' | 'arc-testnet' | 'base' | 'base-sepolia' | 'anvil'
  chain: Chain                 // viem chain object
  mainnet: boolean
  usdc: Hex                    // Circle USDC (ERC-20 interface, 6 decimals)
  gasToken: 'ETH' | 'MON' | 'USDC'
  explorer: string
  faucets: string[]            // gas + USDC faucets (testnets)
  confirmations: number        // 0 on deterministic-finality chains (Arc), 1 on Monad, 1 on Arbitrum/Base L2 soft-confirm
  maxFaceValue: bigint         // mirrors the deployment's immutable cap (§7.2)
  flyingMoney?: Hex            // deployed address (filled by the deploy script)
  deployedBlock?: bigint
  hackathons: Array<'arbitrum-open-house' | 'monad-metropolis' | 'arc-microgrants' | 'colosseum-worlds-fair'>
}
```

**Values** (verified against official docs on 23 Sep 2026 and re-checked by an external review; the deploy script MUST re-check `eth_chainId` and `USDC.decimals()`):

| Key | Chain ID | USDC (Circle) | Gas token | Notes |
|---|---|---|---|---|
| `arbitrum` | 42161 | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | ETH | Arbitrum One |
| `arbitrum-sepolia` | 421614 | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | ETH | |
| `monad` | 143 | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` | MON | Metropolis lists chain 143 |
| `monad-testnet` | 10143 | `0x534b2f3A21130d7a60830c2Df862319e593943A3` | MON | RPC `https://testnet-rpc.monad.xyz` |
| `arc` | 5042 | `0x3600000000000000000000000000000000000000` | **USDC** | RPC `https://rpc.mainnet.arc.io`, explorer `https://explorer.arc.io` |
| `arc-testnet` | 5042002 | `0x3600000000000000000000000000000000000000` | **USDC** | RPC `https://rpc.testnet.arc.io`, faucet `https://faucet.circle.com` |
| `base` | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | ETH | For the Colosseum Base/EVM track |
| `base-sepolia` | 84532 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | ETH | |
| `anvil` | 31337 | MockUSDC (deployed locally) | ETH | Local development only |

Take RPC URLs and explorers for the rows without them from viem's chain definitions.

**Arc-specific rules (MUST):**
- On Arc, USDC is both the native gas token (18 decimals) and an ERC-20 at `0x3600…0000` (6 decimals). **Flying Money only uses the ERC-20 interface (6 decimals).** Never read `getBalance()` for amounts. The UI shows a single USDC balance, not two rows.
- Arc has deterministic finality, so `confirmations: 0`. Anvil forks don't reproduce Arc behaviour, so run the Arc integration test against Arc Testnet.
- USDC transfers to blocklisted addresses revert. A redeem to a blocklisted payee fails, and that is documented behaviour.
- **Pitch bonus:** on Arc, sellers and redeemers need *only USDC*. There is no second gas token.

**Adding a chain later** = one registry entry + one deploy-script run. No code changes.

---

## 6. Protocol specification (normative)

### 6.1 Terms

- `chainId`: the EVM chain ID. Any chain in the registry (§5.4). A certificate lives on exactly one chain, and notes are bound to it by the EIP-712 domain.
- `contract`: the deployed `FlyingMoney` address.
- Amounts are **integer token base units** (USDC: 6 decimals). They MUST NOT be floats anywhere in protocol code.

### 6.2 Certificate

A certificate is created on-chain by `issue` (§7). Its `id` is:

```
id = keccak256(abi.encode(chainId, contract, funder, funderNonce))
```

Mutable fields only move in one direction:
- `faceValue` only increases (topUp).
- `expiresAt` only increases (extend).
- `redeemed` only increases.
- `closed` only goes false → true.

**Consequence (MUST be relied on by servers):** a cached certificate read is *conservative*. Its payee, spender and token never change, and its capacity and lifetime never shrink before expiry. Servers MAY cache a certificate indefinitely and MUST re-read it only when a note exceeds the cached `faceValue`, or when `expiresAt` is near.

### 6.3 Note (EIP-712)

**Domain:**
```json
{ "name": "FlyingMoney", "version": "1", "chainId": <chainId>, "verifyingContract": <contract> }
```

**Types:**
```json
{
  "Note": [
    { "name": "certificateId", "type": "bytes32" },
    { "name": "cumulative",    "type": "uint256" },
    { "name": "memo",          "type": "bytes32" }
  ]
}
```

- The **spender** of the certificate signs.
- Signatures are 65-byte secp256k1 ECDSA from the spender key. **ERC-1271 is not supported** (§7.1 #6): a note's validity must never depend on chain state, so it stays verifiable offline and permanent.
- Low-s is required: OpenZeppelin `ECDSA` enforces it.
- **`memo` is normative: it is the request identifier.** `memo = requestId`, a 32-byte value the spender generates fresh per request or order (random, or `keccak256` of a UUID). It binds the signature to one request and is the seller's idempotency key (§6.5). A spender MAY sign several notes with the **same** `cumulative` and different `memo`s. This is how prepaid credit is spent without increasing the obligation.

### 6.4 Wire format

**Note header** (client → server):
```
Flying-Money-Note: fm1.<base64url(JSON)>
JSON = {
  "v": 1,
  "chainId": "10143",
  "contract": "0x…",
  "certificateId": "0x…32 bytes",
  "cumulative": "370000",          // decimal string, base units
  "memo": "0x…32 bytes",       // = requestId
  "sig": "0x…"
}
```

**Offer** (server → client, on `402 Payment Required`). A seller MAY accept several chains. The client picks one where it holds a certificate.
```
HTTP/1.1 402 Payment Required
Content-Type: application/json
Flying-Money-Offer: fm1.<base64url(JSON)>

{
  "scheme": "flying-money",
  "v": 1,
  "price": "10000",                  // base units of USDC (6 decimals) for THIS request
  "minRemainingLifetime": 3600,
  "suggestedFaceValue": "5000000",
  "accepts": [
    { "chainId": "421614",  "contract": "0x…", "token": "0x75fa…", "payee": "0x…" },
    { "chainId": "10143",   "contract": "0x…", "token": "0x534b…", "payee": "0x…" },
    { "chainId": "5042002", "contract": "0x…", "token": "0x3600…", "payee": "0x…" }
  ],
  "docs": "https://flyingmoney.xyz/docs"
}
```
The price is chain-independent. All accepted tokens MUST be USDC with 6 decimals.

**Receipt** (server → client, on every outcome that involved an authentic note):
```
Flying-Money-Receipt: fm1.<base64url(JSON)>
JSON = {
  "certificateId": "0x…",
  "requestId": "0x…",         // = the note's memo
  "status": "SERVED" | "FAILED_CREDITED",
  "accepted": "370000",        // highest authentic cumulative the seller holds
  "consumed": "360000",        // value of requests served
  "reserved": "0",             // value of requests admitted, not yet finished
  "credit": "10000",           // accepted − consumed − reserved (prepaid, unspent)
  "remaining": "4630000",      // faceValue − accepted
  "expiresAt": 1790000000
}
```

The server MAY sign receipts with the payee key (`sig` field) for audit. This is optional in v1.

### 6.5 Server verification, reservation and idempotency (MUST)

**Seller state per certificate** (key `chainId:certificateId`). This is **authoritative application state** and MUST be durably stored and backed up.
- `accepted`: the highest authentic cumulative received (≤ `faceValue`).
- `consumed`: the total price of requests **served**.
- `reserved`: the total price of requests **admitted but not yet finished** (status PENDING).
- `credit = accepted − consumed − reserved`.
- `notes`: the authentic notes received, indexed by cumulative. At least the highest one, plus the highest one with `cumulative ≤ consumed` (used for redemption, see the policy below).

**State invariant (MUST hold after every atomic step):** `redeemedOnChain ≤ accepted`, and `0 ≤ consumed + reserved ≤ accepted ≤ faceValue`.

**Per request:** an outcome record keyed by `(certKey, requestId)` = `{ status: PENDING | SERVED | FAILED_CREDITED, price, admittedAt, responseRef? }`.

**Invariants:**
- **S1 (no double charge):** replaying a `requestId` already seen MUST NOT create another charge or another service side effect.
- **S2 (no unpaid service):** a request is admitted only if `consumed + reserved + P ≤ max(accepted, note.cumulative) ≤ faceValue` and the note is authentic.
- **S3 (failure becomes credit):** a failed service releases its reservation without adding to `consumed`, so the price becomes credit.
- **S4 (concurrent reservation safety):** for any interleaving of concurrent requests (including many distinct `requestId`s carrying the same cumulative), `Σ price(SERVED) + Σ price(PENDING) ≤ accepted − consumed₀` at every observable state, where `consumed₀` is the value before the batch began. **Server correctness MUST NOT depend on clients obeying §6.6**: an adversarial spender may send anything concurrently.

*Why `max(accepted, note.cumulative)`:* every authentic note is a spender-signed authorization of at least its cumulative, so the admissible budget is the highest authorization received so far. This also avoids spurious rejections when an older, lower note arrives after a newer one. Each request is still individually authorized, because its `requestId` is inside a spender signature.

On a request carrying a note, with `price = P`:

1. Parse. Reject malformed input (400).
2. `(chainId, contract)` MUST match a configured `accepts` entry. Otherwise 402 + offer. Use that chain's client, cache and store namespace.
3. Load the certificate (cache → chain). It MUST satisfy `payee == serverPayee`, `!closed`, and `expiresAt − now ≥ minRemainingLifetime`. Otherwise 402 + offer.
4. **Idempotency check** on `(certKey, note.memo)`:
   - `SERVED`: return the stored response (or re-execute an idempotent read) with the stored receipt. No new charge.
   - `PENDING`: go to step 8 and **resume** (the application operation is idempotent by `requestId`).
   - `FAILED_CREDITED`: return the stored failure receipt.
5. Load the state. If there is none, follow **Recovery** below.
6. Check authenticity (ECDSA against `spender`; invalid → 401) and `note.cumulative ≤ faceValue` (re-read `faceValue` once if needed). Check S2 (otherwise 402, `reason: "insufficient"`).
7. **`begin`: one atomic transaction** (a Redis Lua script, an SQL transaction, or an IndexedDB readwrite transaction) that **re-checks S2 inside the transaction**, then:
   - Inserts `(certKey, requestId) = PENDING` (fails if it already exists → go to step 4).
   - Sets `accepted = max(accepted, note.cumulative)` and stores the note.
   - Sets `reserved += P`.
8. Execute the service. The application code receives `requestId` and MUST make side-effecting operations idempotent on it, and able to report their status (`done | not-started | running | failed`).
9. **`finish`: one atomic transaction, valid only from PENDING:**
   - Success: `reserved −= P`, `consumed += P`, status → SERVED, store the response reference.
   - Failure: `reserved −= P`, status → FAILED_CREDITED.

   Return the result with the receipt.
10. **PENDING sweeper.** A PENDING record older than `pendingTimeout` (default 10 min) is resolved by asking the application for the `requestId` status:
    - `done` → finish as success.
    - `failed` or `not-started` → finish as failure (credit).
    - `running` → wait.

    Reservations are never held indefinitely, and a client retry racing the sweeper is safe, because `finish` only transitions from PENDING.

**Redemption policy (MUST): the seller redeems only what it has served.** The redeemer submits the highest stored note with `cumulative ≤ consumed`, not the highest note overall.
- Unspent prepaid credit therefore stays unredeemed in the certificate, and it **returns to the funder automatically at reclaim.** No off-chain refund is needed.
- It keeps `redeemedOnChain ≤ consumed`, which makes recovery safe (below).
- Near expiry (`safetyBeforeExpiry`), the redeemer still redeems only up to `consumed`. Any credit the seller never served goes back to the funder.
- The spender (or anyone) *may* redeem a higher note. That pays the seller more and only reduces the buyer's own refund. This is harmless to the seller, and credit remains owed off-chain.

**Recovery (store lost or corrupted), MUST:**
- Rebuild conservatively for that certificate: `accepted = consumed = redeemedOnChain`, `reserved = 0`, status `RECOVERED` (visible in the seller dashboard and logs). Never accept a note with `cumulative ≤ redeemedOnChain` as new value.
- **What this costs, and who pays:** because of the redemption policy, `redeemedOnChain ≤ consumed` always held. After a wipe, the seller forgets any served-but-unredeemed value (`consumed − redeemedOnChain`). The buyer's next notes then include that amount as apparent credit, so the seller loses at most its **redemption lag** (bounded by the redeemer's `minAmount` / `maxAgeSeconds`). **The buyer never loses credit through a seller wipe.** The seller controls both its backups and its redemption cadence.
- Therefore the seller store MUST be durable (Redis AOF/RDB with backups, or a SQL database) and SHOULD be backed up at least as often as `maxAgeSeconds`. Full reconstruction from events or receipts is future work (signed receipts, §19).

### 6.6 Client algorithm: durable outbox (MUST)

**Invariant C1 (no obligation growth on failure):** a network failure, timeout or crash MUST NOT cause the spender to sign a higher cumulative. Only a *new* request, after the previous one reached a final state, may increase it.

**Client state per certificate (durable, written before any send):**
- `accepted`, `consumed` (from the latest receipt).
- At most one `pending = { requestId, note, request, status: PENDING }`.

**Algorithm:**
1. Send the request without a note (or with one, if the price is known). On a 402 with a `flying-money` offer, choose a certificate across `offer.accepts` on the matching chain and payee, with enough remaining (`faceValue − accepted ≥ P − credit`) and a lifetime ≥ `minRemainingLifetime`. Prefer `preferredChains`. If none exists, raise `NoCertificateError` (with the offer).
2. Acquire the per-certificate mutex. **If a `pending` exists, resolve it first** by resending the exact same note and request (same `requestId`) until the seller returns a final receipt.
3. Compute `next = max(accepted, consumed + reserved + P)`, using the values from the latest receipt (with the per-certificate mutex, the client's own `reserved` is 0 here). If credit covers `P`, `next == accepted` and the obligation does not grow. Refuse if `next > faceValue`. Generate a fresh `requestId`. Sign `Note{certificateId, cumulative: next, memo: requestId}`.
4. **Durably save** `pending = { requestId, note, request }` **before sending**.
5. Send with the `Flying-Money-Note` header. On a network error or timeout, **resend the same pending note**. Never sign a new one.
6. On a final receipt (`SERVED` or `FAILED_CREDITED`), update `accepted`/`consumed` from it and clear `pending` atomically. Release the mutex.
7. On restart, step 2 runs first for every certificate with a `pending` record.

The same algorithm applies to the customer wallet at a counter (§6.8), with `requestId = orderId`.

**Relation to x402 (informative).** Flying Money uses the same HTTP 402 status, but it is a **deferred, prefunded tab scheme** rather than per-request settlement. A future version MAY register as an x402 "scheme". Do not claim compatibility until this is implemented and tested.

### 6.7 Time

- The contract uses `block.timestamp`.
- Servers use their own clock with a safety margin. The default `minRemainingLifetime` is 3600 s, and the redeemer redeems by `expiresAt − 1800 s` at the latest.

### 6.8 Counter transport: QR / NFC / link (people & shops)

It uses the same objects, carried visually instead of in HTTP headers.

1. **Price request.** The POS shows a QR encoding `fm1.<base64url(OfferJSON)>` with `price`, a single `accepts` entry (the shop's chain, contract, token and payee), and an optional `memoHint` (order id).
2. **Customer.** The customer's phone scans it and picks a matching certificate (same payee and chain; remaining ≥ price; lifetime OK). It shows a review ("Pay 3.50 USDC to Lantern Café, remaining after: 16.50"). On approval it follows §6.6: it durably saves a pending note with `cumulative = max(accepted, consumed + price)` and `memo = requestId = keccak256(orderId)`. If the POS doesn't confirm, the wallet re-shows the **same** QR and never signs a higher one.
3. **Sealed-note QR.** The phone displays `fm1.<base64url(SignedNoteJSON)>`, about 350 characters, which fits one QR at error-correction level M. The POS scans it and runs §6.5 (steps 3–9, where "service" is handing over the goods) against its **local** store and cached certificate. The result is one of the statuses below. A re-scan of the same QR returns the stored outcome (idempotent).
4. **Alternatives:** NFC (Web NFC on Android Chrome) carrying the same string, or a share link `https://…/n#fm1.…` (fragment, never sent to a server).
5. **Offline rules and acceptance statuses (MUST):**

   | POS status | When | What it means | UI |
   |---|---|---|---|
   | **GUARANTEED** | The certificate was verified on-chain by this shop earlier, and the note passes §6.5 against the shop's authoritative local state | The value is backed by funds reserved exclusively for this shop until expiry. It is collectable if the shop redeems before expiry | Vermilion seal, "Accepted" |
   | **UNVERIFIED · merchant risk** | The certificate has never been verified by this shop (first-time customer while offline) | **Not a Flying Money guarantee.** An attacker could present a fabricated certificate. This is the shop's own floor limit or credit decision, capped by the shop-set first-visit limit | Amber, no seal, "Unverified: your risk up to X" |
   | **REJECTED** | Bad signature, insufficient amount, expired, or wrong payee | — | Grey |

   - UNVERIFIED notes are re-checked when the POS reconnects, and are promoted to GUARANTEED or flagged as fraud.
   - **The GUARANTEED status holds** for a previously verified certificate, *provided that* the acceptance state is authoritative (a single POS, or synced devices within per-device floats), the local clock is roughly correct (the lifetime margin covers skew), and the note is redeemed before expiry. The POS shows a "Collect before <date>" reminder.
   - **Multi-device shops** MUST share the `accepted`/`consumed` state. Either one "primary" POS accepts, or devices sync when online and each accepts offline only up to its per-device float.

---

## 7. Smart contract

### 7.1 Requirements (MUST)

1. It has no owner, no admin, no upgradeability, no pause, and no fee.
2. Funds for a certificate can move only to (a) the payee, via redeem, or (b) the funder, via reclaim after expiry.
3. `redeemed ≤ faceValue` at all times.
4. **Solvency:** `token.balanceOf(contract) ≥ totalOutstanding == Σ over open certificates (faceValue − redeemed)`.
5. **One settlement token per deployment.** It is set immutably in the constructor to the chain's Circle USDC (§5.4). `issue` takes no token argument. This removes the arbitrary-token attack surface and matches the product (F6). A balance-delta check on every pull remains as defence in depth against fee-on-transfer behaviour. *(It cannot detect rebasing in general. That is irrelevant here because the token is fixed to USDC.)*
6. **Spenders are secp256k1 keys, verified with ECDSA only** (OpenZeppelin `ECDSA.tryRecover`, low-s enforced). **No ERC-1271.** Contract signatures are revocable (valid at block N, invalid at N+1) and can't be checked by an offline till, which would break the guarantee that an accepted note stays redeemable. Verification never depends on chain state, so an EOA that later gains code (for example via EIP-7702) keeps exactly the same semantics. **Funders** may be smart accounts, because they only call `issue`, `topUp`, `extend` and `reclaim`.
7. `issue` enforces `expiresAt ≥ now + MIN_LIFETIME` (1 hour) and `expiresAt ≤ now + MAX_LIFETIME` (365 days).
8. `redeem` is permissionless and idempotent. Re-submitting an already-covered note is skipped in a batch (`NoteSkipped`, reason 5) or reverts `NothingToRedeem` (single).
9. **Guarded launch caps** (immutable, set in the constructor; 0 = unlimited):
   - `maxFaceValue` limits any single certificate.
   - `maxTotalOutstanding` limits **the whole deployment's** outstanding liability (`totalOutstanding`).

   `issue` and `topUp` MUST respect both. Mainnet deployments use 100 USDC per certificate and **1,000 USDC in total**. Testnets use 0 (unlimited). There is no admin, so the caps can never be changed, only superseded by a new deployment. **UI copy MUST call these what they are:** "per-certificate cap 100 USDC · deployment-wide cap 1,000 USDC", never "safe".

### 7.2 Reference implementation

This is the normative intent. The implementer MAY refactor, but MUST keep the behaviour and the events.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Flying Money (飛錢) — sealed spending certificates
/// @notice A funder locks this deployment's USDC for ONE payee, spendable by ONE secp256k1 spender key,
///         until expiry. The spender signs cumulative Notes off-chain; anyone may redeem the latest Note,
///         paying the payee. After expiry the funder reclaims the unredeemed remainder.
contract FlyingMoney is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Certificate {
        address funder;
        address payee;
        address spender;     // secp256k1 key address; verified with ECDSA only (no ERC-1271)
        uint128 faceValue;
        uint128 redeemed;
        uint64  expiresAt;
        bool    closed;
    }

    bytes32 public constant NOTE_TYPEHASH =
        keccak256("Note(bytes32 certificateId,uint256 cumulative,bytes32 memo)");
    uint64 public constant MIN_LIFETIME = 1 hours;
    uint64 public constant MAX_LIFETIME = 365 days;

    // _tryRedeem status codes (also emitted in NoteSkipped)
    uint8 private constant S_OK = 0;
    uint8 private constant S_UNKNOWN = 1;
    uint8 private constant S_CLOSED = 2;
    uint8 private constant S_EXPIRED = 3;
    uint8 private constant S_EXCEEDS = 4;
    uint8 private constant S_NOTHING = 5;
    uint8 private constant S_BAD_SIG = 6;

    /// @notice The only settlement token of this deployment (the chain's Circle USDC).
    IERC20 public immutable token;
    /// @notice Per-certificate ceiling on faceValue (0 = unlimited).
    uint128 public immutable maxFaceValue;
    /// @notice Deployment-wide ceiling on totalOutstanding (0 = unlimited).
    uint128 public immutable maxTotalOutstanding;
    /// @notice Σ over open certificates of (faceValue − redeemed).
    uint256 public totalOutstanding;

    mapping(bytes32 => Certificate) private _certificates;
    mapping(address => uint256) public funderNonce;

    event CertificateIssued(bytes32 indexed id, address indexed funder, address indexed payee,
        address spender, uint256 faceValue, uint64 expiresAt);
    event CertificateToppedUp(bytes32 indexed id, uint256 amount, uint256 newFaceValue);
    event CertificateExtended(bytes32 indexed id, uint64 newExpiresAt);
    event NoteRedeemed(bytes32 indexed id, uint256 cumulative, uint256 paid, bytes32 memo, address indexed redeemer);
    event NoteSkipped(bytes32 indexed id, uint256 cumulative, uint8 reason);
    event CertificateReclaimed(bytes32 indexed id, uint256 refunded);

    error InvalidParams();
    error UnknownCertificate();
    error NotFunder();
    error Expired();
    error NotExpired();
    error Closed();
    error ExceedsFaceValue();
    error ExceedsCap();
    error InvalidSignature();
    error NothingToRedeem();
    error UnsupportedToken();

    constructor(IERC20 token_, uint128 maxFaceValue_, uint128 maxTotalOutstanding_) EIP712("FlyingMoney", "1") {
        if (address(token_).code.length == 0) revert InvalidParams();
        token = token_;
        maxFaceValue = maxFaceValue_;
        maxTotalOutstanding = maxTotalOutstanding_;
    }

    // ───────── Funder ─────────

    function issue(address payee, address spender, uint128 faceValue, uint64 expiresAt)
        external nonReentrant returns (bytes32 id)
    {
        if (payee == address(0) || payee == address(this) || spender == address(0) || faceValue == 0)
            revert InvalidParams();
        // Key isolation is structural: the spender key can never be the funder or the payee.
        if (spender == msg.sender || spender == payee) revert InvalidParams();
        if (expiresAt < block.timestamp + MIN_LIFETIME || expiresAt > block.timestamp + MAX_LIFETIME)
            revert InvalidParams();
        if (maxFaceValue != 0 && faceValue > maxFaceValue) revert ExceedsCap();
        _addOutstanding(faceValue);

        id = keccak256(abi.encode(block.chainid, address(this), msg.sender, funderNonce[msg.sender]++));
        _pullExact(faceValue);
        _certificates[id] = Certificate(msg.sender, payee, spender, faceValue, 0, expiresAt, false);
        emit CertificateIssued(id, msg.sender, payee, spender, faceValue, expiresAt);
    }

    function topUp(bytes32 id, uint128 amount) external nonReentrant {
        Certificate storage c = _open(id);
        if (msg.sender != c.funder) revert NotFunder();
        if (block.timestamp > c.expiresAt) revert Expired();
        if (amount == 0) revert InvalidParams();
        uint128 newFace = c.faceValue + amount; // checked
        if (maxFaceValue != 0 && newFace > maxFaceValue) revert ExceedsCap();
        _addOutstanding(amount);
        _pullExact(amount);
        c.faceValue = newFace;
        emit CertificateToppedUp(id, amount, newFace);
    }

    function extend(bytes32 id, uint64 newExpiresAt) external {
        Certificate storage c = _open(id);
        if (msg.sender != c.funder) revert NotFunder();
        if (block.timestamp > c.expiresAt) revert Expired();
        if (newExpiresAt <= c.expiresAt || newExpiresAt > block.timestamp + MAX_LIFETIME) revert InvalidParams();
        c.expiresAt = newExpiresAt;
        emit CertificateExtended(id, newExpiresAt);
    }

    function reclaim(bytes32 id) external nonReentrant returns (uint256 refunded) {
        Certificate storage c = _open(id);
        if (msg.sender != c.funder) revert NotFunder();
        if (block.timestamp <= c.expiresAt) revert NotExpired();
        c.closed = true;
        refunded = uint256(c.faceValue) - c.redeemed;
        totalOutstanding -= refunded;
        if (refunded > 0) token.safeTransfer(c.funder, refunded);
        emit CertificateReclaimed(id, refunded);
    }

    // ───────── Anyone (for the payee) ─────────

    function redeem(bytes32 id, uint256 cumulative, bytes32 memo, bytes calldata signature)
        external nonReentrant returns (uint256 paid)
    {
        uint8 status;
        (paid, status) = _tryRedeem(id, cumulative, memo, signature);
        if (status == S_UNKNOWN) revert UnknownCertificate();
        if (status == S_CLOSED) revert Closed();
        if (status == S_EXPIRED) revert Expired();
        if (status == S_EXCEEDS) revert ExceedsFaceValue();
        if (status == S_NOTHING) revert NothingToRedeem();
        if (status == S_BAD_SIG) revert InvalidSignature();
    }

    struct SignedNote { bytes32 certificateId; uint256 cumulative; bytes32 memo; bytes signature; }

    /// @notice Batch redemption. Never reverts because of one bad or stale note: it skips it and emits
    ///         NoteSkipped. (A token-level transfer failure, e.g. a blocklisted payee, still reverts.)
    function redeemMany(SignedNote[] calldata notes) external nonReentrant returns (uint256 totalPaid) {
        for (uint256 i; i < notes.length; ++i) {
            (uint256 paid, uint8 status) =
                _tryRedeem(notes[i].certificateId, notes[i].cumulative, notes[i].memo, notes[i].signature);
            if (status != S_OK) emit NoteSkipped(notes[i].certificateId, notes[i].cumulative, status);
            totalPaid += paid;
        }
    }

    function _tryRedeem(bytes32 id, uint256 cumulative, bytes32 memo, bytes calldata signature)
        private returns (uint256 paid, uint8 status)
    {
        Certificate storage c = _certificates[id];
        if (c.funder == address(0)) return (0, S_UNKNOWN);
        if (c.closed) return (0, S_CLOSED);
        if (block.timestamp > c.expiresAt) return (0, S_EXPIRED);
        if (cumulative > c.faceValue) return (0, S_EXCEEDS);
        if (cumulative <= c.redeemed) return (0, S_NOTHING); // idempotent: already covered
        (address recovered, ECDSA.RecoverError err, ) = ECDSA.tryRecover(noteDigest(id, cumulative, memo), signature);
        if (err != ECDSA.RecoverError.NoError || recovered != c.spender) return (0, S_BAD_SIG);
        paid = cumulative - c.redeemed;
        c.redeemed = uint128(cumulative);
        totalOutstanding -= paid;
        token.safeTransfer(c.payee, paid);
        emit NoteRedeemed(id, cumulative, paid, memo, msg.sender);
        // status == S_OK (0)
    }

    // ───────── Views ─────────

    function getCertificate(bytes32 id) external view returns (Certificate memory) {
        return _certificates[id];
    }

    function noteDigest(bytes32 id, uint256 cumulative, bytes32 memo) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(NOTE_TYPEHASH, id, cumulative, memo)));
    }

    // ───────── Internal ─────────

    function _open(bytes32 id) private view returns (Certificate storage c) {
        c = _certificates[id];
        if (c.funder == address(0)) revert UnknownCertificate();
        if (c.closed) revert Closed();
    }

    function _addOutstanding(uint256 amount) private {
        uint256 next = totalOutstanding + amount;
        if (maxTotalOutstanding != 0 && next > maxTotalOutstanding) revert ExceedsCap();
        totalOutstanding = next;
    }

    function _pullExact(uint256 amount) private {
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) - before != amount) revert UnsupportedToken();
    }
}
```

**Verification status of this reference code:**
- v1.4 code compiled with solc 0.8.24 + OpenZeppelin 5.1.0 (`paris`).
- Smoke-tested on a local EVM (20 checks passed): per-certificate cap, **deployment-wide cap**, `totalOutstanding` accounting, payee ≠ contract, minimum lifetime, TS↔Solidity digest parity, stranger-redeem pays the payee, replay/`NothingToRedeem`, wrong signer, over-face-value, `redeemMany` skip codes `[6,1,5]`, the topUp cap, funder-only topUp, redeem-after-expiry, batch-after-expiry not reverting, reclaim refund math, **balance == totalOutstanding**, and double-reclaim.
- This is **not** a substitute for the Foundry suite in §7.4.

**Notes for the implementer:**
- The EIP-712 domain is exposed through OZ v5's `eip712Domain()` (EIP-5267). The SDK SHOULD read it rather than hard-code it.
- The deadlines never overlap. `redeem` is allowed while `now ≤ expiresAt`, and `reclaim` only while `now > expiresAt`.
- `redeemMany` **skips** unknown, closed, expired, over-face-value, already-covered and badly-signed notes (emitting `NoteSkipped` with a reason code) instead of reverting. One stale certificate can't sink a whole batch, for example a POS collecting a day's notes right at an expiry boundary. Only a token-level transfer failure (e.g. a blocklisted payee) reverts the batch. The redeemer still SHOULD only submit notes it has verified.
- There is deliberately no `cancel`, no `withdraw` before expiry, and no payee-side refund in v1.

### 7.3 MockUSDC (local anvil only)

An ERC-20 with `decimals() = 6`, `name = "Mock USD Coin"`, `symbol = "mUSDC"`.
- `faucet()` mints 100 mUSDC to the caller, with a 1-hour cooldown per address.
- There is no owner mint.
- The UI MUST label it as "Test money" everywhere.
- **Testnets use Circle's official testnet USDC** (faucet: `https://faucet.circle.com`), and mainnets use real USDC (§5.4). MockUSDC is never deployed to a public chain.

### 7.4 Tests (MUST pass before deploy)

**Unit tests (`FlyingMoney.t.sol`):**

1. Issue: stores fields, pulls exactly the face value, increments the nonce, and emits the event. The id matches the TS derivation.
2. Issue rejects: a zero payee or spender, `payee == contract`, zero face value, and lifetime below 1 h or above 365 d. A deployment made with a fee-on-transfer fixture token reverts `UnsupportedToken` on issue (defence in depth).
3. Redeem pays `cumulative − redeemed` to the **payee**, even when called by a stranger.
4. Redeem with an older or equal note → single call reverts `NothingToRedeem`; in a batch it pays 0 and emits `NoteSkipped(reason=5)`.
4b. `redeemMany` with a mix of valid, expired, bad-signature and unknown notes pays only the valid ones, emits one `NoteSkipped` per bad note with the right reason code, and never reverts.
4c. `issue` with `payee == address(this)` reverts `InvalidParams`.
4d. `issue` with `spender == msg.sender` (funder) or `spender == payee` reverts `InvalidParams`. A payee that could sign its own notes would be able to drain the certificate.
5. Redeem above face value → `ExceedsFaceValue`.
6. Redeem with a signature from anyone other than the spender → `InvalidSignature`. This includes the funder and the payee.
7. A high-s malleated signature is rejected.
8. A note signed for another chainId or contract is rejected (domain separation).
9. **ECDSA-only permanence:** give the spender address contract code (`vm.etch`, simulating EIP-7702 or a later deployment) whose `isValidSignature` returns true for garbage and false for everything else. Notes validated by ECDSA are still accepted, garbage is still rejected, and results are identical before and after the code change.
10. Redeem after expiry → `Expired`. Reclaim before or at expiry → `NotExpired`. Reclaim after expiry refunds the remainder and closes the certificate. Redeem after close → `Closed`.
11. TopUp and extend: funder only, only increases, only before expiry.
12. Reentrancy: a malicious token callback cannot re-enter redeem/reclaim.
13. Gas snapshot: `redeem` and `redeemMany(10)`. Record the numbers in `docs/SECURITY.md`.
14. Caps: an issue above `maxFaceValue` reverts `ExceedsCap`; a topUp crossing it reverts; an issue or topUp pushing `totalOutstanding` above `maxTotalOutstanding` reverts; 0 means unlimited; `totalOutstanding` decreases on redeem and reclaim.
14b. The constructor rejects a token address without code. `issue` has no token parameter; all transfers use the immutable `token`.
15. **Per-chain smoke test** (a script, not forge): on each registered testnet (Arbitrum Sepolia, Monad Testnet, Arc Testnet, Base Sepolia), issue 1 USDC → sign 3 notes → redeem → reclaim a short certificate. Run this on Arc Testnet specifically, because anvil doesn't reproduce Arc's USDC semantics.

**Invariant tests (`FlyingMoney.invariants.t.sol`), with a handler that randomly issues, tops up, extends, signs notes, redeems (sometimes out of order or duplicated), warps time and reclaims:**
- **I1** `redeemed ≤ faceValue` for every certificate.
- **I2** Solvency: `token.balanceOf(contract) == totalOutstanding == Σ over open certificates (faceValue − redeemed)` (no donations in the handler).
- **I2b** `totalOutstanding ≤ maxTotalOutstanding` whenever the cap ≠ 0.
- **I7** Monotonic redemption: `redeemed` never decreases, and each certificate's total payout equals its highest redeemed cumulative.
- **I3** The payee's received total equals the maximum valid cumulative redeemed for its certificates.
- **I4** The funder's total outflow ≤ the total face value it issued.
- **I5** No certificate pays anyone other than its payee (redeem) or its funder (reclaim).
- **I6** After reclaim, no further transfers occur for that certificate.

**Off-chain protocol property tests (vitest, MUST):**
- **C1** *No obligation growth on failure:* inject network drops, timeouts and process crashes (kill between sign, save and send) at random points over 1,000 requests. The highest cumulative ever signed equals `Σ price(SERVED) + credit`, and no crash produces a higher note.
- **S1** *Replay safety:* replaying any accepted note (same `requestId`) any number of times produces no extra `consumed` and no extra side effect. The application counter shows exactly-once execution.
- **S3** *Failure becomes credit:* a failing service leaves `credit = P`, and the next request with `next == accepted` succeeds without a higher signature.
- **S4** *Concurrent reservation safety:* 10–100 concurrent requests with distinct `requestId`s and the **same** cumulative (and mixed older and newer cumulatives), run against **both** the memory store and Redis. At every observable state, `consumed + reserved ≤ accepted ≤ faceValue` and `Σ price(SERVED ∪ PENDING) ≤ accepted − consumed₀`. With `accepted = 10` and ten 10-unit requests, exactly one is admitted.
- **Sweeper:** a PENDING record past the timeout resolves via the application status (`done` → SERVED, `failed`/`not-started` → credited). A racing client retry never double-finishes.
- **Redemption policy:** the redeemer never submits a note above `consumed`. Unspent credit is left in the certificate and returned at reclaim (end-to-end on anvil).
- **Store loss / recovery:** wipe the seller store mid-run. The state rebuilds as `RECOVERED` with `accepted = consumed = redeemedOnChain`. No note at or below `redeemedOnChain` is accepted as new value. The buyer's credit is never reduced. The seller's loss is ≤ its unredeemed served value at wipe time, which is asserted against the redeemer's lag bounds.
- **Offline POS:** GUARANTEED only for previously verified certificates; UNVERIFIED capped by the first-visit limit.

**TS↔Solidity parity test:** the `noteDigest` computed by `@flying-money/core` equals the contract's `noteDigest` for 100 random inputs (a forge FFI test or a viem test against anvil).

### 7.5 Deployment (multi-chain)

**One script, every chain.** `script/Deploy.s.sol` takes `CHAIN_KEY`, reads the constructor cap from the registry (0 on testnets, `100_000_000` on mainnets), deploys, and prints the address. `pnpm deploy:all` then writes addresses and `deployedBlock` into `packages/chains/src/deployments.json`.

- **Constructor arguments per chain:** `(usdc, maxFaceValue, maxTotalOutstanding)`. Testnets use `(chainUSDC, 0, 0)`. Mainnets use `(chainUSDC, 100_000_000, 1_000_000_000)`, i.e. 100 USDC per certificate and 1,000 USDC in total.
- **Addresses differ per chain** (the token and caps are part of the init code), and so does the deployed bytecode (immutables). **The accurate claim is "same source code and protocol on every supported chain"**, never "identical bytecode" or "same address". Source verification on each explorer proves it.
- **Verify** each deployment on its explorer (Arbiscan, Monad explorer, Arc explorer, Basescan) using `forge verify-contract`.

**Deployment order (matches deadlines, §17):**

| Order | Chain | Needed for | Deadline |
|---|---|---|---|
| 1 | Arbitrum Sepolia (+ Arbitrum One, capped) | Arbitrum Open House Singapore buildathon | **4 Oct 2026** |
| 2 | Base Sepolia (+ Base, capped) | Colosseum World's Fair (Base/EVM track) | 12 Oct 2026 |
| 3 | Monad Testnet + Monad mainnet (143, capped) | Monad Metropolis | 13 Oct 2026 |
| 4 | Arc Testnet + **Arc mainnet (5042, capped)**, required | Arc Microgrants (DoraHacks), which requires a running mainnet deployment | Applications close 14 Oct 2026 |

**Mainnet safety rules (MUST):**
- Mainnet deployments carry both caps (100 USDC per certificate, 1,000 USDC deployment-wide).
- The UI shows "Unaudited · real USDC · per-certificate cap 100 · deployment-wide cap 1,000".
- Demo runners on mainnet use at most **5 USDC** in total.
- Deployer and demo keys are single-purpose and hold only the gas and USDC needed.

## 8. SDK (TypeScript, viem)

All packages are ESM, strictly typed, and tree-shakeable. Amounts are `bigint`.

### 8.1 `@flying-money/core`

```ts
export type Hex = `0x${string}`
export interface Certificate {
  id: Hex; funder: Hex; payee: Hex; spender: Hex   // token is per deployment (registry), not per certificate
  faceValue: bigint; redeemed: bigint; expiresAt: bigint; closed: boolean
}
export interface Note { certificateId: Hex; cumulative: bigint; memo: Hex }
export interface SignedNote extends Note { chainId: number; contract: Hex; sig: Hex }
export interface Accept { chainId: number; contract: Hex; token: Hex; payee: Hex }
export interface Offer {
  scheme: 'flying-money'; v: 1; price: bigint; minRemainingLifetime: number
  accepts: Accept[]; suggestedFaceValue?: bigint; memoHint?: string; docs?: string
}
export interface Receipt {
  certificateId: Hex; requestId: Hex; status: 'SERVED' | 'FAILED_CREDITED'
  accepted: bigint; consumed: bigint; reserved: bigint; credit: bigint
  remaining: bigint; expiresAt: bigint; sig?: Hex
}

export const noteTypes: { Note: readonly [...] }
export function domain(chainId: number, contract: Hex): TypedDataDomain
export function certificateId(chainId: number, contract: Hex, funder: Hex, nonce: bigint): Hex
export function hashNote(chainId: number, contract: Hex, note: Note): Hex
export function signNote(account: LocalAccount | WalletClient, chainId: number, contract: Hex, note: Note): Promise<SignedNote>
export function verifyNoteSignature(signed: SignedNote, spender: Hex): boolean // pure ECDSA recovery; no RPC, works offline
export function newRequestId(): Hex // 32 random bytes
export function encodeHeader(obj: SignedNote | Offer | Receipt): string   // 'fm1.' + base64url(JSON with bigint→string)
export function decodeNote(header: string): SignedNote                    // strict parser; throws on unknown/malformed
export function decodeOffer(header: string): Offer
export const flyingMoneyAbi: Abi
```

**Parsing rules:**
- Integers are decimal strings matching `^(0|[1-9][0-9]*)$`.
- Hex values are fixed-length.
- The header is at most 2 KB.
- Unknown fields → reject.
- `v` must equal 1.

### 8.2 `@flying-money/client` (spender side)

```ts
const fm = createFlyingMoneyClient({
  chains: ['arbitrum-sepolia', 'monad-testnet', 'arc-testnet'], // registry keys; RPC/contract/USDC resolved from @flying-money/chains
  preferredChains: ['arc-testnet'],  // order used when an offer accepts several chains
  spender: privateKeyToAccount(process.env.AGENT_KEY!),
  store: fileStore('.flying-money.json'), // durable outbox (§6.6): accepted/consumed + the single pending note per certificate, fsync'd before send; memoryStore() for tests
  certificates: ['0x…'],           // certificate ids this agent may use (issued by the funder)
  maxPricePerRequest: parseUnits('0.05', 6), // safety: refuse offers above this
  onPayment: (e) => {},            // hook: { url, price, cumulative, certificateId }
})

const res = await fm.fetch('https://oracle.flyingmoney.xyz/v1/tea-price?city=Chang%27an')
fm.status() // [{ id, payee, faceValue, spentLocal, redeemedOnChain, remaining, expiresAt }]
```

**Behaviour:**
- Implements §6.6: durable outbox, one pending note per certificate, resend-same-note on failure or restart, and never a higher note because of a network failure.
- A per-certificate mutex.
- Exposes `fm.resolvePending()` (runs automatically at startup).
- Refuses offers whose `payee` has no matching certificate (`NoCertificateError` with the offer attached), and prices above `maxPricePerRequest` (`PriceTooHighError`).
- Refreshes certificate state from the chain at startup and when a 402 reports `insufficient`.
- **Never signs a cumulative above `faceValue`.**
- Emits events for the demo UI.

**CLI:** `npx @flying-money/client keygen [--out .env]` creates an agent key locally and prints only the address. This is the recommended way to create agent keys.

**Also exports a tool-calling adapter for LLM agents:**
```ts
export function paidFetchTool(fm): { name: 'paid_fetch', description, parameters, execute }
```

### 8.3 `@flying-money/server` (payee side)

```ts
import { flyingMoney } from '@flying-money/server/hono' // also /express, /next adapters

app.use('/v1/*', flyingMoney({
  accepts: ['arbitrum-sepolia', 'monad-testnet', 'arc-testnet', 'base-sepolia'], // registry keys → offer.accepts[]
  payee: process.env.PAYEE_ADDRESS,                // same payee address on every EVM chain
  price: (c) => priceTable[c.req.path] ?? parseUnits('0.01', 6),
  minRemainingLifetime: 3600,
  store: redisStore(process.env.REDIS_URL) ?? memoryStore(),
}))

// Handlers receive the verified payment context; side-effecting work MUST be idempotent on requestId (§6.5 S1):
app.post('/v1/generate', async (c) => {
  const { requestId } = c.get('flyingMoney')
  return c.json(await jobs.runOnce(requestId, () => generate(await c.req.json())))
})

startRedeemer({
  chains: ['arbitrum-sepolia', 'monad-testnet', 'arc-testnet', 'base-sepolia'], store, // one loop per chain
  redeemerAccount: privateKeyToAccount(process.env.REDEEMER_KEY!), // needs gas per chain (ETH on Arbitrum/Base, MON on Monad, USDC on Arc); funds go to the payee regardless
  policy: { minAmount: parseUnits('1', 6), maxAgeSeconds: 3600, safetyBeforeExpiry: 1800 },
  onRedeemed: (e) => {},  // { txHash, certificateId, cumulative, paid }
})
```

**Store interface (`begin` and `finish` MUST each be a single atomic transaction).** Keys are chain-namespaced: `CertKey = \`${chainId}:${certificateId}\``.
```ts
type CertKey = `${number}:${Hex}`
interface NoteStore {
  state(key: CertKey): Promise<{ accepted: bigint; consumed: bigint; reserved: bigint; status: 'OK' | 'RECOVERED' } | null>
  bestNote(key: CertKey, maxCumulative: bigint): Promise<SignedNote | null>   // highest stored note with cumulative ≤ maxCumulative
  outcome(key: CertKey, requestId: Hex): Promise<{ status: 'PENDING' | 'SERVED' | 'FAILED_CREDITED'; price: bigint; responseRef?: string } | null>
  begin(key: CertKey, requestId: Hex, price: bigint, note: SignedNote, faceValue: bigint):
    Promise<'ADMITTED' | 'DUPLICATE' | 'INSUFFICIENT'>   // atomic §6.5 step 7: re-checks S2 inside the transaction; reserved += price
  finish(key: CertKey, requestId: Hex, ok: boolean, responseRef?: string): Promise<'DONE' | 'NOT_PENDING'> // atomic step 9; only from PENDING
  stalePending(olderThanMs: number): Promise<Array<{ key: CertKey; requestId: Hex }>>                  // for the sweeper
  recover(key: CertKey, redeemedOnChain: bigint): Promise<void>                                         // §6.5 Recovery
  markRedeemed(key: CertKey, cumulative: bigint, txHash: Hex): Promise<void>
  pendingRedemptions(chainId: number): Promise<Array<{ key: CertKey; note: SignedNote; redeemedOnChain: bigint }>>
  getSubmission(chainId: number): Promise<{ txHash: Hex; keys: CertKey[] } | null>   // one in-flight batch per chain
  setSubmission(chainId: number, s: { txHash: Hex; keys: CertKey[] } | null): Promise<void>
}
```
Implementations: `memoryStore()` (tests, single-process demo), `redisStore(url)` (multi-instance sellers; CAS via a Lua script or `WATCH/MULTI`), `indexedDbStore()` (the POS PWA).

**Redeemer rules (idempotent submission, ported idea):**
1. Candidate note per certificate = `bestNote(key, consumed)`, i.e. **only served value** (§6.5 redemption policy). Pick certificates where `candidate − redeemedOnChain ≥ minAmount`, or where the oldest unredeemed served value is older than `maxAgeSeconds`, or where `expiresAt − now ≤ safetyBeforeExpiry`.
2. If a submission with a known `txHash` exists, **wait for or check its receipt; never rebroadcast blindly.**
3. Batch up to 20 notes into `redeemMany`. Record the `txHash` *before* waiting.
4. On confirmation, parse `NoteRedeemed`/`NoteSkipped` events. `markRedeemed` the paid ones, log the skipped ones with their reason, and clear the submission. On revert (a token-level failure), re-read the chain, clear, and alert the operator.

**Certificate cache:** keyed by id; refreshed on demand (§6.2); `faceValue` and `expiresAt` only increase, so the cache is safe.

### 8.4 `@flying-money/mcp`: MCP server (agents such as Claude and Hermes)

This is a stdio + streamable-HTTP MCP server, so any MCP-capable agent can pay with a certificate. That includes Claude (Desktop/Code), Hermes-based agents, and others.

**Tools:**

| Tool | Input | Output | Notes |
|---|---|---|---|
| `fm_status` | — | certificates: chain, payee, face value, spent, remaining, expiry | Read-only |
| `fm_paid_fetch` | `url`, `method?`, `body?`, `max_price?` | the response body + receipt (price, cumulative, remaining) | Handles 402 → sign → retry; refuses above `max_price` and the configured per-request cap |
| `fm_quote` | `url` | the offer (price, accepted chains) without paying | Lets the agent ask before spending |
| `fm_explain` | — | plain-language rules: "you can only pay these payees, up to these amounts" | Helps the model plan within its budget |

**Configuration:** the agent key and certificate IDs come from env or a config file. **The MCP server never exposes the private key.** There is no tool to issue certificates. Issuing is the funder's job in the Counting House, which keeps agents unable to raise their own budget.

**Docs:** `/docs/mcp` with copy-paste config for Claude Desktop/Code and a generic MCP client.

---

## 9. Security model and threat analysis

This content is published as `docs/SECURITY.md` and summarised on the Guarantees page.

| Threat | Outcome | Why |
|---|---|---|
| Agent (spender) key stolen | Attacker can pay **only the named payee**, up to the remaining face value | Payee-scoped + cap |
| Agent goes rogue or loops | Spending stops at the face value; the client also enforces `maxPricePerRequest` | Cap enforced on-chain and by the client |
| Payee tries to overcharge | Impossible beyond notes the spender signed | Notes are cumulative totals signed by the spender |
| Payee serves nothing | The funder loses up to what the agent signed | Payment ≠ service; bounded by the face value |
| Funder tries to pull funds early | Impossible | No cancel; reclaim only after expiry |
| Funder issues a certificate with very short expiry | Rejected below 1 h by the contract; servers require `minRemainingLifetime` | §7.1, §6.5 |
| Replay on another chain/contract | Invalid | EIP-712 domain |
| Signature malleability | Rejected | OZ ECDSA low-s |
| Front-running a redeem | Harmless | Funds always go to the payee |
| Payee runs 2 servers without a shared store | The payee may serve more than it can redeem (the payee's own loss) | Documented; the store must be shared |
| Payee misses expiry | The payee loses unredeemed value | The redeemer's safety margin and alerts |
| Hostile or unusual token behaviour | Out of the attack surface | One immutable token per deployment (Circle USDC). Balance-delta check as defence in depth |
| ERC-1271 / contract-signature revocation | Not applicable | Spenders are ECDSA-only; validity never depends on chain state (§7.1 #6) |
| Buyer retries after a timeout | No double charge, no duplicate side effect | `requestId` idempotency (§6.5 S1) |
| Buyer crashes mid-request | No higher note is ever signed; the pending note is resent | Durable outbox (§6.6 C1) |
| Seller crashes after accepting, before serving | The buyer's retry resumes it; otherwise the sweeper resolves it via the application's idempotency status (done → served; not started → credit) | §6.5 steps 4, 9, 10 |
| Adversarial spender sends many concurrent requests reusing the same credit | Only as many are admitted as `accepted − consumed − reserved` allows | `reserved` + atomic re-check in `begin` (S4) |
| Funder accidentally uses its own wallet as the spender, or sets payee = spender | Rejected by the contract | Key isolation is structural (`issue` checks) |
| Unaudited contract bug on mainnet | Exposure is bounded deployment-wide | `maxTotalOutstanding` (1,000 USDC) + `maxFaceValue` (100 USDC) |
| Stablecoin freeze or blacklist | Funds stuck | Inherent to the token; disclosed |
| RPC lies to the server | The server may accept notes against a fake certificate | Use a trusted RPC; optional multi-RPC check; disclosed |
| Customer's phone stolen (people & shops) | The thief can spend only at the named shop(s), up to the remaining face value | Payee-scoped + cap; the funder can't revoke (by design), so keep face values small; the phone key is PIN-encrypted |
| Shop with several POS devices offline, unsynced | The same cumulative note range may be accepted twice across devices (the shop's own loss) | Primary-POS rule or per-device offline float (§6.8) |
| Gift link forwarded or leaked | Whoever holds the link can spend it (at that shop only) | Treat gift links like cash; the gift page says so |
| First-time customer while the POS is offline | The POS can't verify the certificate exists; a fabricated certificate is possible | Shown as **UNVERIFIED · merchant risk**, not Accepted; capped by the shop's first-visit limit; checked on reconnect (§6.8) |
| Agent tries to raise its own budget via MCP | Impossible | The MCP server has no issue/topUp tools; the agent key isn't the funder |

| Seller's store is wiped or a new server starts | A note at or below on-chain `redeemed` must not count as new value; served-but-unredeemed history is lost | §6.5 Recovery: `RECOVERED` state; the seller bears ≤ its redemption lag; the buyer never loses credit; the store must be durable and backed up |
| Onlookers analyse the chain | They see funder → contract → payee flows, amounts, times, and the random spender address; they don't see names | §3.9 key & privacy policy: fresh keys for people, names never on-chain, optional separate funder address |
| Fake "shop" in Places (address spoofing) | A funder could lock money for a scammer's address | Places are added by scanning the shop's counter QR in person, or from a seller's `/.well-known/flying-money.json` on its own domain. Hand-typed places are labelled "unverified" (§12.6) |

**Out of scope (stated plainly):** paying strangers offline; strong privacy (flows are public on-chain; only names are kept off-chain); freezing a certificate early (by design, §3.8); disputes and refunds.

**Audit status:** not audited. Invariant- and property-tested. Testnets, plus mainnets with immutable caps (100 USDC per certificate, 1,000 USDC deployment-wide). Say this on every page that handles funds.

---

## 10. Website (apps/web)

A single Next.js app serves the marketing site, docs, the Counting House app and the live demo.

### 10.1 Sitemap

| Route | Page | Purpose |
|---|---|---|
| `/` | Landing | Story hook → problem → how it works → live demo → guarantees → for developers → CTA |
| `/story` | 804 CE | The heritage story of feiqian, and how it maps to agents |
| `/how-it-works` | Mechanism | Four-step visual explainer + lifecycle diagram |
| `/demo` | Live demo | Agent ↔ Oracle, live on any registered chain via the chain selector (§13) |
| `/app` | Counting House | Issue and manage certificates (funder); receive and redeem (payee) (§12) |
| `/app/people` · `/app/people/[id]` | People & agents | The holder list and per-holder control pages (§12.6) |
| `/app/places` | Places | Verified and unverified places (§12.6) |
| `/c/[chain]/[id]` | Certificate | Public view of one certificate on one chain (`chain` = registry key): terms, notes redeemed, events, explorer links |
| `/chains` | Deployments | Every chain, contract address (with explorer link), USDC address, cap, status (testnet/mainnet). Pulled from `@flying-money/chains` |
| ~~`/hackathons/[event]`~~ | **Removed in v1.5** | Replaced by `/chains/[chain]` + `?chain=` preselection (§21.2). Event materials live only in `docs/submissions/` |
| `/guarantees` | Guarantees | What is and isn't guaranteed; threat table; "why we removed offline cash" |
| `/docs` | Docs home | Quickstart for buyers (agents) and sellers (APIs) |
| `/docs/protocol` | Spec | §6 rendered |
| `/docs/contract` | Contract | ABI, addresses, events, errors |
| `/docs/client` · `/docs/server` | SDK | API reference + examples |
| `/docs/faq` | FAQ | x402 relation, offline, fees, tokens, chains |
| `/pitch` | One-pager | For judges: problem, solution, demo video, links, team |
| `/shops` | For people & shops | The second front door: tabs, allowances, gift certificates, employee spend; the POS demo |
| `/shop/[chain]/[payee]/pos` | POS | The shop's counter page: enter price → price QR → scan note → Accepted; "Collect" (redeem) (§12.5) |
| `/wallet` | Customer wallet | PWA holding certificate keys: scan price QR → review → show sealed-note QR (§12.5) |
| `/gift/#…` | Gift claim | Opens a gift certificate from a link fragment into the wallet |
| `/docs/agents` · `/docs/mcp` | Agent docs | How agents (Claude, Hermes, any LLM) pay; MCP config |
| `/llms.txt` · `/llms-full.txt` · `/docs/*.md` · `/.well-known/flying-money.json` | Machine-readable | Agent-readable docs kit (§10.7) |

### 10.2 Landing page: section by section, with copy

**Hero**
- Eyebrow: `飛錢 · FLYING MONEY`
- H1: **Give your AI agent a sealed certificate, not your wallet.**
- H1 variant (used on `/shops` and on payments-track event pages): **A prepaid certificate for the places you pay often. Capped for the holder, reserved for the shop.**
- Under the H1, a two-option toggle, **For agents | For people & shops**, swaps the sub-copy and the hero animation (agent → API, or phone → café counter).
- Sub: *Lock a budget for one seller. Your agent pays per request with signed notes the seller checks instantly. The seller redeems everything in one transaction. Your agent can't spend past the limit, and every note it signs is backed by money reserved for that seller.*
- CTAs: **Watch an agent pay** (→ /demo) · **Read the 804 CE story** (→ /story)
- Visual: a paper certificate with a vermilion seal, split into two halves that slide together. On hover or scroll, small notes fly from an agent icon to a merchant stall.
- Badge row: chain logos **Arbitrum · Monad · Arc · Base** with the caption "Same protocol, every chain". Each logo links to `/chains`. Status text: `Testnets + capped mainnets · unaudited`

**Section 1: "In 804 CE, merchants stopped carrying coins."**
> Tea merchants in Tang-dynasty China faced a shortage of copper coin and dangerous roads. So they deposited coin with an official office and carried a certificate instead, made of matching halves and redeemed in another city. People called it *飛錢*: **flying money**. The value travelled; the coins stayed safe.
> *(link: Read the story →)*

**Section 2: "AI agents have the same problem."**
Three cards:
- *Give it your card?* Unbounded risk if it loops or gets hijacked.
- *Pay on-chain per request?* Too slow and too costly at a tenth of a cent a call.
- *Promise to pay later?* Sellers can't trust an anonymous agent.

**Section 3: How it works (four steps with icons)**
1. **Issue.** Lock 5 USDC for *one seller*, usable by *one agent key*, until a date.
2. **Seal.** Every request carries a signed note: *"total so far: 0.37"*.
3. **Serve.** The seller verifies the note locally in milliseconds. No transaction, no waiting. It keeps working even if the network blinks.
4. **Redeem.** The seller redeems the latest note in one transaction. Leftover funds return to you after expiry.

**Section 4: Live numbers** (reads from the chain and the demo API; hidden if unavailable)
`Certificates issued · Notes accepted · Redemptions · Requests per redemption`
*Every number links to the explorer.*

**Section 5: Guarantees (two columns)**
- *What's guaranteed:* the spender can't authorize beyond face value, even with a stolen key · every redeemable note is backed by funds reserved for that seller until expiry · anyone can redeem, but the value only reaches the named seller · you get the remainder back after expiry.
- *What isn't:* that the seller delivers · that the seller redeems before expiry (its SDK does this automatically) · stablecoin freezes · this is unaudited testnet software.

**Section 5b: "Not only agents."** A tabbed band: *Agents* · *Regulars' tabs* · *Allowances* · *Gift certificates* · *Teams*. Each tab has one sentence and an illustration, plus a CTA to `/shops`. Copy: *"Anyone who spends on your behalf (an agent, a child, an employee, a friend with a gift) gets a certificate for one place, with a hard limit. Every note they sign is backed by money reserved for that shop."*

**Section 5c: "No wallet needed to spend."** *"Give your kid, employee or friend a certificate as a link or QR. They set a PIN and pay by showing a QR. No wallet, no crypto, no gas. Only the giver needs USDC. Unused balance returns to the giver."*

**Section 6: For developers**
Two code tabs, "Buy (agent)" and "Sell (API)", showing 8–10 line snippets from §8.2 and §8.3. Link to /docs.

**Section 7: Why we're honest about offline**
> We started out building offline cash. Our own adversarial review proved software alone can't stop someone paying two offline strangers with the same money, so we removed it. Flying Money only promises what the math guarantees.
*(→ /guarantees)*

**Footer:** GitHub · Docs · Deployments (`/chains`) · Hackathon pages · MIT · "Testnets + capped mainnets · unaudited"

### 10.3 `/story` page

A long-form scroll narrative in four chapters:
1. **Chang'an, 804.** Copper shortage; merchants on the roads; deposits at official offices; certificates of matching halves; the fee (about 100 per 1,000 coins); official adoption in 812 under Emperor Xianzong.
2. **What made it work.** Deposit before travel (prefunded). A certificate tied to a redemption (scoped). Halves that must match (verifiable). Value that moved without coins moving (deferred settlement).
3. **1,222 years later.** Agents are the new merchants; APIs are the new cities.
4. **Flying Money today.** The mapping table (certificate ↔ certificate, halves ↔ signature + chain record, the redemption office ↔ the contract).

**Sources** at the bottom: Wikipedia "Flying cash", Britannica "Feiqian". **Historical claims MUST link to sources, and no invented details.**

### 10.4 `/how-it-works`

An interactive lifecycle: issue → notes → redeem → reclaim. Each step shows the exact on-chain or off-chain data, with a toggle for "plain words / technical".

### 10.5 `/c/[chain]/[id]` certificate page

- **Header:** "Certificate 0x12…ab". Status chip: Open · Expired · Closed.
- **Terms card:** funder, payee, spender (short addresses with copy buttons), token, face value, redeemed, remaining (a progress bar styled as a paper strip), expiry countdown.
- **Timeline** of events (Issued, ToppedUp, Extended, NoteRedeemed with requests-covered if known, Reclaimed), each linked to the explorer.
- **"Verify it yourself"** accordion: raw calls to read this from the chain.

### 10.6 `/guarantees`

Renders §3.4 and §9 in plain language, followed by "What we removed and why" (§2.3, condensed) and the audit status.

### 10.7 Agent-readable docs kit (MUST)

Agents such as Claude and Hermes read documentation differently from humans. Every doc page therefore has a machine-friendly twin, and the whole site is discoverable.

| File / route | Content | Generated from |
|---|---|---|
| `/llms.txt` | A concise index per the llms.txt convention: an H1, a one-paragraph summary, then link sections to `.md` pages | Hand-written template + route list |
| `/llms-full.txt` | All docs concatenated as plain markdown (protocol, contract, SDK, MCP, guarantees, FAQ, chain table) | Build step from `docs/*.md` + MDX |
| `/docs/<page>.md` | A raw markdown twin of every `/docs/<page>` | MDX → md at build |
| `/.well-known/flying-money.json` | Machine-readable deployments: chains, contract addresses, USDC addresses, caps, EIP-712 domain/types, header names, spec version | `@flying-money/chains` |
| `/.well-known/flying-money.json` **on sellers** (the Oracle and any SDK user) | The seller's `accepts[]`, price table and docs link, so agents can discover pricing without a 402 round-trip | `@flying-money/server` auto-serves it |
| `AGENTS.md` (repo root) | For *coding* agents working in the repo: structure, commands (`pnpm test`, `forge test`), invariants never to break, the §4.2 deleted list, style rules | Hand-written |
| `packages/mcp/README.md` | MCP install + config for Claude Desktop/Code and generic clients | Hand-written |
| OpenAPI for the Oracle | `/openapi.json`, including the 402 response schema | Hono OpenAPI plugin |

**`/llms.txt` draft:**

```markdown
# Flying Money

> Sealed spending certificates for AI agents, people and devices. A funder locks USDC for ONE payee, spendable by ONE spender key until expiry. The spender pays with EIP-712 "notes" signed over a cumulative total; the payee verifies locally and redeems the latest note on-chain in one transaction. Same contract on Arbitrum, Monad, Arc and Base. No token.

Key rules for agents:
- You can only pay the payee named on your certificate, never more than its face value.
- On HTTP 402 with a `Flying-Money-Offer` header, sign a Note with cumulative = max(accepted, consumed + price) and memo = a fresh requestId, save it, and retry with `Flying-Money-Note`. On a timeout, resend the SAME note. Never sign a higher one because of a network failure.
- Never sign a cumulative above face value. Never ask the user for their main wallet key.

## Docs
- [Quickstart for agents](https://flyingmoney.xyz/docs/agents.md): pay a Flying Money API in 5 lines
- [MCP server](https://flyingmoney.xyz/docs/mcp.md): tools fm_status, fm_quote, fm_paid_fetch, fm_explain
- [Protocol](https://flyingmoney.xyz/docs/protocol.md): EIP-712 types, headers, verification algorithm
- [Contract](https://flyingmoney.xyz/docs/contract.md): functions, events, errors, addresses
- [Sellers](https://flyingmoney.xyz/docs/server.md): accept notes with middleware
- [People & shops](https://flyingmoney.xyz/docs/shops.md): QR counter flow

## Reference
- [Deployments (JSON)](https://flyingmoney.xyz/.well-known/flying-money.json)
- [Guarantees & threat model](https://flyingmoney.xyz/docs/guarantees.md)

## Optional
- [Story: flying money, 804 CE](https://flyingmoney.xyz/docs/story.md)
- [FAQ](https://flyingmoney.xyz/docs/faq.md)
```

**Rules:**
- Every code sample in docs MUST be runnable and tested in CI (extract and typecheck).
- Machine docs MUST NOT contain marketing claims beyond the Guarantees page.
- Use the domain placeholder until the real domain is chosen.

---

## 11. Visual design system: "Paper, Ink, Seal"

### 11.1 Principles

- **Heritage, not costume.** Evoke Tang material culture (paper, ink, seals, silk-road lines) with restraint. No faux-Asian "chop-suey" fonts, no dragons or lanterns clip art, no stereotypes. Have a native Chinese reader review any Chinese text.
- **Functional clarity first.** Numbers, addresses and states use clean modern type.
- **Every seal means something.** The vermilion seal appears *only* when something is actually signed or verified. It is a semantic element, never decoration.

### 11.2 Tokens

```css
:root {
  --paper:        #F4EDE0;  /* rice paper (light bg) */
  --paper-2:      #EAE0CD;  /* card */
  --ink:          #1B1A17;  /* text */
  --ink-2:        #4A463F;  /* secondary text */
  --seal:         #B7322C;  /* vermilion seal (signatures, CTAs) */
  --ochre:        #C08A3E;  /* accents, value flow */
  --indigo:       #2E3F5C;  /* links, chain/on-chain */
  --celadon:      #7FA38F;  /* success / redeemed */
  --line:         #CDBFA6;  /* borders, brush dividers */
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #15130F; --paper-2: #1F1C17; --ink: #EFE7D8; --ink-2: #B9AE9B;
    --seal: #D2473F; --ochre: #D3A25C; --indigo: #8FA6CF; --celadon: #93BCA5; --line: #3A342B;
  }
}
:root[data-theme="dark"] {
  --paper: #15130F; --paper-2: #1F1C17; --ink: #EFE7D8; --ink-2: #B9AE9B;
  --seal: #D2473F; --ochre: #D3A25C; --indigo: #8FA6CF; --celadon: #93BCA5; --line: #3A342B;
}
```

- **Type:** a serif with calligraphic warmth for display (e.g. "Cormorant Garamond" or "Noto Serif"). "Inter" for UI. A mono for hashes ("JetBrains Mono"). For the Chinese display mark 飛錢, use "Noto Serif TC" (traditional characters) or "Ma Shan Zheng" (brush), used once or twice per page.
- **Texture:** a subtle paper-grain SVG noise at 3–4% opacity. Brush-stroke SVG dividers.
- **Motion:** the seal stamp (scale 1.15 → 1, 180 ms, slight rotation); tally halves joining on redeem (the two halves translate together, 400 ms); notes flying along a curved path (the demo only); `prefers-reduced-motion` respected.

### 11.3 Core components

`Certificate` (paper card with torn-edge halves, face value, seal), `SealStamp`, `NoteChip` (cumulative amount, with a tiny seal), `TallyProgress` (redeemed/face strip), `AddressPill`, `ChainLink` (explorer link, indigo), `StatusChip` (Open/Expired/Closed; Signed/Accepted/Redeemed), `CodeTabs`, `TestMoneyBanner`.

### 11.4 Vocabulary (UI ↔ code)

| UI (primary) | Plain hint | Code |
|---|---|---|
| Certificate | spending allowance for one seller | `Certificate` |
| Face value | budget | `faceValue` |
| Sealed note | signed running total | `Note` |
| Seal | signature | `signature` |
| Redeem | collect payment | `redeem` |
| Reclaim | take back unused funds | `reclaim` |
| Counting House | dashboard | `/app` |
| Agent key | spender | `spender` |

The status sequence always shown to users: **Sealed → Accepted by seller (GUARANTEED) → Redeemed on-chain.** Never show "paid" before "Redeemed". An offline first-time acceptance shows **Unverified · merchant risk** (amber, no seal), never "Accepted".

---

## 12. The Counting House (apps/web `/app`)

### 12.1 Connect and chain selection

- wagmi + ConnectKit, configured with every chain in `@flying-money/chains`. A **chain selector** (logos) sits in the header and defaults to the event's chain when the user arrives from `/hackathons/[event]`. Mainnets are hidden behind a "Show mainnets (real money)" toggle.
- **Arc:** gas is paid in USDC. Show one USDC balance, never separate "native" and "token" rows (Arc docs).
- Handle the wrong network with a switch prompt.
- On testnets, the banner reads "Test money only" and links to the chain's gas faucet and **Circle's USDC faucet** (`faucet.circle.com`). On mainnets it reads: "Real USDC · unaudited · capped at 100 USDC per certificate".

### 12.2 Funder view: "Certificates you issued"

**Issue wizard (3 steps, each ≤1 screen):**
1. **Who can be paid?** Pick from **Places** (§12.6), or add one: scan a shop's counter QR, enter a seller domain (read from its `/.well-known/flying-money.json`), or paste an address (labelled "unverified"). The demo Oracle is pre-listed.
2. **Who can spend?** Pick from **People & agents**, or add one. The key policy follows §3.9: a fresh key per certificate for people, one key per agent.
   - **Recommended: bring an agent address.** Generate the key where the agent runs (`npx @flying-money/client keygen` writes `.env` locally and prints only the address) and paste the address here.
   - **Convenience: generate in browser.** Uses `crypto.getRandomValues` (viem `generatePrivateKey`), is shown **once**, and downloads a `.env`. It is never sent to any server and never stored by the site. It's labelled "Only for testing or small budgets".
   - Or paste an existing EOA address. Smart-contract spenders are not supported in v1 (§7.1 #6).
3. **Budget and time.** Face value (USDC; the UI enforces the chain's `maxFaceValue`) and expiry (presets: 1 day, 7 days, 30 days; minimum 1 h).

**Review → approve token → `issue`.** On confirmation, play the seal animation. Show the certificate id and a snippet:
```ts
certificates: ['0x…']  // add to your agent config
```

**List:** a card per certificate (status, remaining, expiry countdown, payee name). Actions: **Top up**, **Extend**, **Reclaim** (enabled after expiry), **Open page** (`/c/[chain]/[id]`).

### 12.3 Payee view: "Certificates you can redeem"

- Lists certificates where `payee == connected address` (use event logs filtered by payee).
- For each: face value, redeemed.
- **"Latest note"** comes from:
  - (a) the seller's server, if a `NOTE_FEED_URL` is configured (the demo Oracle exposes `/fm/redeemable/:id`, which returns the highest stored note with `cumulative ≤ consumed`, per the §6.5 redemption policy; auth-less for the demo); or
  - (b) a pasted note header.
- **Redeem** button → the `redeem` tx → the tally-halves animation → the event shows `paid`.
- Explain that anyone can press redeem and the funds still go to the payee.

### 12.4 Transaction UX rules (ported idea)

- States: preparing → awaiting wallet → submitted (hash + explorer link) → confirming → confirmed/failed.
- Never show success before the receipt.
- Once a hash is known, the retry button becomes "Check status", not "Send again".

### 12.5 Shop mode: POS + customer wallet (people & shops front door)

**Shop owner (payee):**
- "Open a shop" in the Counting House: name, logo, chain, payee address (connected wallet), optional price list. This produces a shop page `/shop/[chain]/[payee]` (share it and print it as a counter QR) and a POS page `/shop/.../pos`.
- **POS page (PWA, works offline after load):**
  1. A keypad or price-list tap → shows the **price QR** (§6.8).
  2. A camera scans the customer's **sealed-note QR** → local verification (§6.5/§6.8) → one of:
     - **GUARANTEED:** big seal animation + "Accepted 3.50 · Customer remaining 16.50".
     - **UNVERIFIED · merchant risk:** amber, "First-time customer offline: your risk up to 5.00".
     - **REJECTED**, with the reason.

     Re-scanning the same QR shows the same outcome (idempotent by order id).
  3. The day's ledger: accepted notes per certificate, the unredeemed total, and **Collect** (one `redeemMany` tx when online; the auto-redeemer is optional).
  4. Settings: first-visit limit (default 5 USDC), per-device offline float, a "primary device" flag.
- Labels always use the honest sequence: *Accepted by you* → *Collected on-chain*.

**Customer (spender) wallet `/wallet`:**
- A PWA that **generates certificate spender keys in the browser** and stores them in IndexedDB, encrypted with a PIN (scrypt-derived AES-GCM key). **Key policy (MUST):**
  - Spender keys hold **no funds and need no gas.** They only sign notes.
  - Key granularity follows §3.9. People default to a fresh key per certificate (privacy), so the worst case from a leaked key is that certificate's remaining value, at one place.
  - **A lost key never loses money.** The funder reclaims the remainder after expiry, so default customer certificates to short expiries (7–30 days).
  - Storage can be wiped. iOS Safari may clear site storage for sites that aren't installed after about 7 days of no use. So prompt "Add to Home Screen", and offer **Export backup** (an encrypted file or QR). Label balances as "on this device".
  - Keys never leave the device except through the explicit export, gift-link or hand-over flows.
  - Passkey (P-256) signing is **research, not v1.** ERC-1271 spenders were removed because contract signatures are revocable and can't be checked offline. A future irrevocable passkey scheme would need its own design.
- **Adding a certificate:**
  - Created by the customer (they fund it in the Counting House, and the spender key is generated straight into the wallet).
  - Received via a **gift link** (key in the URL fragment).
  - Scanned from an issuer's "hand-over QR" (parent → child, employer → employee).
- **Paying:** scan the price QR → select the matching certificate → review screen → approve (PIN/passkey) → full-screen sealed-note QR with brightness boosted. NFC share on Android if available.
- Balance shown: face value − own signed cumulative (local) and − redeemed (on-chain, when online), labelled plainly.

**Funder flows in the Counting House:** "Give a certificate to someone": pick the shop, amount and expiry → produces a **hand-over QR/link** containing the spender key (shown once). Use it for allowances, employee spend and gifts.

### 12.6 Contacts: People & agents, Places, control pages

**Storage.** Contacts are **local to the funder's device** (IndexedDB), with an optional encrypted export and import. Names never go on-chain or to any server (§3.9).

**People & agents** (`/app/people`):
- Add: name, type (person / child / employee / agent), avatar or emoji, and key policy.
- For agents, paste an address (from `keygen`). For people, keys are created at hand-over time.
- **Holder control page** (`/app/people/[id]`), for example:
  ```
  Mia (child)                                   [Give certificate]
  School Canteen      32.50 / 50.00   expires 30 Oct   [Top up] [Extend] [Renew]
  National Bookstore   8.00 / 20.00   expires 15 Oct   [Top up] [Extend]
  Left in total: 41.50 · Collected this week: 17.50 · Pending (from receipts): 3.50
  ```
- **Renew** issues a fresh certificate with the same place, amount and duration, and a new key when the policy is per-certificate. It produces a new hand-over link or QR, or a silent hand-over if the holder's wallet is paired (see receipts below).
- Reminders (local notifications): "Mia's canteen certificate expires in 2 days. Renew?"

**Places** (`/app/places`):

| Verification | How it's added | Badge |
|---|---|---|
| **Verified in person** | Scan the shop's counter QR (from its POS or shop page) | ✓ Scanned |
| **Verified by domain** | Enter a domain; the app reads `https://domain/.well-known/flying-money.json` and shows the domain | ✓ domain.com |
| Unverified | Paste an address | ⚠ Unverified (confirm twice before issuing) |

**Optional receipts to the funder** (a pairing, opt-in by the holder's app):
- When a holder's wallet or agent signs a note, it MAY post a signed receipt to the funder's inbox: amount, place, time and memo. This uses an end-to-end encrypted relay, or local-only for the demo.
- It powers "Pending (from receipts)" and live notifications ("Mia spent 3.50 at School Canteen · 12:41").
- Without pairing, the funder only sees on-chain collections.
- For the hackathon, implement it **for agents first** (the client SDK `onPayment` hook → funder dashboard over SSE). The people-wallet pairing is a stretch goal.

---

## 13. Live demo system

### 13.1 Demo seller: "Silk Road Oracle" (apps/oracle, Hono)

**Multi-chain seller.** One Oracle instance accepts notes on **every registered testnet** at once: its 402 offer lists all of them in `accepts[]`, it uses one payee address, and it runs one redeemer loop per chain. A second, *mainnet* instance accepts Arc, Arbitrum, Monad and Base mainnets with tiny prices, for the mainnet proofs and the Arc grant.

**Paid endpoints** (priced in USDC; price returned in 402 offers):

| Endpoint | Returns | Price |
|---|---|---|
| `GET /v1/tea-price?city=` | Fictional, clearly labelled "game data" tea price for historical cities (Chang'an, Luoyang, Yangzhou, Dunhuang…) | 0.01 |
| `GET /v1/route?from=&to=` | A fictional caravan route + distance (historically plausible city pairs; label "illustrative") | 0.02 |
| `GET /v1/weather?lat=&lon=` | Real current weather via Open-Meteo (non-commercial demo, attributed) | 0.01 |
| `GET /v1/proverb` | A random public-domain proverb (source-listed) | 0.005 |

**Free endpoints:**
- `GET /fm/prices`.
- `GET /fm/redeemable/:certificateId` (the highest note with `cumulative ≤ consumed`, plus the `accepted/consumed/reserved/credit` state, for the Counting House payee view).
- `GET /fm/stream` (an SSE stream of accepted notes and redemptions, for the demo UI).
- `GET /health`.

**Configuration:** the payee is the Oracle's address. The redeemer policy for the demo is `minAmount = 0.10 USDC` or 60 s age, so redemptions happen visibly during the demo.

**Honesty:** the tea and route data are fictional game data and are labelled as such in responses (`"illustrative": true`). Weather is real and attributed.

### 13.2 Demo buyer: "The Merchant" agent (apps/agent)

- **Mode A: scripted (default, deterministic for judging).** A merchant planning a trip: it asks for tea prices in 5 cities, weather at 2 locations, and 3 routes, then summarises the "best trade". About 20 paid calls.
- **Mode B: LLM (optional, if an `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is present).** The model gets one tool, `paid_fetch(url)`, from `paidFetchTool`, and the goal "Plan the most profitable tea trade route under a 0.50 budget". The budget is enforced by the certificate, not by the prompt.
- Streams events (request, 402, note sealed, response, receipt) to the web demo over SSE or WebSocket through a small runner service.
- **Chain flag:** `--chain arc-testnet` (or any registry key). The runner holds one demo certificate per chain.

### 13.3 `/demo` page layout

```
┌──────────────── Controls ────────────────┐
│ Chain [Arbitrum|Monad|Arc|Base] Budget [0.50] Speed [▶ ▮▮] │
│ [Cut the network] [Steal the agent key] [Redeem now] [Reset] │
└──────────────────────────────────────────┘
┌── Merchant (agent) ──┐  ┌──── The Road ────┐  ┌── Oracle (seller) ──┐
│ terminal-style log   │  │ notes fly as      │  │ ledger: latest note │
│ "asked tea @Luoyang" │  │ sealed chips from │  │ accepted 0.23       │
│ 402 → sealed 0.23    │→ │ left to right     │→ │ redeemed on-chain   │
│ answer …             │  │                   │  │ 0.10 (tx ↗)         │
└──────────────────────┘  └───────────────────┘  └─────────────────────┘
Certificate strip: [██████░░░░] 0.23 / 0.50 · expires in 6d · view on explorer ↗
```

**Scenario buttons (each maps to a real behaviour):**
- **Cut the network.** Simulates the *seller's chain RPC* going down. Notes keep being verified and accepted (certificate cached, signatures checked locally), and redemption queues up. On restore, one transaction redeems everything. *(Label precisely: "The seller's blockchain connection is cut; payments keep flowing.")*
- **Steal the agent key.** A second "thief" process uses the same key to request more than the remaining budget. It hits the cap and is refused. Also show that the thief **cannot pay anyone else**: an attempt to use the note at a different seller is rejected (wrong payee).
- **Redeem now.** Triggers the redeemer. Shows the tx link and the tally-halves animation.
- **Reset.** Issues a fresh demo certificate (runner-funded) so every judge sees a clean run.

**Implementation notes:**
- The demo runner holds a *demo funder key* and a *demo agent key* on the server (testnet keys funded with Circle testnet USDC plus each chain's gas token. The mainnet runner uses a separate key holding ≤5 USDC in total).
- Rate-limit Reset: 1 per IP per 2 minutes.
- If the chain is unavailable, show "Demo paused: <chain> unreachable" (and offer to switch chains). **Never fake transactions.** A local replay mode MAY exist, but MUST be labelled "Recorded run" with the original tx links.

**Cross-chain moment (optional, strong for judges):** run the agent with certificates on two chains at once. The same Oracle accepts both, the ledger shows two strips, and each chain redeems separately. It's the same code, with no bridge involved ("we don't move money between chains; we accept it on each").

### 13.4 Demo video (2 minutes)

Record the `/demo` page following the script in §15.3. Upload it unlisted and embed it on `/pitch`.

### 13.5 Shop demo: "The Lantern Café" (two screens, 45 seconds)

- **Left (laptop):** the POS for "Lantern Café" on the event's chain.
- **Right (phone, or a second browser window):** the customer's wallet holding a 20 USDC certificate for the café.

The script:
1. The barista taps "Tea 3.50", and the price QR appears.
2. The customer scans, approves, and shows the sealed-note QR. The POS scans it: seal animation, "Accepted".
3. **Turn off the café's Wi-Fi.** Serve two more customers with certificates the POS has seen before: GUARANTEED, because the certificates are cached. Then show a brand-new customer: the POS says **Unverified · merchant risk**. That's the honest boundary, and judges will respect it.
4. Wi-Fi back on → **Collect** → one transaction, three payments. Show the explorer link.
5. Bonus: open a gift link on a fresh phone → pay once → show "Only valid at Lantern Café".

Use this demo as the **lead** for payments-oriented tracks (Arc, Arbitrum "novel financial products", Monad Track 2). Use the agent demo as the lead for AI and infrastructure tracks.

---

## 14. Story

### 14.1 The narrative arc (use it everywhere: README, pitch, site)

1. **Hook (history).** In 804, Chinese merchants invented flying money: deposit once, carry a certificate, redeem elsewhere.
2. **Problem (now).** AI agents are becoming buyers. Handing them wallets is reckless, and paying on-chain per request doesn't scale.
3. **Insight.** The same three properties that made feiqian work: **prefunded, scoped, verifiable**.
4. **Solution.** Sealed certificates: a budget for one seller, one agent key, cumulative signed notes, one redemption.
5. **Proof.** The same source live on Arbitrum, Monad, Arc and Base (testnets plus capped mainnets). Invariant-tested. The demo shows an overspend refused, the network cut, and 20 requests redeemed in one transaction.
6. **Integrity.** We removed offline cash because we couldn't guarantee it. We only ship what the math guarantees.
7. **Future.** A tab scheme any agent framework or paid API can plug in, on any EVM chain; maybe a scheme under emerging agent-payment standards.

### 14.2 Taglines (pick one per surface)

- "Give your agent a certificate, not your wallet."
- "Money that flies. Since 804."
- "Sealed notes for machine commerce."

### 14.3 README.md structure

```
# 飛錢 Flying Money
Sealed spending certificates for AI agents. Money that flies, since 804 CE.
[Live demo] [Docs] [Deployments on every chain → /chains] [2-min video]

## The idea in 30 seconds      (4-step list)
## Try it                      (pnpm i; pnpm dev; links)
## For agents (buyers)         (client snippet)
## For APIs (sellers)          (server snippet)
## Guarantees                  (table from §3.4 + link)
## How it's built              (diagram §5.1, packages)
## The story                   (3 paragraphs + link /story)
## Why no offline cash         (short, honest)
## Status                      (testnet, unaudited, invariant-tested)
## License                     MIT
```

---

## 15. Pitch materials

### 15.1 Slide deck outline (10 slides)

1. **Title.** 飛錢 Flying Money: "Give your AI agent a certificate, not your wallet."
2. **804 CE.** Merchants, copper shortage, certificates of matching halves.
3. **2026.** Agents are the new merchants: the three bad options (card / per-request on-chain / promises).
4. **The certificate.** Prefunded · scoped to one seller · one agent key · expires.
5. **Sealed notes.** Cumulative signatures, verified locally, redeemed once (diagram).
6. **Guarantees.** Our three claims: reserved for the payee, capped for the spender, delivered only to the payee. Plus what we don't claim.
7. **Demo** (video or live).
8. **Built.** Contract + invariants, SDK (client/server), Counting House, Oracle. Numbers: gas per redeem, requests per redemption.
9. **What we cut, and why.** Offline cash, shared pools, endorsement chains. "We only ship what the math guarantees."
10. **Next.** An x402-style scheme, more chains, pilot sellers, irrevocable passkey spenders (research). Ask: feedback / partners / grants.

### 15.2 Three-minute talk track

> *(0:00)* In 804, Chinese tea merchants had a problem: not enough coin, and dangerous roads. So they invented *flying money*. They deposited coin at an official office and carried a certificate made of matching halves, redeemed in another city. The value flew. The coins stayed put.
>
> *(0:25)* Today, the merchants are AI agents. They buy API calls, data and compute, thousands of times a day, for fractions of a cent. We can give them our wallet and hope. Or we can pay on-chain for every request, which is too slow and costly. Or the agent promises to pay later, and no seller should trust that.
>
> *(0:50)* Flying Money brings back the certificate. You lock five dollars for **one** seller, usable by **one** agent key, until a date. Every request carries a sealed note, a signature over the running total. The seller checks it locally in milliseconds. When it's convenient, the seller redeems the latest note in **one** transaction.
>
> *(1:15)* Let me show you. *(demo, see §15.3)*
>
> *(2:15)* What's guaranteed: the agent can't authorize beyond the certificate even with a stolen key; every note it signs is backed by money reserved for that seller until expiry; and money can only go to the named seller. What's not: we don't promise the seller delivers, and it's testnet and unaudited, but it is invariant-tested.
>
> *(2:35)* One more thing. We started out building offline cash for people. Our own review proved software can't stop double-spending between offline strangers, so we cut it. Flying Money only ships what the math guarantees.
>
> *(2:50)* Flying money worked for merchants twelve centuries ago. We think it's how machines will pay. Thank you.

### 15.3 Demo script (60 seconds inside the talk)

1. Show a certificate on the event's chain: 0.50 USDC for the Silk Road Oracle, agent key, 7 days. Click the explorer link (5 s).
2. Press ▶. The merchant agent asks for tea prices and routes. Notes fly with seals, and the seller's ledger climbs to 0.23 (15 s).
3. **Cut the network.** Calls continue, notes are still accepted, and the redemption queue grows (10 s).
4. **Restore → Redeem now.** One transaction. Show "23 requests, 1 redemption", the tx link, and the tally halves joining (10 s).
5. **Steal the agent key.** The thief tries to spend 1.00: refused at the cap. It tries another seller: refused (wrong payee) (15 s).
6. Close on the certificate page: redeemed 0.23 / 0.50; "the remainder returns to the funder after expiry" (5 s).

### 15.4 FAQ for judges (also on `/docs/faq`)

- **Is this x402?** It uses HTTP 402, but it's a *prefunded tab*: one settlement for many requests. It could become a scheme alongside x402. We don't claim compatibility yet.
- **Why not payment channels?** It is a one-way channel in spirit. The differences are that anyone can redeem, the agent key is separate from the funder, there is no close negotiation, and it's packaged as an HTTP-native SDK for agents.
- **Which chain?** All of them. The same source and protocol are deployed on Arbitrum, Monad, Arc and Base, each with that chain's USDC and caps. Arc lets sellers operate with USDC only (it is also the gas token). Monad and Arc give near-instant redemption. Arbitrum and Base put it next to existing agent and DeFi ecosystems. Adding a chain is one registry entry.
- **Why not bridge between chains?** Certificates never move. A seller simply accepts notes on several chains, and each chain settles independently. No bridge risk.
- **Where's the token?** There isn't one, by design.
- **Can a parent freeze a certificate?** No, and that's deliberate. The shop's instant, offline guarantee depends on it. Control happens through where, how much and how long, and by not renewing (§3.8).
- **Does the kid need a wallet?** No. A link or QR plus a PIN. The money goes from the parent to escrow to the shop and never touches the kid (§3.9, §3.10).
- **Is it private?** Names never go on-chain, and people get fresh random spending addresses. But flows between addresses are public. We don't claim anonymity.
- **Offline?** Notes can be signed and verified without connectivity, but we don't market offline payments between strangers, because it can't be guaranteed without an online authority, trusted hardware or an identity system.

---

## 16. Hackathon kit

### 16.1 Submission checklist

- [ ] Public GitHub repository with a clean history (the rebuild), MIT licence, and a README per §14.3.
- [ ] Contract verified on the event's chain explorer(s). Addresses in the README, `/chains` and `/docs/contract`.
- [ ] Live site with the working `/demo` and `/app`.
- [ ] 2-minute demo video (unlisted link).
- [ ] Pitch deck PDF (10 slides).
- [ ] `docs/SECURITY.md` with invariants, gas numbers, and the not-audited notice.
- [ ] Team/contact information on `/pitch`.
- [ ] A clear statement of "what was built during the hackathon" if the rules require it. The rebuild is new code; the old repo is archived.

### 16.2 The four submissions (one codebase, four framings)

| | **Arbitrum Open House Singapore** (online buildathon) | **Colosseum Crypto World's Fair** | **Monad Metropolis** | **Arc Microgrants** (Circle, DoraHacks) |
|---|---|---|---|---|
| **Deadline** | **4 Oct 2026** | 12 Oct 2026 | 13 Oct 2026 | Applications close **14 Oct 2026** (results by 21 Oct) |
| **Chain(s) to show** | Arbitrum Sepolia + Arbitrum One (capped) | EVM track: **Base** (primary) or Arbitrum. All submissions also compete in the general pool | Monad (chain 143) + Monad Testnet | **Arc mainnet (5042), required**, + Arc Testnet |
| **Track / framing** | "Novel financial products": one primitive, two doors. Lead with **Shop mode** (tabs, allowances, gift certificates), and show agents as the second door. Emphasise the founder story and the path to Founder House (Nov) | General pool: product quality. Base: the agent-payments ecosystem. Lead with **agents** (MCP + Claude/Hermes paying live), then 20 s of Shop mode to show breadth | Track 4 "Trust, Identity & AI Infrastructure" → lead with **agents + MCP**. Or Track 2 "Consumer Products & Payments" → lead with **Shop mode**. Pick one track and one lead | "USDC-native payments for shops and agents": shops and sellers need only USDC, even for gas; sub-second finality. Lead with **the Lantern Café on Arc mainnet** |
| **Prize context** | $70K open category + $15K promising products + grants; Founder House Singapore with up to $300K (USDG) | Global top 20 + track prizes; accelerator ($250K pre-seed per accepted team) | $30K per track (3 winners) + $25K grand champion | 20 × 500 USDC |
| **Must-have artifact** | Working demo + repo + short pitch | Product-quality demo + video + pitch; the strongest polish goes here | Demo + short write-up + code link (their stated requirement) | **Deployable link + public repo + running on Arc mainnet** |
| **Public page (v1.5)** | `/chains/arbitrum-sepolia`, `/chains/arbitrum` | `/chains/base` (or arbitrum) | `/chains/monad` | `/chains/arc` |

**Rules across submissions:**
- **One repo, one product.** Each event page and video intro changes only the default chain and the framing sentence.
- **Say that it's multi-chain everywhere.** Judges respect honesty: "Flying Money is chain-agnostic; this submission is deployed and demoed on X."
- **Check each event's originality and "built during the event" rules**, and follow the strictest one. The rebuild starts 23 Sep 2026, after all four events opened, which helps. Keep commit history clean and dated.
- **Solana:** not required for Colosseum, which has EVM tracks. Do not claim Solana support. A Solana port is post-hackathon work.

### 16.3 Judging criteria mapping

- **Technical depth:** on-chain invariants, off-chain protocol property tests (no obligation growth on failure, replay safety), idempotent redeemer, EIP-712 parity, and a deliberate ECDSA-only design (with the reason).
- **Originality:** the heritage framing plus payee-scoped cumulative certificates for agents.
- **Usefulness:** real sellers can adopt it in minutes with the server middleware.
- **Completeness:** site, docs, app, demo, video, deck.
- **Honesty and security:** the Guarantees page and "what we removed".

---

## 17. Build plan: deadline-driven schedule

Today is **23 Sep 2026**. The first deadline is **4 Oct** (Arbitrum), so the plan front-loads a *complete but minimal* product. Later deadlines get polish, more chains and mainnets. Dates assume one focused builder or agent. Each block has acceptance criteria (✅) that MUST pass before moving on.

### Sprint A: Minimal complete product on Arbitrum (23 Sep → 3 Oct)

| Days | Work | ✅ Acceptance |
|---|---|---|
| 23–25 Sep | **Reset** (§4) + skeleton + CI + `@flying-money/chains` with all registry entries | Clean repo; legacy archive exists; CI green |
| 25–27 Sep | **Contract** + unit tests + invariants + Deploy script (§7) | `forge test` passes (invariants ≥256 runs × depth 50); deployed and verified on **Arbitrum Sepolia** |
| 27–28 Sep | **core + client + server SDK** (§6, §8), multi-chain `accepts[]`, **durable client outbox (§6.6), requestId idempotency + credit (§6.5)** | Anvil integration: 50 requests → ≤3 redeems → payee balance = Σ prices served; **property tests C1, S1, S3, store-loss pass**; concurrency, overspend, wrong payee and replay tests pass |
| 29 Sep | **Oracle + Merchant agent** (§13.1–13.2) | Scripted run on Arbitrum Sepolia: ~20 paid calls, ≥1 on-chain redemption |
| 30 Sep–1 Oct | **Web minimum:** design tokens, landing, `/demo` (live), `/c/[chain]/[id]`, `/chains`, `/hackathons/arbitrum`, Guarantees | Live site on Vercel; demo works end to end on Arbitrum Sepolia |
| 2 Oct | **Counting House minimum:** connect, issue (with agent-key download), list, redeem as payee. **Minimum agent docs:** `/llms.txt`, `/.well-known/flying-money.json`, `AGENTS.md` | A fresh wallet can issue and redeem on Arbitrum Sepolia; llms.txt resolves |
| 3 Oct | **Shop mode minimum** (POS price QR → wallet sealed-note QR → Accept → Collect); deploy **Arbitrum One (capped)** + 1 mainnet proof tx; README; 2-min video (shop lead + agent second); pitch | The café flow works on Arbitrum Sepolia, including offline accept; §16.1 checklist complete |
| **4 Oct** | **Submit to Arbitrum Open House** | Submitted |

### Sprint B: Polish + Base + Colosseum (5 → 11 Oct)

| Days | Work | ✅ Acceptance |
|---|---|---|
| 5–6 Oct | Deploy Base Sepolia + Base (capped); per-chain smoke tests; multi-chain Oracle (`accepts[]` across all testnets) | Smoke test passes on Arbitrum Sepolia and Base Sepolia |
| 6–8 Oct | Full site: `/story`, `/how-it-works`, full docs (MDX), FAQ; Counting House topUp, extend and reclaim; payee view with the note feed | Lighthouse ≥90; Playwright issue→redeem on anvil |
| 8–9 Oct | Demo scenario buttons (cut network, steal key, redeem now, reset); the cross-chain moment | Each button works live on testnet |
| 9–10 Oct | **`@flying-money/mcp`** (fm_status, fm_quote, fm_paid_fetch, fm_explain) + `/docs/mcp`; Claude Desktop/Code paying the Oracle live; `/llms-full.txt` + `.md` twins; optional LLM mode for the agent | A Claude session pays via MCP and stays within the certificate budget; llms-full.txt builds in CI |
| 11 Oct | Colosseum video (product-grade) + deck + `/hackathons/colosseum` | Checklist complete |
| **12 Oct** | **Submit to Colosseum World's Fair** (Base or Arbitrum track + general pool) | Submitted |

### Sprint C: Monad + Arc mainnet (8 → 14 Oct, overlaps B)

| Days | Work | ✅ Acceptance |
|---|---|---|
| 8 Oct | Deploy Monad Testnet + Monad (143, capped); smoke test | Verified on the Monad explorer |
| 9 Oct | Deploy **Arc Testnet**, then run the smoke test *on Arc Testnet* (anvil can't emulate Arc USDC) | Passes; UI shows a single USDC balance on Arc |
| 10 Oct | Deploy **Arc mainnet (5042, capped)**; mainnet Oracle instance; one real agent session (≤5 USDC) with a redemption tx | A mainnet tx link exists for issue, redeem and (a short certificate) reclaim |
| 11–12 Oct | Gift links + hand-over QR (allowances/employees); **Contacts** (People & agents, Places with scan/domain verification, holder control pages, Renew); `/shops` page; the Lantern Café demo on **Arc mainnet** (tiny amounts) | A gift link redeems at the café on Arc mainnet; issuing "Give Mia 10 at Lantern Café for 7 days" works from Contacts |
| 12–13 Oct | `/hackathons/monad` + write-up; video intro variant | — |
| **13 Oct** | **Submit to Monad Metropolis** | Submitted |
| **14 Oct** | **Submit to Arc Microgrants** (deployable link + repo + Arc mainnet addresses) | Submitted |

**Cut-lines if behind schedule (in this order):** the LLM mode → the cross-chain moment → NFC → receipts to funder → domain-verified places → gift links → Base mainnet → the `/story` animations → reclaim UI (keep the contract function). **Never cut** either front door's minimum: the agent 402 flow and the café QR flow. **Never cut:** invariant tests, the Guarantees page, honest labels, or the Arc mainnet deployment (required for the grant).

## 18. Configuration and deployment

`.env.example`:
```
# Chains: all addresses, chain IDs and RPC defaults come from @flying-money/chains.
# Override RPCs only if needed:
RPC_ARBITRUM_SEPOLIA=
RPC_ARBITRUM=
RPC_BASE_SEPOLIA=
RPC_BASE=
RPC_MONAD_TESTNET=https://testnet-rpc.monad.xyz
RPC_MONAD=
RPC_ARC_TESTNET=https://rpc.testnet.arc.io
RPC_ARC=https://rpc.mainnet.arc.io

DEPLOYER_KEY=                 # forge scripts only; never committed; separate key per network class (testnet/mainnet)
EXPLORER_API_KEYS=            # for forge verify (Arbiscan/Basescan/…); per explorer docs

# Oracle (seller), one payee address for all EVM chains
PAYEE_ADDRESS=
REDEEMER_KEY=                 # needs gas on each chain: ETH (Arbitrum/Base), MON (Monad), USDC (Arc)
ORACLE_ACCEPTS=arbitrum-sepolia,base-sepolia,monad-testnet,arc-testnet
ORACLE_MAINNET_ACCEPTS=arbitrum,base,monad,arc
REDIS_URL=                    # optional; memory store if empty

# Demo runner
DEMO_FUNDER_KEY=              # holds testnet USDC per chain; mainnet use ≤ 5 USDC total
DEMO_AGENT_KEY=
ORACLE_URL=https://oracle.flyingmoney.xyz
NEXT_PUBLIC_DEFAULT_CHAIN=arbitrum-sepolia   # fallback; ?chain=<key> preselects (§21.2)

# Database (§21.5): injected by the Vercel Marketplace Upstash integration
KV_REST_API_URL=
KV_REST_API_TOKEN=
# fallback for local use (Upstash console)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
FM_ENV=testnet                # testnet | mainnet
FM_REDIS_PREFIX=fm:v1:testnet:
CRON_SECRET=                  # authorises /api/cron/* (§21.6)

# Agent spending requests (§21.4)
FM_OWNER=
FM_OWNER_GRANT=
FM_RELAY_URL=https://flyingmoney.xyz/api/requests

# Optional LLM mode
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

- **Secrets never enter the repo.** CI fails if a 64-hex private key pattern is found (a gitleaks action).
- Web → Vercel. Oracle and runner → Fly.io/Railway (one small instance each). Redis → Upstash (optional).
- Domain: pick an available domain. **Check availability and trademarks before printing it anywhere.** Placeholders here use `flyingmoney.xyz`.

---

## 19. After the hackathon (roadmap, not in scope now)

1. **Pilot sellers:** 3 real paid APIs adopt the server middleware.
2. **An x402-style scheme proposal** for prefunded tabs, if the community wants one.
3. **Irrevocable passkey spenders** (research): design a scheme whose validity can't change after signing. ERC-1271 does not qualify.
4. A hosted redeemer service, and a certificates index/API (possible revenue, no token).
5. **Optional signed receipts** from payees (audit trails for agent spending).
6. A professional audit before removing launch caps, production use, or accepting meaningful mainnet TVL. (Hackathon mainnet deployments run under the immutable caps in §7.1 #9.)
6b. Signed receipts and event-based recovery, so a seller's served history can be reconstructed after a store loss (§6.5 Recovery).
7. Research notes (not product): an "open" unscoped mode with a bond, and transport-carried backing proofs, kept only as documented research (see the discovery report).

---

## 20. Final acceptance checklist (definition of done)

- [ ] Old code archived outside the repo. The new repo contains only the §5.2 structure.
- [ ] Contract implements §7 exactly (including the immutable `maxFaceValue`). All unit and invariant tests pass.
- [ ] Deployed and verified on: Arbitrum Sepolia, Arbitrum One (capped), Base Sepolia, Base (capped), Monad Testnet, Monad 143 (capped), Arc Testnet, **Arc mainnet 5042 (capped)**. The `/chains` page lists them all.
- [ ] Per-chain smoke test passes on every testnet (Arc tested on Arc Testnet, not anvil).
- [ ] Four submissions made before 4, 12, 13 and 14 Oct respectively, with materials in `docs/submissions/` (not public). The public site uses `/chains/[chain]` pages only (§21.2).
- [ ] Core/client/server SDKs implement §6 and §8. The integration tests from Phase 3 pass.
- [ ] Oracle and Merchant agent run end-to-end on every registered testnet, and on Arc mainnet with a small amount.
- [ ] Website: all §10.1 routes exist. Landing copy per §10.2. Story sources linked. Guarantees page accurate.
- [ ] Counting House: faucet, issue (with agent-key download), list, top up, extend, reclaim; payee redeem.
- [ ] `/demo`: the four scenarios work live. No fake transactions anywhere.
- [ ] Design: the Paper-Ink-Seal tokens, light and dark themes, reduced motion, and Chinese text reviewed.
- [ ] README, SECURITY, STORY, PITCH, DECISIONS docs are present. Deck and video are done.
- [ ] Both front doors work: an agent pays via the SDK and via MCP (Claude/Hermes-compatible), and a customer pays a shop via QR, including offline accept and Collect.
- [ ] v1.4.1 invariants hold in tests:
  - ECDSA-only spenders (`vm.etch` test) and key isolation (`spender ≠ funder/payee`).
  - C1 (no obligation growth on failure), S1 (replay safety), S3 (failure becomes credit), **S4 (concurrent reservations, memory store + Redis)**.
  - The sweeper, redeem-only-served, and store-loss `RECOVERED` semantics.
  - GUARANTEED vs UNVERIFIED POS statuses.
  - The deployment-wide cap.
- [ ] No absolute claims anywhere ("non-payment impossible", "fully safe", "identical bytecode"). Copy uses the three claims in §3.5.
- [ ] Contacts: People & agents and Places (scan-verified at minimum), holder control pages, Renew; the key policy from §3.9 is applied; no names leave the device.
- [ ] UI states the control model (no freeze), the privacy statement, and the leftover rule on gift and allowance pages.
- [ ] Agent docs kit is live: `/llms.txt`, `/llms-full.txt`, `.md` twins, `/.well-known/flying-money.json` (site + Oracle), `AGENTS.md`, `/docs/mcp`.
- [ ] Every page that handles funds states its mode: "Testnet · test money · unaudited" or "Mainnet · real USDC · unaudited · capped at 100 USDC".
- [ ] Nothing from §4.2 has been reintroduced.

---

### Sources for historical and competitive claims

- [Wikipedia: Flying cash](https://en.wikipedia.org/wiki/Flying_cash)
- [Britannica: Feiqian](https://www.britannica.com/topic/feiqian)
- [x402 FAQ](https://docs.x402.org/faq)
- [Allowance (YC): spend control for AI agents](https://www.ycombinator.com/companies/allowance) (a competitor to acknowledge in the FAQ if asked)
- [Colosseum Crypto World's Fair](https://colosseum.com/worldsfair) · [Crypto Briefing coverage](https://cryptobriefing.com/colosseum-crypto-worlds-fair-hackathon/)
- [Arbitrum Open House Singapore: applications](https://blog.arbitrum.foundation/open-house-singapore-applications-are-now-open/) · [Builder's Block #025](https://blog.arbitrum.foundation/builders-block-025-arbitrums-buildathon-starts-next-week-heres-how-to-stand-out-in-open-house/)
- [Monad Metropolis](https://hackathon.monad.xyz/) · [Monad network info](https://docs.monad.xyz/developer-essentials/network-information)
- [Arc Microgrants (DoraHacks)](https://dorahacks.io/hackathon/arc-microgrants) · [PANews: Arc microgrants](https://panews.io/articles/01a0affb-c2f8-719d-9661-cef1573d6abb) · [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc) · [USDC on Arc: two interfaces](https://www.arc.io/blog/building-with-usdc-on-arc-one-token-two-interfaces) · [Arc EVM compatibility guide](https://www.arc.io/blog/arc-compatibility-guide-for-existing-evm-apps)
- [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- Rediscovery report: `claude/flying-money-discovery-report.md` (project)

---

## 21. v1.5 change set (founder directives, 24 Sep 2026): NORMATIVE

> **For the implementing agent:** this section amends v1.4.1. It was written *after* Phase 13 and is aligned with the existing implementation decisions (D1–D22, especially D11 Upstash and D17 the in-route demo Oracle). Where §21 conflicts with an earlier section, **§21 wins**. The protocol (§6), the contract (§7) and all invariants (I1–I7, C1, S1–S4) are **unchanged**. Everything here is UX, SDK, infrastructure and the site. Record your implementation choices as new D-numbers in `docs/DECISIONS.md`.

| # | Change | Where it lands |
|---|---|---|
| V1 | Remove GitHub Actions; use a local `pnpm verify` gate | §21.1 |
| V2 | No hackathon or event names on any public surface; pages keyed by **chain** | §21.2 |
| V3 | Unified taxonomy and UX for people, shops and agents | §21.3 |
| V4 | **Spending requests**: agent → owner, holder → giver, shop → giver (tab offers) | §21.4 |
| V5 | Database: **Upstash Redis via the Vercel Marketplace** (finalised); env vars and key schema | §21.5 |
| V6 | A **hosted, durable 402 seller** on Vercel, with a redeemer that works within Vercel cron limits | §21.6 |

### 21.1 V1: No GitHub Actions

- Delete `.github/workflows/` entirely. There are no hosted CI runners.
- Add a root script **`pnpm verify`**. It is the single gate, run locally before every deploy and before every submission:
  1. Lint and format check (biome).
  2. Typecheck (including `tools/doc-samples`).
  3. Unit, property and store tests: C1, S1–S4, the sweeper, redemption policy and recovery. S4 runs against the memory store **and** against Upstash when `KV_REST_API_URL` or `UPSTASH_REDIS_REST_URL` is set, with a dedicated test prefix that is deleted afterwards.
  4. `forge test`, with invariants at ≥256 runs × depth 50.
  5. **Secret scan**: gitleaks CLI if installed, otherwise a bundled regex scanner for 64-hex private keys and API-token patterns across tracked and untracked, non-ignored files.
  6. The public-surface check from §21.2.
  7. Optional: `pnpm verify --e2e` for the Playwright suite.
- Vercel's own build runs typecheck and build as usual. **That is not a substitute for `pnpm verify`.**
- Every place in the spec that says "in CI" now means **"in `pnpm verify`"**.
- **Git:** local commits per phase continue as before. **Never push, and never create remotes, tags or GitHub releases**, unless the founder asks. *(If the founder's "no git actions" meant "no git commits at all", they will say so; then stop committing and only write `docs/STATUS.md`.)*

### 21.2 V2: Chain pages instead of event pages

- **Remove** `/hackathons/[event]`, `lib/hackathons.ts`, and every public mention of event names. That covers the footer, `/pitch`, docs, `/llms.txt`, `/llms-full.txt`, OG images, the manifest and page metadata.
- **Add `/chains/[chain]`** (registry key, e.g. `/chains/arc`, `/chains/arbitrum-sepolia`). Each page shows:
  - the chain's name, testnet/mainnet status, contract address (explorer + Sourcify links), USDC address, gas token and caps;
  - chain-specific notes from the registry (e.g. Arc: "gas is paid in USDC, so shops and sellers only ever need USDC"; sub-second finality);
  - **"Try it on <chain>" buttons**: `/demo?chain=…`, `/app?chain=…`, `/shops?chain=…`;
  - honest state: "deployed" or "not yet deployed".

  `/chains` remains the index.
- **Chain preselection** is always the `?chain=<key>` query parameter (remembered in localStorage). It is **never** an event route. `NEXT_PUBLIC_DEFAULT_CHAIN` stays the fallback.
- `/pitch` stays, but is event-neutral: problem, solution, demo video, links.
- **Submission materials** (per-event framing, track choice and checklists from §16) move to `docs/submissions/<event>.md`. They are **not deployed, not linked and not included in llms files**.
- **Public-surface check (in `pnpm verify`):** build the site and fail if any served HTML, markdown, llms file, OG metadata or manifest contains a denylisted event term. Store the list in `tools/public-surface/denylist.txt` (e.g. "Colosseum", "World's Fair", "Metropolis", "Open House", "Microgrant", "DoraHacks", "hackathon").

### 21.3 V3: Taxonomy and UX for people, shops and agents

**One concept, one word per door.** Never mix the two columns on one screen. The code names stay as they are.

| Concept | People & shops | Agents | Code |
|---|---|---|---|
| Who pays in | **Giver** | **Owner** | `funder` |
| Who spends | **Holder** | **Agent** | `spender` |
| Where it's spent | **Place** | **Service** | `payee` |
| The locked budget | **Certificate** | **Budget** (certificate) | `Certificate` |
| One payment | **Sealed note** | **Sealed note** | `Note` |
| Create | **Give** | **Fund** | `issue` |
| Add more | **Top up** | **Top up** | `topUp` |
| Make longer | **Extend** | **Extend** | `extend` |
| Seller takes payment on-chain | **Collect** | **Collect** | `redeem` |
| Giver takes back leftovers after expiry | **Take back leftovers** | **Take back leftovers** | `reclaim` |
| Ask for money | **Ask** | **Budget request** | `SpendRequest` (§21.4) |
| Shop invites funding | **Open a tab here** | — | `TabOffer` (§21.4) |

**Counting House navigation** (it replaces loose links): **Give · Holders · Places · Requests (badge count) · Collect.**
- *Holders* merges People & agents. An agent row shows its budgets per service, spend this week (from paired receipts, §12.6), pending requests, and **Fund again**.
- *Collect* is the payee view (§12.3), merged with the hosted seller's `/fm/redeemable` feed.

**Agent-facing UX (machine readable):**
- Every 402 from `@flying-money/server` adds a JSON **body** field `hint`. The `Flying-Money-Offer` header and the wire formats are unchanged, so this is additive, in the same spirit as D14:
  ```json
  { "hint": { "reason": "no_certificate" | "insufficient" | "expiring" | "wrong-payee",
              "nextActions": ["request_budget", "top_up", "choose_other_chain"],
              "suggestedAmount": "500000", "service": { "name": "Silk Road Oracle", "origin": "https://…" } } }
  ```
- `fm_paid_fetch` (MCP) and `fm.fetch` (client) surface this as a **structured error**: `{ error: "no_certificate", service, chain, suggestedAmount, canRequest }`. The tool description tells the model: *"If canRequest is true, you may call fm_request_budget once, then wait. Never retry payment in a loop."*

**People-facing UX:**
- On each certificate in the wallet: **Ask for more** (a top-up request) and **Ask for a new place** (scan a shop QR → a request).
- When a till rejects a note with "insufficient", the wallet offers **Ask your giver** in one tap.

**Shop-facing UX:**
- The shop page and the till offer **Open a tab here**, which produces a `TabOffer` QR/link (§21.4.4).
- The till's "insufficient" screen shows the same offer, so the customer's giver can fund on the spot.

**Consistency rules:**
- **Status words.** Only *Sealed → Accepted (GUARANTEED) / Unverified · merchant risk → Collected*, and for requests *Asked → Approved / Declined / Expired*.
- **Money.** Always show the chain name next to amounts (e.g. "5.00 USDC · Arc").
- **Untrusted text.** Any text written by an agent or another person (reasons, names in links) is shown in a quoted, labelled block: *"Written by the agent, not verified"*.

### 21.4 V4: Spending requests (off-chain, no protocol change)

A request **never moves money**. Only the owner's own on-chain `issue` or `topUp` does. Requests make the owner's decision fast and safe.

#### 21.4.1 Objects (EIP-712, off-chain)

**Domain for all request objects:** `{ name: "FlyingMoneyRequest", version: "1", chainId }`. There is no `verifyingContract`, and the name is deliberately distinct from the Note domain, so no request signature can ever be a valid Note.

```
SpendRequest(
  address requester,      // the spender key that will receive the budget (signs this request)
  address owner,          // who is asked (funder)
  address payee,          // the service/place
  uint256 amount,         // USDC base units
  uint64  validFor,       // requested lifetime in seconds (≥ 86400)
  bytes32 certificateId,  // 0x0 = new certificate; otherwise a top-up of this certificate
  bytes32 requestId,      // 32 random bytes
  uint64  createdAt,
  string  reason,         // ≤ 280 chars, untrusted display text
  string  origin          // e.g. the service URL or place name, untrusted display text
)

RequestGrant(             // signed by the OWNER: "I accept budget requests from this key"
  address owner,
  address requester,
  uint256 maxAmountPerRequest,
  uint64  expiresAt,
  bytes32 grantId
)

TabOffer(                 // signed by the PAYEE's address: "open a tab with us"
  address payee,
  uint256 suggestedAmount,
  uint64  validFor,
  string  placeName,
  uint64  createdAt
)
```

Encoding on the wire and in links: `fm1.` + base64url(JSON), as in §6.4. Parsers are strict (as in §8.1).

#### 21.4.2 Channels

1. **Link/QR, no server (default for people):** `https://<domain>/app/requests/new#fm1.<{request, sig}>` (in the fragment, never sent to a server). Share it by any messenger. The owner opens it and sees the review card.
2. **Relay inbox (default for agents; needs a grant):** a Vercel API on Upstash (§21.5).
   - `POST /api/requests` with `{ request, sig, grant, grantSig }`. The relay verifies **both** signatures; checks that the grant is unexpired and not revoked; checks `amount ≤ maxAmountPerRequest`, `validFor ≥ 1 day`, `reason ≤ 280` and payload ≤ 4 KB; and applies rate limits: per requester, 1 pending per `(payee, chainId)` and 10 per day; per owner, ≤ 100 pending. It stores the request with a TTL of 7 days.
   - `GET /api/requests/{requestId}` returns public minimal status: `{ status: asked|approved|declined|expired, certificateId?, decidedAt? }`. The `requestId` is unguessable.
   - `GET /api/requests?owner=0x…` requires an **owner session**. The owner signs `InboxAccess(address owner, uint64 issuedAt)` (EIP-712, same request domain). It's valid for 10 minutes and exchanged for an HttpOnly session cookie (24 h). No other auth exists.
   - `POST /api/requests/{requestId}/decision` (owner session) takes `{ approved: { certificateId, txHash } }` or `{ declined: { note? } }`. **The relay marks a request approved only after verifying on-chain** that a `CertificateIssued` exists (or a `CertificateToppedUp` for top-ups) with `funder == owner`, `spender == requester`, `payee == request.payee`, and that `faceValue` (or the top-up amount) is > 0. The owner may approve **less** than asked.
   - `POST /api/grants/{grantId}/revoke` (owner session). After that, the relay rejects requests carrying that grant.

#### 21.4.3 Owner approval UX (Counting House → Requests)

- **Request card:**
  - **Who:** the local contact name if the requester address is in Holders; otherwise the address and an "unknown" label.
  - **Where:** the place badge if saved (✓ Scanned / ✓ domain / ✓ Signed by shop) or ⚠ Unverified.
  - **Amount, days,** and the **reason** in the untrusted block.
  - **Chain.**
- **Approve** opens the Give/Fund wizard **prefilled** (payee, spender = requester, amount, days). The owner can edit it, signs `issue` (or `topUp`) with their wallet, and the app posts the decision after confirmation.
- **Decline** takes an optional note.
- **Create a grant for an agent** (on the agent's Holder page): max per request and expiry (default 30 days). The result is an `FM_OWNER_GRANT` value to paste into the agent's config, shown once with a copy button. Grants are listed there with **Revoke**.

#### 21.4.4 Shop tab offers

- The shop signs a `TabOffer` with its payee wallet (it's already connected in "Open a shop").
- The QR/link opens `/app/give#fm1.…`, prefilled.
- The place gets the new badge **✓ Signed by shop**, verified by signature recovery equal to `payee`. It ranks with ✓ Scanned.

#### 21.4.5 SDK and MCP

- **Client:**
  - `fm.requestBudget({ offer | payee, chain, amount, days, reason })` uses the relay if an owner grant is configured, and otherwise returns a shareable link.
  - `fm.requestStatus(requestId)`.
  - On approval: **verify on-chain** that `spender == own key` and the payee matches, then add the `certificateId` to the persisted allowed list.
- **MCP** (§8.4 gains two tools, making six in total):
  - `fm_request_budget(url | payee, chain?, amount, days, reason)` returns `{ requestId, status, link? }`.
  - `fm_request_status(requestId)`.
  - **There is still no tool that approves, issues, tops up or reveals a key.**
- **Agent config:** `FM_OWNER` (owner address), `FM_OWNER_GRANT` (fm1 value), `FM_RELAY_URL` (default `https://<domain>/api/requests`).

#### 21.4.6 Request invariants and tests (MUST)

- **R1:** A request or grant never moves funds. Only an owner-signed on-chain transaction does. The relay holds no keys.
- **R2:** Approval binds `spender = requester` and `payee = request.payee`. The relay's "approved" state requires on-chain verification.
- **R3:** No agent-side path can approve. The relay requires an owner session for decisions.
- **R4:** Request text is untrusted. It is rendered escaped, labelled, and never auto-executed. The LLM-facing docs warn about prompt injection via `reason`/`origin`.
- **R5:** Spam is bounded by grants, rate limits, size limits and TTLs. Grants are revocable.
- **Tests:**
  - Signature parsing and verification, including the domain-separation proof that a SpendRequest signature is never a valid Note.
  - The relay rejects requests with no grant, an expired grant, a revoked grant, an amount over the grant max, or oversized input.
  - Rate limits.
  - Decision verification against anvil events, including the rejection of a wrong spender, wrong payee or wrong funder.
  - Escaping.
  - **The end-to-end flow on anvil:**
    1. The agent gets 402 `no_certificate`.
    2. It calls `fm_request_budget`.
    3. The owner approves (Playwright, mock wallet).
    4. The agent sees `approved`, verifies it, and pays successfully.

### 21.5 V5: Database: Upstash Redis via the Vercel Marketplace (FINAL)

- **Provider:** Upstash for Redis, installed from the Vercel Marketplace into the Vercel project(s). Vercel KV no longer exists, and Upstash is Vercel's Redis path. It supports Lua `EVAL` (used for the atomic `begin`/`finish`, D11) and is durable.
- **Two databases, so mainnet never shares storage with previews:**
  - `flying-money-testnet`: all testnet surfaces (web previews and production testnet features, the hosted testnet seller, the request relay, rate limits, demo locks).
  - `flying-money-mainnet`: only the mainnet seller instance (§21.6).
- **Environment variables** (read in this order; the first pair found wins):

| Var | Source | Used for |
|---|---|---|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | **Injected automatically** by the Vercel Marketplace Upstash integration | Primary |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Manual / local `.env` (Upstash console) | Fallback |
| `REDIS_URL` | Any TCP Redis (local tests only) | `redisStore(url)` |
| `FM_REDIS_PREFIX` | Set manually | Key namespace, default `fm:v1:${FM_ENV}:` |
| `FM_ENV` | Set manually | `testnet` or `mainnet`. A mainnet seller refuses to start if `FM_ENV ≠ mainnet` or the prefix lacks `mainnet` |
| `CRON_SECRET` | Set manually (Vercel standard) | Authorises `/api/cron/*` |

  No store variables → the memory store (local development only). **The hosted seller and the relay MUST refuse to start without a durable store.**
- **Key schema** (all under `FM_REDIS_PREFIX`; `{p}` below):

| Key | Type | Content | TTL |
|---|---|---|---|
| `{p}s:{payee}:{chainId}:{certId}:state` | hash | `accepted, consumed, reserved, status` | none |
| `{p}s:{payee}:{chainId}:{certId}:notes` | zset (score = cumulative) | SignedNote JSON | prune ≤ redeemed |
| `{p}s:{payee}:{chainId}:{certId}:out:{requestId}` | hash | Outcome (§6.5) | 30 d after final |
| `{p}s:{payee}:{chainId}:sub` | hash | In-flight redeem submission | until cleared |
| `{p}req:{requestId}` | hash | SpendRequest + status | 7 d |
| `{p}inbox:{owner}` | zset (score = createdAt) | requestIds | 7 d |
| `{p}grant:revoked:{grantId}` | string | `1` | grant expiry + 1 d |
| `{p}rl:{scope}:{id}` | counter | Rate limits | window |
| `{p}lock:{name}` | string (SET NX PX) | Redeemer, sweeper and demo locks | ≤ 5 min |
| `{p}sess:{token}` | hash | Owner inbox session | 24 h |

- **Backups:** the Upstash daily backup (plan permitting) plus `pnpm db:export` (a JSON dump of the seller namespaces) before every mainnet action. Seller state is authoritative (§6.5), so treat the mainnet database as production data.

### 21.6 V6: Hosted, durable 402 seller on Vercel

- **`apps/oracle`** (Hono) is deployed as its **own Vercel project**, `oracle.<domain>`, using the Hono Vercel adapter and the Node runtime. It keeps the §13.1 endpoints, plus:
  - `/.well-known/flying-money.json` and `/openapi.json`;
  - `/fm/redeemable/:certId` (the §12.3 payee feed);
  - the §21.3 `hint` bodies.
  - The in-route demo Oracle from D17 may remain for `/demo`, but **external agents (the MCP, Claude, Hermes) use the hosted one.**
- **Instances:**
  - Testnet: `ORACLE_ACCEPTS=arbitrum-sepolia,base-sepolia,monad-testnet,arc-testnet`, the `flying-money-testnet` database.
  - Mainnet: a separate Vercel project or environment with `ORACLE_MAINNET_ACCEPTS`, tiny prices, the `flying-money-mainnet` database and `FM_ENV=mainnet`. Deploying it requires founder approval (§0.1).
- **Redeemer and sweeper under Vercel limits.** Hobby cron runs **at most once per day with ±59 min precision**; Pro can run every minute.
  1. **Opportunistic:** after serving, `waitUntil(maybeRedeemAndSweep())`, guarded by `{p}lock:redeemer`. It applies the §8.3 policy and the §6.5 sweeper.
  2. **Cron** `/api/cron/redeem` (Bearer `CRON_SECRET`): daily on Hobby (`0 3 * * *`), every 10 minutes on Pro.
  3. **Manual:** **Collect** in the Counting House.

  **Consequence (MUST): on Hobby, set `safetyBeforeExpiry ≥ 36 h`, and use seller-facing certificate lifetimes of ≥ 3 days** (the demo and agent budgets), so a daily run always lands before expiry. Record the plan in DECISIONS.
- The seller refuses to serve if its store is not durable (§21.5).

### 21.7 Schedule impact (fits the existing sprints)

| When | Work | ✅ |
|---|---|---|
| Now (≤ 0.5 d) | V1 (remove workflows; `pnpm verify`), V2 (remove event pages and names; `/chains/[chain]`; denylist check) | `pnpm verify` green; denylist check passes on a production build |
| Before 3 Oct | V5 + V6 minimum: Upstash testnet database, hosted testnet Oracle with a durable store, opportunistic + daily cron redeemer | An external MCP session pays `oracle.<domain>` on Arbitrum Sepolia and a redemption lands |
| 5–11 Oct (Sprint B) | V4 (requests, grants, relay, tab offers, MCP tools, Requests tab) and V3 UX polish | The §21.4.6 end-to-end test passes; a real agent requests, the owner approves, and the agent pays |
| Cut-lines (append after "domain-verified places") | Tab offers → people "Ask" links → relay inbox. **Never cut:** R1–R5 when any part of requests ships |

### 21.8 Acceptance additions to §20

- [ ] No `.github/workflows`. `pnpm verify` covers everything listed in §21.1, and it passes.
- [ ] No event names on any public surface (denylist check). `/chains/[chain]` pages exist with `?chain=` preselection.
- [ ] Taxonomy table §21.3 applied. Counting House tabs: Give · Holders · Places · Requests · Collect.
- [ ] Spending requests: link channel + relay + grants + decision verification + two MCP tools. R1–R5 tests pass.
- [ ] Upstash via the Vercel Marketplace (`KV_REST_API_*`), two databases, the key schema, and refusal to start without a durable store.
- [ ] Hosted Oracle on Vercel with the redeemer strategy for the plan in use, and `safetyBeforeExpiry` set accordingly.


---

## Appendix A: Review log

### Part 1: v1.3 internal review

A full read-through of v1.2 found the following issues. All are fixed in this version.

| # | Where | Issue | Fix |
|---|---|---|---|
| R1 | §6.5 server verification | `last` came only from the seller's store. A wiped store or new server could accept a note already covered on-chain, which is worth nothing | `last = max(store, on-chain redeemed)`, mandatory; refresh when the store is empty |
| R2 | §7.2 `redeemMany` | One expired, closed or bad note reverted the whole batch. A POS collecting a day's notes at an expiry boundary could lose everything in that tx | Batch **skips** bad notes and emits `NoteSkipped(reason)`; single `redeem` still reverts with precise errors |
| R3 | §7.2 `issue` | `payee == address(this)` was allowed, which breaks the solvency invariant's accounting | Rejected with `InvalidParams` |
| R4 | §8.1 `Offer` type | Still single-chain after the move to `accepts[]` | `Offer.accepts: Accept[]`; `Receipt` type added |
| R5 | §8.3 store | Keys weren't chain-namespaced, so a certificate id collision across chains was theoretically possible | `CertKey = chainId:certificateId`; one in-flight batch per chain |
| R6 | §9 audit line | Said "Testnet only", contradicting the capped mainnets | Updated |
| R7 | §3.1 / §12.5 key policy | "One key per certificate" contradicted one key per agent | Unified in §3.9 (people: per certificate; agents: per agent) |
| R8 | §2.3 #8 | Said the target is "online sellers", contradicting offline shop mode | Rewritten for payee-scoped offline verification |
| R9 | §12.2 | Old `/c/[id]` route | `/c/[chain]/[id]` |
| R10 | §1, §3.6 | The summary was agent-only; "multi-chain routing" was ambiguous next to multi-chain support | The summary covers both front doors; the non-goal is now "cross-chain routing or bridging" |
| R12 | Toolchain | Unpinned OZ v5 (≥5.2) fails to compile without Cancun (`mcopy`), and Cancun support varies by chain | Pin OZ 5.1.0 + `evm_version = "shanghai"`; the reference contract was compiled and smoke-tested |
| R11 | Product gaps | No-wallet recipients, leftovers, control limits, and on-chain visibility were unstated | §3.8–§3.10, §12.6, the FAQ and the landing copy |

**Known limits deliberately left as-is (documented, not bugs):**
- There is no freeze or cancel.
- Leftovers go to the funder.
- A token-level transfer failure (a blocklisted payee) reverts a batch.
- First-time offline customers are limited by the shop's first-visit limit.
- The contract is unaudited, with mainnet caps.
- Scheduled allowances (`startsAt`) are postponed.

### Part 2: v1.4 external adversarial review (all accepted)

An independent review of v1.3 as a protocol, security and implementation spec found these issues. All are fixed in v1.4.

| # | Severity | Issue | Fix |
|---|---|---|---|
| X1 | Critical | ERC-1271 spenders break the core guarantee: contract signatures are revocable (valid at block N, invalid at N+1), and an offline till can't call `isValidSignature` | **ECDSA-only spenders** (`ECDSA.tryRecover`); smart accounts may still be funders; `vm.etch` permanence test; passkeys moved to research (§7.1 #6, §6.3) |
| X2 | Critical | Client persisted an incremented counter before sending, so repeated crashes could gift value | **Durable outbox:** sign → durably save the full pending note → send → resend the *same* note until a final receipt. Invariant **C1** (§6.6) |
| X3 | High | No exactly-once boundary between payment acceptance and service execution | `memo = requestId` (normative); seller state `accepted/consumed/credit`; outcome records PENDING/SERVED/FAILED_CREDITED; invariants **S1–S3**; idempotent handlers (§6.5) |
| X4 | High | First-time offline acceptance was shown as a normal "Accepted" | A separate **UNVERIFIED · merchant risk** status, capped by the first-visit limit (§6.8, §12.5) |
| X5 | High | "Fully safe offline" / "impossible" were too absolute | Replaced with conditional claims (verified certificate, authoritative state, clock margin, redeem before expiry); impossibility statements scoped to their assumptions |
| X6 | High | The 100 USDC cap was per certificate, not a deployment-wide risk bound | Immutable `maxTotalOutstanding` (1,000 USDC on mainnets) + `totalOutstanding` accounting + invariants I2/I2b |
| X7 | Med/High | Generic `issue(token, …)` contradicted USDC-only; the claim about rebasing detection was wrong | **One immutable token per deployment**; `issue` has no token arg; the balance-delta check is kept only as defence in depth |
| X8 | Medium | "Identical bytecode / same address everywhere" was false (constructor immutables differ) | The claim is now "same source and protocol on every chain"; CREATE2 same-address removed |
| X9 | Low | The version date was wrong | 23 Sep 2026 |

**Central claims (use these everywhere, and nothing stronger):**
1. Every redeemable note is backed by funds reserved exclusively for its payee until the certificate expires.
2. The spender cannot authorize more than the certificate's face value.
3. A redeemable note can be redeemed by anyone, but its value can only be delivered to the certificate's payee.

**Freeze statement:** superseded by the seal in Part 3.

### Part 3: v1.4.1 second adversarial pass (all accepted; scoped patch, no redesign)

| # | Severity | Issue | Fix |
|---|---|---|---|
| Y1 | High/Critical | **Concurrent credit reuse.** "Reserve P" had no state behind it, so N concurrent requests with distinct `requestId`s and the same cumulative could each spend the same credit | Explicit `reserved`. Admission is `consumed + reserved + P ≤ max(accepted, note.cumulative)`, **re-checked inside the atomic `begin`**. `finish` is valid only from PENDING. New invariant **S4** and tests against the memory store and Redis. A PENDING sweeper resolves via the application's idempotency status |
| Y2 | Medium | Store-loss recovery wiped the buyer's credit (`consumed := redeemed`) | **Redeem-only-served policy** (the redeemer submits the highest note ≤ `consumed`), so `redeemedOnChain ≤ consumed` always holds. Recovery marks the state `RECOVERED`; the **seller** bears ≤ its redemption lag, and the buyer never loses credit. Unspent credit returns to the funder at reclaim automatically. The seller store is declared authoritative and MUST be durable and backed up |
| Y3 | Medium | "Same bytecode everywhere" remained in the §5.1 diagram and the FAQ | "Same source + protocol" |
| Y4 | Medium | The roadmap required an audit "before any mainnet deployment" while the plan deploys capped mainnets | Audit before removing caps, production use, or meaningful TVL |
| Y5 | Medium | The TS `Receipt` didn't match the normative wire receipt; `memoFor()` contradicted `memo = requestId` | `Receipt` now carries `requestId/status/consumed/reserved/credit`; `memoFor` removed; `newRequestId()` added |
| Y6 | Medium | Key isolation was only a recommendation | The contract rejects `spender == funder` **and** `spender == payee` (a payee holding the spender key could drain the certificate) |
| Y7 | Low | "Valid note" was ambiguous | Normative terms: authentic / redeemable / accepted / redeemed (§3.2). Claims now say "redeemable" |

**Self-attack of the Y1 fix (done before sealing):**
- **Out-of-order arrivals:** the admission budget uses `max(accepted, note.cumulative)`, so an older, lower note arriving after a newer one isn't spuriously rejected. Safety is kept because `consumed + reserved ≤ accepted ≤ faceValue` always.
- **Replays:** a duplicate `requestId` is caught inside `begin`, the same transaction as admission.
- **Sweeper vs client retry:** both call `finish`, and only the first one leaves PENDING.
- **Credit locking:** an attacker can only lock *its own* certificate's credit (every request needs a spender signature). Rate-limit per certificate anyway.
- **Model-checked** with 300 randomized adversarial trials: 100 concurrent requests each, with mixed cumulatives, replays, and racing double-finishes. No invariant violation. The reviewer's exact attack (10 requests of 10 against `accepted = 10`) admits exactly 1.

**Seal:** v1.4.1 is the implementation contract. Hand it to the coding agent **as a build target, not a discovery prompt.** Changes after this point are defect fixes against invariants I1–I7, C1 and S1–S4 only.

*End of specification.*
