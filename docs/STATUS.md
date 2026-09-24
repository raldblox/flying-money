# Build status

Spec: `docs/BUILD_SPEC.md` v1.5 (§21 normative) · Decisions: `docs/DECISIONS.md` · Plan: §17 Sprint A (deadline **4 Oct 2026**)

## Visual pass (25 Sep): ✅ `pnpm verify` green

- **`/demo`:** an animated stage driven by the real event stream (`lib/demo-story.ts`, unit-tested).
  - Slips fly from the agent to the seller and answers fly back; bundles and coins travel between the seller and the chain.
  - A cut network shows as a broken wire, and a budget bar splits into collected, waiting and unspent.
  - 20 call squares with brackets show which transaction collected which calls; the thief's three attempts are stamped REFUSED; the result shows four big numbers.
  - A labelled illustration (no transaction links) plays before a live run.
- **`/how-it-works`:** scroll-driven, with a sticky money-flow diagram that animates each step (lock, sign, check, collect, leftovers back).
- **Landing page:** chapter 2 is an auto-advancing step explorer with the same diagram, using an agents or people cast.
- **`/guarantees`:** the three claims are illustrated; a "What if…?" picker gives a verdict and the worst case; the full threat model is folded.
- **`/shops`:** an animated counter scene (till and phone, offline badge).
- **Hosted Oracle:** live at `flying-money-oracle.vercel.app` (402 offers, Upstash store). It waits for `REDEEMER_KEY` and `CRON_SECRET` in its Vercel env to collect.

## v1.5 V5 + V6 (code) (25 Sep): ✅ `pnpm verify` green, S1–S4 on real Upstash

- **V5:**
  - Upstash `flying-money-testnet` is installed from the Vercel Marketplace (Free, iad1, eviction off) and connected to `useflyingmoney` (prefix `KV`).
  - The §21.5 key schema is in place (D25), and `sellerStoreFromEnv` has the durable-store refusal and mainnet guards (D26).
  - Redis locks and rate limits exist.
  - The S1–S4 store and server suites now run on Upstash in `pnpm verify`; test keys are deleted after each run (checked: 0 left).
- **V6 (code):**
  - `apps/oracle` has a Vercel entry (`api/index.ts`, `vercel.json`: rewrites, daily cron at 03:00, Bearer `CRON_SECRET`).
  - Hobby margins are 36 h (D27), with an opportunistic `waitUntil` sweep and redeem after serving.
  - The local server shares the same builder.
- **F8** (redeemer lock, anvil race test) and **F9** (shared demo limits: same-origin, lock, 1 run per visitor per 2 minutes, 6 USDC/day; D28) are fixed.
- `pnpm verify` now also accepts quoted values in `.env`.
- **Waiting for the founder:**
  - create the Oracle's own Vercel project (root `apps/oracle`) and connect the Upstash database to it;
  - set `PAYEE_ADDRESS`, `REDEEMER_KEY` and `CRON_SECRET` there;
  - push, which deploys.
- **Then:** the §21.7 check (an external MCP session pays the hosted Oracle on Arbitrum Sepolia, and a redemption lands).

## Audit 2026-09-25 fixes (25 Sep): ✅ locally

- **F1** request binding (D32), **F2** receipt clamping (D33), **F3** till-wide offline float (D34). Each had failing tests first, then the fix.
- **P1:** the header banner and `llms.txt` now state what the registry says is deployed. "Capped mainnets" is gone from `/guarantees`, `llms.txt` and the site constants, and the README says "no protocol fees (only network gas)".
- **Kept after checking:** "41 Foundry tests" (forge reports 41 passed: the invariant suite runs in two contracts) and "0.25 USDC for 20 calls" (8×0.01 + 4×0.01 + 6×0.02 + 2×0.005).
- **Already done before the audit snapshot:** `KV_REST_API_*` is read (`upstashEnv`, af6d397).
- **Next (per the audit's order and §21.7):** V5/V6 with F8 (redeemer lock) and F9 (shared demo limits), then F4, F5, F11, F6 and F7.
- **Stale:** the Phase 13 notes below mention `/hackathons` pages and CI jobs. Both were removed in v1.5 V1 + V2.

## Copy + mobile pass (24 Sep): ✅ locally

- New copy deck `docs/copy/copy-deck.md` (consumers, developers, investors, partners), applied to the landing page, `/shops`, `/pitch`, header, footer, metadata, manifest, `llms.txt`, the till, the wallet, the demo, the README top and `docs/site` (D31).
- Landing page: two doors (For AI agents / For families & shops) with zero layout shift when switching; the mobile menu is a fixed panel, so opening it never moves the header.
- Mobile audit at 375 px across 20 routes: `/wallet`, the till and `/app/places` scrolled sideways because of wide text fields; fixed (text fields may now shrink).

## v1.5 step 1: V1 + V2 (24 Sep): ✅ `pnpm verify` green

- **V1:**
  - `.github/workflows` is deleted.
  - `pnpm verify` is the gate: lint, clean build, typecheck, tests (forge invariants included), secret scan, public-surface check; `--e2e` adds Playwright (D23). Last run passed in 52 s.
  - S4 also runs on Upstash when store env is present (not yet: waiting for the Marketplace install).
  - Commits are local only; nothing is pushed.
- **V2:**
  - `/hackathons/*` and `lib/hackathons.ts` are removed; the footer link is gone and `/pitch` is event-neutral.
  - The registry's `hackathons` field is replaced by public `notes`.
  - New `/chains/[chain]` pages for all 8 registry chains, with "Try it" buttons and `?chain=` preselection (D24).
  - Per-event material moved to `docs/submissions/*.md` (not served).
  - The denylist check is clean on a fresh production build.

## Phase 13: Hackathon pages and browser e2e (24 Sep): ✅

- **`/hackathons/[event]`** for arbitrum, colosseum, monad and arc (§16.2), from `lib/hackathons.ts`. Each page has its own framing and track, leads with the door that fits the track, and reads its chains from the registry.
- The pages say only what is true today: "is live on Arbitrum Sepolia and will be deployed on Arbitrum One"; not-yet-deployed chains say so.
- The Monad page picks Track 4 (agents + MCP lead). §16.2 asks us to pick one; it is one line to change.
- **Playwright e2e** (`pnpm --filter @flying-money/web e2e`, §17 Sprint B): on a private anvil it connects the mock wallet, issues 5 USDC, signs a 2.50 note with the e2e spender key, redeems it as the payee, and checks that the replay is refused ("Already redeemed").
  - Locally it uses the installed Chrome; CI installs Chromium.
  - The teardown stops anvil and removes the e2e files.
  - **New CI job: `e2e`.** Vitest is now scoped to `test/`.

## Phase 12: Contacts, people & places (24 Sep): ✅ locally (anvil)

- **`/app/places`:**
  - **✓ Scanned:** scan the till's price code, or the QR on the shop page, which now encodes the shop page itself.
  - **✓ domain:** reads the seller's `/.well-known/flying-money.json` in the browser.
  - **⚠ Unverified:** a pasted address, which must be confirmed twice before issuing.
  - A place's verification can never be downgraded.
- **`/app/people`:** add a person, child, employee or agent, with the §3.9 key policy (a fresh key per certificate for people, one key for agents and employees).
- **`/app/people/[id]`** (the holder control page):
  - totals: left in total, collected so far, open certificates;
  - per certificate: status, tally, "Ends in 2 days. Renew?", and Top up, Extend and Reclaim (for the funder's wallet);
  - **Give a certificate:** the wizard is prefilled with the holder's key policy and the saved places;
  - **Renew:** same place, amount and length, with a new key for per-certificate holders.
- **Wizard:** presets, saved places with their badges, "Now give it to Mia" copy, and the hand-over link named after the holder.
- **Privacy and backup:** contacts stay in IndexedDB only, with an encrypted export and import (passphrase). The pages state the no-freeze control model and the privacy rule.
- **Verified on anvil:**
  1. Scanned "Lantern Café" from its shop link.
  2. Added Mia (child).
  3. Gave 10 USDC and got the hand-over link.
  4. Renew prefilled 10 USDC, 7 days and Lantern Café, and issued.
  5. Mia's page showed 2 certificates and 20.00 left.
- **Not done (optional in §12.6):** local reminder notifications (an in-page "Renew?" is shown instead), and receipts from a paired holder wallet to the funder (a stretch goal).

## Phase 11: `@flying-money/mcp` (24 Sep): ✅ tests + stdio probe · ⏸ a live Claude session paying (human)

- **Tools** (§8.4): `fm_status`, `fm_explain`, `fm_quote` and `fm_paid_fetch` (with `max_price`). There are no issue or top-up tools, and no tool returns the key.
- **Transports:** stdio by default, or `--http <port>` for streamable HTTP on 127.0.0.1 only.
- **Configuration** from env: `AGENT_KEY`, `AGENT_CERTIFICATES`, `AGENT_CHAINS`, `FM_MAX_PRICE`, `FM_STORE`. It uses the durable file outbox.
- **Tests (5)** against a real in-process Oracle:
  - exactly four tools;
  - status and explain never contain the key;
  - quote is free, then paid fetch pays 0.01;
  - `max_price` refusal;
  - stops at the face value (remaining 0.00);
  - non-http URLs refused.
- **Binary probe:** `dist/bin.js` over stdio lists the four tools and answers `fm_explain` from Arbitrum Sepolia.
- **Docs:** `/docs/mcp` (Claude Desktop, Claude Code, HTTP) and `packages/mcp/README.md`; `/llms.txt` links it. It is not on npm yet, so the docs say to build it from the repo.
- **Still open:** a real Claude session paying a live seller (§17, 9–10 Oct). That needs a public, durable Oracle deployment and a person to run Claude with the config.

## Phase 10: /demo scenarios (24 Sep): ✅ on anvil (CI test) and live on Arbitrum Sepolia

- **Cut the network** and **Steal the agent key** toggles (D22); Redeem now and Reset are covered (see D22).
- **Live run on Arbitrum Sepolia:** 20 requests, 3 redemptions, 0.25 USDC paid for exactly what was served. With the seller's chain connection cut, notes kept being accepted. The thief was refused three times: by the seller (insufficient), by the contract (`ExceedsFaceValue`, a read-only call) and by a different seller (wrong-payee).
- **New anvil test** `apps/agent/test/scenarios.test.ts` checks four things:
  - notes are accepted while the connection is cut, with no redemption until the restore;
  - all three thief attempts are refused;
  - the payee's balance equals what was served;
  - the amount redeemed equals the amount served.

## Phase 9: Counting House funder actions (24 Sep): ✅ locally (anvil)

- **Top up** (approve if needed → `topUp`), **Extend** (+1, +7 or +30 days; never shorter, at most 365 days from now), **Reclaim** (only after expiry). Also **Open page** on every issued certificate (§12.2).
- The UI mirrors the contract's rules, so a transaction that would revert is never offered: caps, balance, lifetime, and funder-only actions (the list only shows your own certificates).
- A closed certificate now says "X spent · Y returned to you" instead of "left". The certificate page labels it "Returned to funder".
- **Verified on anvil:** 5 → 7 USDC after a top up; 7 → 14 days after extending; after moving the chain clock forward 15 days, reclaim returned all 7 USDC (funder balance back to 100) and the card shows Closed.
- Still open from §12.3: a payee "note feed" from a live seller (`NOTE_FEED_URL`). It needs a standalone, durable Oracle deployment (the demo Oracle runs inside the `/demo` route). Pasting a note works today.

## Phase 8: Arbitrum submission kit, part 1 (24 Sep): ✅ built and checked locally

**Done**
- **Docs (§10.1, §10.7):**
  - One Markdown source per page in `docs/site/`: agents, shops, protocol, contract, client, server, guarantees, faq, story.
  - Rendered at `/docs/<page>`, served raw at `/docs/<page>.md`, and concatenated into `/llms-full.txt` with the deployment table.
  - `/llms.txt` now links the `.md` twins.
- **Every TypeScript sample in the docs and README is typechecked** against the real packages (`tools/doc-samples`, part of `pnpm typecheck` in CI). It caught one broken sample on the first run.
- **Pages:**
  - `/story` (chapters from `story.md`, with the map and tally art);
  - `/how-it-works` (issue → seal → serve → redeem → reclaim, with a Plain words / Technical toggle);
  - `/pitch` (for judges);
  - `/shops` (the second front door);
  - `/gift` (forwards the `#add=` fragment to the wallet).
- **Header** now links Docs and Shops; the **footer** links Docs, How it works, the story, Pitch and llms.txt. The hero CTA goes to `/story` (§10.2).
- **README** per §14.3.
- **Historical accuracy (§10.3, "no invented details"):** checked against Wikipedia. "Dangerous roads" and "two halves" were not in the source, so the story and landing now say heavy strings of coin and matching tallies. Britannica refused the automated fetch, so it is still linked but unchecked (H8 review).
- **Brand:** the 騎縫 tally seal is now the mark, favicon, app icon and the seal stamp (commit 7b64ea0).

**Still open for §16.1:** the 2-minute video and deck PDF (human). The Arbitrum One capped deployment is on hold at the founder's request.

## Phase 7: Shop mode minimum (24 Sep): ✅ locally (e2e on anvil, offline shell verified) · ⏸ phone + camera run on Arbitrum Sepolia by a human

**Done**
- **SDK, tests first** (commit a961c47):
  - `createCounter`, the shop till (§6.8). It gives GUARANTEED / UNVERIFIED · merchant risk / REJECTED, and a re-scan returns the same outcome.
  - A note sealed for a different order is rejected.
  - On reconnect, unverified payments are promoted to guaranteed or flagged.
  - The till's store is persisted on every write (D21). The S1–S4 tests also run against a store re-opened from its saved snapshot on every call.
  - Counter wallet (§6.6 at a counter, D20), with a randomised C1 test with crashes.
- **Web:**
  - `/shop` (open a till).
  - `/shop/[chain]/[payee]` (the shop page with a counter QR).
  - `/shop/[chain]/[payee]/pos` (the till):
    - price list, keypad, price QR, camera scan or paste;
    - a seal animation on "Accepted 3.50 · Customer remaining 16.50";
    - the ledger ("Accepted by you" → "Collected on-chain"), **Collect** in one `redeemMany`, and re-checking unverified payments;
    - settings: first-visit limit (default 5 USDC), price list, primary-till flag;
    - one tab per till (Web Locks).
  - `/wallet`:
    - PIN-sealed spender keys (scrypt → AES-GCM) in IndexedDB;
    - add a certificate from a hand-over link (the key travels only in the URL fragment and is cleared after import), or make a key and fund the certificate in the Counting House;
    - pay: scan the price QR → review → PIN → full-screen sealed-note QR (screen kept awake) → "Yes, the shop accepted it" / "No, the shop didn't accept it";
    - an open-payment banner, balances "on this device" plus what the shop has collected, backup export/restore, and an Add-to-Home-Screen prompt.
  - Counting House: "Give it to someone" hand-over link + QR after issuing with a browser-made key.
  - Offline shell (`public/sw.js`):
    - pages network-first with a cached fallback; build assets cache-first;
    - on install it caches `/wallet`, `/shop` and every asset they reference;
    - pages also add their own assets once the worker is active;
    - `/api` and cross-origin RPC are never cached.
- **Verified locally:**
  1. Issue 20 USDC with a browser key → the hand-over link opens the wallet.
  2. Tea 3.50 → GUARANTEED.
  3. The till's chain connection is cut: the returning customer is still GUARANTEED (remaining 13.00), and a new customer is **UNVERIFIED · merchant risk**.
  4. After reconnecting, the unverified payment is promoted. **Collect** sends one transaction, and the shop balance goes up by exactly 9.25 USDC.
  5. With the server stopped, `/wallet` still loads (never opened before in that browser).
  6. A QR round-trip test (uqr → jsQR) decodes a 547-character sealed note.
- Also: web polish (certificate art, code ruling, smooth scroll, plain-language copy); deployed at https://useflyingmoney.vercel.app (Git-connected, root `apps/web`).

**Needs a human**
- Run the café flow on two real devices on Arbitrum Sepolia (camera scan, Add to Home Screen, airplane mode).
- H5: add `DEMO_FUNDER_KEY`, `DEMO_AGENT_KEY`, `REDEEMER_KEY` and `PAYEE_ADDRESS` in Vercel project settings for `/demo`. I didn't copy private keys to a third-party service.

## Phase 6: Counting House minimum + agent docs (24 Sep): ✅ locally (e2e on anvil) · ⏸ real-wallet run on Arbitrum Sepolia by a human

**Done**
- **`/app`, the Counting House** (§12.1–§12.4). wagmi 3 with a browser wallet (D18).
  - A chain selector from the registry, with mainnets hidden behind "Show mainnets (real money)".
  - A mode banner: "Test money only" with the Circle faucet on testnets; the capped-mainnet wording otherwise.
  - A wrong-network prompt with Switch.
  - **Issue wizard**, three steps:
    1. **Place:** the demo Oracle is pre-listed; a pasted address is labelled ⚠ unverified and needs a "checked twice" confirmation.
    2. **Spender:** bring an agent address (recommended, `npx @flying-money/client keygen`), or generate a key in the browser. That key is shown once, downloaded as a `.env` and never stored or sent.
    3. **Budget and time:** 1, 7 or 30 days; cap-aware and balance-aware.
    - It blocks spender = your wallet and spender = payee before the contract would. A review sentence ("Give … USDC at … for …") leads to approve, then issue.
    - On success: a seal stamp, the certificate id, the config snippet, and links to the certificate page and transaction.
  - **Certificates you issued:** from `CertificateIssued` logs filtered by funder, with remaining, tally, status, payee, spender and expiry.
  - **Certificates you can redeem:** the same, filtered by payee.
    - Paste a sealed note. It's checked in the browser (domain, id, ECDSA signer, above redeemed, within face value, not expired) before Redeem is enabled.
    - Redeeming joins the tally halves and stamps the seal. The page explains that anyone may redeem and money only reaches the payee.
  - **§12.4 transaction states:** preparing → awaiting wallet → submitted (hash + link) → confirming → confirmed or failed. Nothing is shown as successful before the receipt; once a hash is known, the retry button becomes "Check status".
  - Loading skeletons, empty states, and errors with a retry.
- **Agent docs minimum** (§10.7):
  - `/llms.txt`: links only to pages that exist; no claims beyond Guarantees.
  - `/.well-known/flying-money.json`: generated from the registry. Chains, contracts, USDC, caps, EIP-712 domain and types, header names, spec version, `audited: false`.
  - `AGENTS.md` already existed.
- **Design pass** (`b791e46`), after founder feedback: rice-paper desk and torn-edge sheets; hand-drawn SVG art (ink-wash landscape, Silk Road map, a tally whose seal spans both halves, brush icons); the landing page retold as chapters; ledger-ruled tables; a seal logo; light and dark.

**Verified: browser e2e on anvil** (D19; wagmi mock connector, anvil's public dev accounts):
1. Connect.
2. The wizard **blocked spender = own wallet** (a mis-filled field caught it).
3. Approve 5 USDC: confirmed.
4. Issue: certificate `0xbc8b…0445`, success screen.
5. Payee view: pasted a 2.50 USDC note signed by the agent key: "Valid note: redeeming pays 2.50 USDC".
6. Redeem: confirmed; the tally went from 0.00 to 2.50 of 5.00.
7. Re-pasting the same note: "Already redeemed", Redeem disabled.
8. The issued list shows 2.50 of 5.00 left.

`/llms.txt` and the well-known JSON were fetched and checked. Lint clean; `pnpm build` / `typecheck` / `test` all green (17 test tasks).

**Needs a human:** the row's ✅ says "a fresh wallet can issue and redeem on Arbitrum Sepolia". That's a click-through with MetaMask on `/app`: connect, issue about 1 test USDC to the demo Oracle's payee, then redeem a note. The e2e above proves the same code path on anvil.

**Next:** Phase 7, Shop mode minimum (POS price QR → wallet sealed-note QR → Accept → Collect, offline accept with the PWA), then Arbitrum One (capped), for which I will **stop and ask before any mainnet transaction**, plus the README, video and pitch.

## Phase 5: Web minimum (24 Sep): ✅ local, live on Arbitrum Sepolia · ⏸ public deploy blocked on H5 (Vercel)

**Done** (`apps/web`: Next.js 16 App Router, Tailwind 4, TypeScript)
- **Design system "Paper, Ink, Seal"** (§11): the §11.2 tokens verbatim, light and dark themes, paper grain, brush dividers.
  - Motion: seal stamp, tally halves joining and notes flying, all respecting `prefers-reduced-motion`.
  - Fonts: Cormorant Garamond, Inter, JetBrains Mono, and Noto Serif TC for 飛錢 (Chinese text awaits H8 review).
  - Components: Certificate, Seal (semantic only), Tally, AddressPill, StatusChip, CodeTabs.
- **Pages:**
  - `/`: landing per §10.2, with the agents / people & shops toggle; historical claims link to Wikipedia and Britannica.
  - `/demo`: live, per §13.3. Merchant log, The Road (sealed notes), Oracle ledger with real tx links, certificate strip.
  - `/c/[chain]/[id]`: terms, tally, the full event timeline from the chain, and "Verify it yourself".
  - `/chains`: from the registry.
  - `/hackathons/arbitrum`.
  - `/guarantees`: §3.4, §9, control model, privacy statement, what we removed, audit status.
  - Also: 404 and a PWA manifest (offline service worker for /shop and /wallet comes in Shop mode).
- Every page states its mode ("Testnet · test money · unaudited"). No absolute claims.
- **Demo runner** `/api/demo/run` (D17): real transactions, serialised, rate-limited, timeout-protected. Keys stay server-side in env and are never sent to the browser.

**Verified**
- **Live via the web API on Arbitrum Sepolia**, in 27 s: certificate `0x3828dee6…3acff` issued, 20/20 calls served, 3 redemptions (0.10 + 0.10 + 0.05), 0.05 USDC left for the funder.
- The certificate page reads the real chain: terms plus the full timeline (issue + 3 redemptions with tx links).
- 375 px: no horizontal scroll on any page. Light and dark themes checked. Biome a11y lint clean.
- `next build` passes. The whole repo passes `pnpm typecheck` and `pnpm test` (17 turbo tasks).

**Blocked**
- The row's ✅ ("Live site on Vercel") needs **H5**: a Vercel account and project. Set the root directory to `apps/web` and add env vars `DEMO_FUNDER_KEY`, `DEMO_AGENT_KEY`, `REDEEMER_KEY`, `PAYEE_ADDRESS` and `NEXT_PUBLIC_DEFAULT_CHAIN=arbitrum-sepolia`.
- The domain is a placeholder until **H6**.

**Next:** Phase 6, the Counting House minimum (connect, issue with an agent-key download, list, redeem as payee) plus the minimum agent docs (`/llms.txt`, `/.well-known/flying-money.json`, `AGENTS.md` already exists).

## Phase 4 live run on Arbitrum Sepolia (24 Sep): ✅ row acceptance met

`pnpm --filter @flying-money/agent demo:testnet` (keys from `.env` only; testnet demo wallets generated by `scripts/gen-test-wallets.ts`):
- Certificate `0xc1d6f0b309ad3ef11e1ddd2dedc38378f0e9a8e78c0ad1d62f7422ee6a86e44f`: 0.50 USDC, 7 days, payee `0xE828…53d2`, agent `0x534c…7299`.
  - issue tx: https://sepolia.arbiscan.io/tx/0xd4133fca4949bc7466f70cf2ea7b20e59d19b28ffbb9b97dfeede7932c301a6c
- **20/20 paid calls served** (tea, live Open-Meteo weather, routes, proverbs).
- **3 on-chain redemptions** of 0.10 + 0.10 + 0.05 USDC:
  - https://sepolia.arbiscan.io/tx/0x69738cdf9c3d285cc876da5ac3bd250e68c78ec144745c9c7dca3c1a4c474f7b
  - https://sepolia.arbiscan.io/tx/0x5c76f243935da45f12ba5e32b2d0a73489e7c8fc0303bb2204b95824ee776000
  - https://sepolia.arbiscan.io/tx/0x38f44ea210ec4e6513d0ba8f8bbf74001a4aa856ac1492a016d2c1f97d2b82b3
- Payee received exactly **0.25 USDC** = Σ prices served. The remaining 0.25 USDC returns to the funder after expiry.

## Phase 4: Oracle + Merchant agent (23 Sep): ✅ local on anvil

**Done**
- `apps/oracle` ("Silk Road Oracle", §13.1), built on Hono:
  - **Paid endpoints**, with game data labelled `illustrative: true`:
    - `/v1/tea-price` 0.01
    - `/v1/route` 0.02
    - `/v1/weather` 0.01: real Open-Meteo data, attributed, and fetched once per `requestId`
    - `/v1/proverb` 0.005: public-domain Legge translations, with sources
  - **Free endpoints:** `/health`, `/fm/prices`, `/.well-known/flying-money.json` (seller discovery, §10.7), `/fm/redeemable/:id` (the highest note with `cumulative ≤ consumed`), `/fm/stream` (SSE of notes and redemptions) and `/openapi.json`.
  - CORS exposes the Flying Money headers. Bad input returns 400 and becomes credit (S3).
  - `src/main.ts` is configured from env: store = Upstash, then Redis, then memory (with a loud "not durable" warning). It starts the sweeper, plus the redeemer when `REDEEMER_KEY` is set (demo policy: 0.10 USDC or 60 s).
- `apps/agent` ("The Merchant", §13.2 mode A):
  - a deterministic 20-call plan (8 tea prices, 4 weather, 6 routes, 2 proverbs) that summarises the best trade;
  - `pnpm --filter @flying-money/agent start` against a real Oracle (fileStore outbox, `--json` event lines for the demo runner);
  - **`pnpm --filter @flying-money/agent demo:local`**: the whole demo on a private anvil in one command.
- Redeemer hardening: `tick()` is now serialised, so overlapping ticks can never start two submissions.
- Flaky test fixed: the randomised S4 test could exceed Vitest's 5 s default when run through the in-process Lua VM under load. It was a timeout, never an invariant failure. Fixed-time sleeps were also replaced with polling.

**Test results:** `pnpm test` → all **15 turbo tasks green, 132 tests**.
- Oracle: 6/6.
- **Phase 4 local acceptance** (`apps/agent/test/e2e.test.ts`) passes against the Oracle over real HTTP:
  - **20/20 paid calls**, **≥ 1 on-chain redemption**;
  - payee received exactly the 0.25 USDC served;
  - 0.25 USDC remains for the funder at expiry.
- A manual `demo:local` run with live weather: 20 served, redeemed in **3 transactions**, best trade printed.

**Blocked:** the row's ✅ ("scripted run on Arbitrum Sepolia: ~20 paid calls, ≥ 1 on-chain redemption") needs:
- ~~H1~~ (done: the contract is deployed);
- **H2:** Circle testnet USDC on the demo funder;
- **H3:** `PAYEE_ADDRESS` and `REDEEMER_KEY` with Arbitrum Sepolia ETH.

**Next:** Phase 5, the web minimum (§10–§11): design tokens, landing, `/demo`, `/c/[chain]/[id]`, `/chains`, `/hackathons/arbitrum`, Guarantees. Built against anvil now; the Vercel deploy needs H5.

## Phase 3: core + client + server SDK (23 Sep): ✅ local

**Done** (property tests written before the implementations)
- `@flying-money/abi`: ABI and bytecode generated from the forge build; a freshness test.
- `@flying-money/core` (§8.1):
  - types, EIP-712 domain/types, `certificateId`, `hashNote`, `signNote`;
  - offline `verifyNoteSignature`: pure ECDSA with OZ parity (65 bytes, v ∈ {27,28}, low-s);
  - strict `fm1` encode/decode for notes, offers and receipts (D4);
  - `readCertificate`.
- `@flying-money/server` (§6.5, §8.3):
  - `createFlyingMoneyServer` runs the full algorithm: offers, strict parsing, D3 ordering, cert cache, recovery (D5), atomic `begin`/`finish`, sweeper;
  - `memoryStore` and a Lua **Redis store** (`redisStore(url)` over TCP, `upstashStore()` over HTTPS for Vercel; decimal-string arithmetic in Lua, exact above 2^53);
  - Hono middleware `@flying-money/server/hono` and a `createIdempotency()` helper;
  - `createRedeemer`/`startRedeemer`: redeems only served value, batches ≤ 20, records the tx hash before broadcast, never rebroadcasts, reconciles on revert, skip or drop.
- `@flying-money/client` (§6.6, §8.2):
  - `createFlyingMoneyClient`: durable outbox, one pending note per certificate, resends the same note on failure, restart resolution, per-certificate mutex;
  - `NoCertificateError`, `PriceTooHighError` and never signs above face value;
  - `fileStore` (temp file + fsync + rename) and `memoryStore`;
  - `paidFetchTool` and the `flying-money keygen` CLI (prints only the address).

**Test results:** `pnpm test` → **all 12 turbo tasks green, 125 tests**.

| Package | Tests | Coverage |
|---|---|---|
| contracts | 41 | unchanged from Phase 2 |
| chains | 18 | |
| abi | 2 | |
| core | 11 | incl. **TS↔Solidity parity**: `noteDigest` == `hashNote` for 100 random inputs on anvil, `certificateId` == `issue()`, a TS-signed note redeems on-chain |
| server | 41 | NoteStore contract + protocol tests; each runs against the **memory store** and the **Redis Lua store** (in-process `ioredis-mock`) |
| client | 12 | **C1**, fileStore, and **anvil integration** |

- **Server protocol tests:**
  - **S1:** sequential and 20× concurrent replays execute exactly once.
  - **S3.**
  - **S4:** the exact attack of 10 × 10 against accepted 10 admits exactly 1; plus 5 randomised trials of 10–100 concurrent requests with mixed cumulatives and two server instances, with the §6.5 invariant probed after every `begin`/`finish`.
  - **Sweeper:** done, failed, not-started and running, with a racing retry.
  - **PENDING resume.**
  - **D3.**
  - **Store loss → RECOVERED.**
  - **Cert cache.**
  - **"Cut the network".**
- **C1:** 1,000 requests with 8% dropped requests, 8% lost responses, 5% service failures and 2% crashes at each of sign, save and send. The highest cumulative ever signed == Σ price(SERVED) + credit == the seller's `accepted`, with no higher note.
- **Anvil integration (the §17 row's ✅):**
  - 50 requests → **≤ 3 redeems** → payee balance = Σ prices served;
  - overspend refused at the cap; a thief's over-face note is rejected;
  - wrong payee is rejected and the client refuses;
  - replay: same response, no extra charge;
  - 20 concurrent requests;
  - **redeem-only-served**: credit is never redeemed and reclaim returns face − consumed;
  - **store loss**: RECOVERED, seller loss ≤ redemption lag, and the buyer never pays for unserved requests.
- Real Redis/Upstash runs of the Redis-store tests happen in CI (Redis service), or locally once `REDIS_URL` or `UPSTASH_REDIS_REST_*` is set. **Not yet run against a real Redis:** CI hasn't run because nothing is pushed.

**Blocked:** nothing locally. The Phase 2 deploy is still waiting on H1/H4.

**Human inputs needed next**
- **H1/H4:** to deploy and verify on Arbitrum Sepolia.
- **H2/H3:** for the Phase 4 Oracle run on Arbitrum Sepolia (29 Sep): Circle testnet USDC on `DEMO_FUNDER_KEY`, plus `PAYEE_ADDRESS` and a gas-funded `REDEEMER_KEY`.
- Optional: an Upstash database, to run S4 against real Redis before CI.

**Next:** Phase 4. Build the Silk Road Oracle (Hono, §13.1) and the Merchant agent (§13.2). Run them locally on anvil first, then on Arbitrum Sepolia once H1–H3 arrive.

## Arbitrum Sepolia deployment (23 Sep): ✅ deployed and verified

| | |
|---|---|
| Contract | `0xb9ae3158f9cA841d9Da3C3725014D8352ca967F2` |
| Chain | Arbitrum Sepolia (421614), block 311943442, tx `0x35ea657719cb4c10d3b13855df47c5fd45d795c0b88da293cb6c9008bf6fd215` |
| Constructor | Circle USDC `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`, caps 0/0 (testnet, from the registry) |
| Verified | **Blockscout** (keyless, D16): https://arbitrum-sepolia.blockscout.com/address/0xb9ae3158f9cA841d9Da3C3725014D8352ca967F2. An Arbiscan badge needs an Etherscan key; add one later and run `pnpm verify:chain arbitrum-sepolia` |
| Deployer | `0x8dB423F3b8991865030BcE381F7A50EC517c7c50` |
| Live checks | `pnpm deployment:check arbitrum-sepolia`: on-chain EIP-712 domain, token, caps and `noteDigest` all equal the SDK (4/4 OK) |

- The deploy script now records the deployment **before** verifying, so a verification failure can never lose the address.
- Verification tries Etherscan (only if a key is set), then Blockscout, then Sourcify. Forge's Sourcify endpoint failed today; Blockscout succeeded.
- MetaMask-style keys without `0x` are accepted.
- The Phase 2 row's ✅ is now fully met.

## Phase 2: Contract + unit tests + invariants + Deploy script (23 Sep): ✅

**Done** (tests written before the contract, per §0.3)
- `contracts/src/FlyingMoney.sol`: **byte-for-byte the §7.2 reference** (checked with `diff` against the spec).
- `contracts/src/MockUSDC.sol` per §7.3: 6 dp, `mUSDC`, `faucet()` gives 100 with a 1 h per-address cooldown, no owner mint.
- Test fixtures: a fee-on-transfer token, a re-entrant token, an ERC-1271 garbage-accepting code for `vm.etch`, and a transfer-tracking token for the invariants.
- `script/Deploy.s.sol` + `pnpm deploy:chain <key>` / `pnpm deploy:all` (`scripts/deploy.ts`, cross-platform):
  - Constructor arguments come from the registry.
  - Guards:
    - reverts `RegistryMismatch("chainId")` if the RPC's chain ID ≠ the registry's;
    - checks USDC `decimals() == 6` and that it has code;
    - a mainnet needs `--confirm-mainnet` (§0.1) and non-zero caps.
  - Records `flyingMoney` and `deployedBlock` in `packages/chains/src/deployments.json`, from the broadcast receipt.
  - `DEPLOYER_KEY` is read from env only and never printed.
- `docs/SECURITY.md`: guarantees, threat model, test evidence and gas.

**Test results:** `forge test` gives **41/41 pass**.
- 24 FlyingMoney unit tests cover §7.4 #1–#14b; 1 MockUSDC test.
- **16 invariant tests: I1, I2, I2b, I3, I4, I5, I6, I7**, each at **256 runs × depth 50 (12,800 calls)**, against an uncapped and a capped (300 / 1,000) deployment.
- One handler bug (a doubled ghost count when a certificate appeared twice in one batch) was fixed in the *test*. No contract or invariant was changed.
- Gas: `redeem` 85,758; `redeemMany`(10) 328,192.
- Deploy on local anvil: ✅. The mainnet refusal and chain-ID mismatch guards were both shown to stop the deploy.

**Blocked:** deploy and verify on **Arbitrum Sepolia** (the rest of this row's ✅) needs:
- **H1:** `DEPLOYER_KEY` in `.env`, funded with Arbitrum Sepolia ETH;
- **H4:** an Etherscan-family API key in `EXPLORER_API_KEYS` (Etherscan API v2 keys cover Arbiscan and Basescan).

Then run `pnpm deploy:chain arbitrum-sepolia --verify`.

**Next:** Phase 3, the SDK (core, client, server). Write the property tests C1, S1, S3, S4, the sweeper, redeem-only-served, store-loss and parity tests first. Then the anvil integration run: 50 requests → ≤3 redeems.

## Phase 1: Reset + skeleton + CI + `@flying-money/chains` (23 Sep): ✅ local

**Done**
- §4 reset: done before this build (H10 confirmed; legacy on branch `legacy-prototype` and in the ignored `.legacy/`).
- §0.2 toolchain:
  - Foundry 1.3.5, solc **0.8.24**, `evm_version = shanghai`, optimizer 200, invariant runs 256 × depth 50.
  - Submodules: forge-std v1.10.0 and **OpenZeppelin v5.1.0** (`69c8def`).
- Monorepo:
  - pnpm workspaces + turbo, TypeScript 7.0, Biome lint, vitest.
  - `packages/{core,client,server,mcp,abi,chains}` and `apps/{web,oracle,agent}` exist; everything except `chains` is a placeholder.
- `@flying-money/chains`:
  - All 9 registry keys with the §5.4 values, plus `maxTotalOutstanding` (D1).
  - RPC env overrides (`RPC_<KEY>`), `getChain` / `getChainById`, and runtime registration for anvil only.
  - Generated `registry/<key>.json` files for the forge deploy script (D2).
- CI (`.github/workflows/ci.yml`): gitleaks secret scan, forge build and tests, and lint + build + typecheck + tests. The TS job has a Redis service for the S4 tests (D11).
- Docs: `AGENTS.md`, `.env.example` (Upstash vars added), `LICENSE` (MIT), `docs/DECISIONS.md` (D1–D12).

**Test results**
- `@flying-money/chains`: **18/18 pass**. This includes:
  - every §5.4 value;
  - the cap rules;
  - freshness of the generated registry files;
  - a repo-wide guard that no USDC address or spec RPC appears outside `packages/chains`.
- `pnpm build`, `pnpm typecheck` and `pnpm lint` pass locally. `forge build` works; there are no contracts yet (they come in Phase 2).
- **Live registry check** (`pnpm --filter @flying-money/chains check`, read-only): all 8 public chains match. `eth_chainId` equals the registry, and USDC `decimals() = 6`, on Arbitrum One/Sepolia, Base/Sepolia, Monad 143/10143 and Arc 5042/5042002. Arc Testnet answers on both `rpc.testnet.arc.io` (the spec's) and `rpc.testnet.arc.network` (viem's).
- CI hasn't run on GitHub yet: nothing is pushed (push only when asked). The same commands pass locally, except `forge test`, which has no tests until Phase 2.

**Blocked:** nothing.

**Human inputs needed next**
- **H1:** testnet `DEPLOYER_KEY` with Arbitrum Sepolia ETH, for the Phase 2 deploy.
- **H4:** Arbiscan API key (`EXPLORER_API_KEYS`), for verification.
- Soon, for Phase 4 (29 Sep): **H2** (Circle testnet USDC on the demo funder) and **H3** (`PAYEE_ADDRESS`, `REDEEMER_KEY` with gas).
- Optional: a free **Upstash** Redis database (`UPSTASH_REDIS_REST_URL` / `TOKEN`) to run the S4 Redis tests locally. CI covers them without it.

**Next:** Phase 2, the contract. Write the unit tests (§7.4 1–14b) and invariants (I1–I7) first, then §7.2 exactly, MockUSDC, the Deploy script and the gas snapshot.
