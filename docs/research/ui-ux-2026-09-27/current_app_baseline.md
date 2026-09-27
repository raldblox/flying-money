# Current UI/UX baseline of the Flying Money web app (from source code, 27 Sep 2026)

Scope and method: read-only review of `apps/web` (Next.js 16, React 19, Tailwind 4, wagmi 3) plus the MCP tool text in
`packages/mcp/src/server.ts`, the e2e specs in `apps/web/e2e`, the copy deck `docs/copy/copy-deck.md`, BUILD_SPEC §11,
§12 and §21.3, `docs/DECISIONS.md` and the 25 Sep audit. Nothing was run. All sources are repo paths with line numbers
(`path:line`), relative to `C:/Users/raldb/flying-money/`. Line numbers come from `cat -n` on the current working tree
(commit 26455d9 plus the untracked audit file).

---

## Q1. What are the step-by-step flows (issue, hand-over, pay at a shop, till verify + collect, agent request and owner review, fund/approve, wallet backup/restore, expiry/reclaim)?

### Takeaway
Every core flow exists end to end, but each one is a single long page with inline sub-states, not a guided multi-screen
flow. Funding always takes two wallet transactions (ERC-20 approve, then issue). The person-gift path reuses the
agent-oriented wizard, which makes a giver download an "agent .env" file before they can create the budget. The
holder's first receipt asks for a PIN three times. Collecting always needs a browser wallet and gas.

### Cited Findings

**Global shell and entry to the owner app**
- A single wagmi provider wraps the whole site, so the wallet stays connected across pages. It uses only the `injected` browser-wallet connector: no WalletConnect and no mobile wallet deep link — [apps/web/app/layout.tsx:52-59](apps/web/app/layout.tsx), [apps/web/lib/wagmi.ts:21](apps/web/lib/wagmi.ts); decision recorded in [docs/DECISIONS.md:26](docs/DECISIONS.md) (D18).
- `/app` shell nav: Home, Budgets, Requests (with a count badge), Collect, People & agents, Places; plus a "+ Give a budget" button and a Network box that are shown only at `lg` and up — [apps/web/components/account/shell.tsx:12-19](apps/web/components/account/shell.tsx), [shell.tsx:60-63](apps/web/components/account/shell.tsx), [shell.tsx:75](apps/web/components/account/shell.tsx).
- WalletGate: before mount it shows a pulse skeleton. Disconnected, it shows "Connect your wallet" with one Connect button (the first connector only). With no provider the error reads "No browser wallet found. Install MetaMask, Rabby or Coinbase Wallet". On the wrong network an amber alert offers "Switch to {chain}". People and Places work without a wallet — [shell.tsx:101-166](apps/web/components/account/shell.tsx).
- Account Home: a wallet USDC balance (5–6xl display), three figures (In active budgets / Spent from budgets / Ready to take back), four quick actions (Give a budget, Fund an agent, Collect payments, Open a till), "Needs your attention" (requests seen from links plus ended budgets), and "Your budgets" (the first 4 active). It has loading, error and empty states — [apps/web/components/account/home.tsx:13-38](apps/web/components/account/home.tsx), [home.tsx:67-188](apps/web/components/account/home.tsx).

**Flow A: Issue a budget ("Give a budget" / "Fund an agent"), including funding/approve**
- Entry: `/app/give?for=person|agent`. It is the same `IssueWizard` in both cases; `for=person` presets `spenderMode: 'generate'` and `for=agent` presets `'paste'` — [apps/web/components/account/give.tsx:13-43](apps/web/components/account/give.tsx).
- The places list = "Silk Road Oracle (demo)" (if the env var is set) plus places saved on this device for this chain — [give.tsx:18-23](apps/web/components/account/give.tsx).
- Step 1 "Who can be paid?": radio list of places with a "✓ listed" / "⚠ unverified" badge, or "Paste a payee address" (always ⚠ unverified). An unverified choice needs the checkbox "I checked this address twice…" — [apps/web/components/app/issue-wizard.tsx:459-554](apps/web/components/app/issue-wizard.tsx).
- Step 2 "Who can spend?": the subtitle says "A separate spending key: it holds no money, pays no gas, and only signs notes". A toggle offers "Bring an agent address (recommended)" or "Generate a key in this browser" — [issue-wizard.tsx:556-580](apps/web/components/app/issue-wizard.tsx). The Generate path shows the address and then, unless a `holderName` preset exists, "Download the agent .env" plus the checkbox "I saved the key" — [issue-wizard.tsx:604-653](apps/web/components/app/issue-wizard.tsx). "Save the generated key first." blocks submission when there is no holderName — [issue-wizard.tsx:218-219](apps/web/components/app/issue-wizard.tsx).
- Step 3 "Budget and time": Amount (USDC), default "5", with a hint on balance and cap; "Valid for" 1 day / 7 days (default) / 30 days; "The unspent remainder returns to you after expiry. No early cancel." — [issue-wizard.tsx:131-134](apps/web/components/app/issue-wizard.tsx), [issue-wizard.tsx:660-707](apps/web/components/app/issue-wizard.tsx).
- Review block: the sentence "Give {short spender} {amount} USDC at {place} for {duration}". For an unverified payee a RiskBanner stays in view. A plain bulleted "problems" list explains why the button is disabled — [issue-wizard.tsx:709-744](apps/web/components/app/issue-wizard.tsx).
- Two-button funding: "1 · Approve {x} USDC" (ERC-20 approve) appears while the allowance is below the amount; after that comes "Create the budget" (or "Fund the budget" in request mode). The code skips a second approve when the allowance already covers the amount, and trusts the receipt's Approval event over a lagging RPC — [issue-wizard.tsx:226-231](apps/web/components/app/issue-wizard.tsx), [issue-wizard.tsx:245-284](apps/web/components/app/issue-wizard.tsx), [issue-wizard.tsx:745-765](apps/web/components/app/issue-wizard.tsx).
- Transaction status line: Preparing… → Confirm in your wallet… → Submitted → Confirming on-chain… → Confirmed / Failed, with a tx-hash explorer link. Once a hash exists, the only retry is "Check status" — [apps/web/components/app/tx.tsx:17-25](apps/web/components/app/tx.tsx), [tx.tsx:77-122](apps/web/components/app/tx.tsx). A sent issue is kept in sessionStorage so a reload can still finish it, and the button can't send twice — [issue-wizard.tsx:54-82](apps/web/components/app/issue-wizard.tsx), [issue-wizard.tsx:235-239](apps/web/components/app/issue-wizard.tsx).
- Success (non-request): an animated seal, "Budget created.", the full 66-char budget id in mono. Unless holderName is set, it also shows "Add it to your agent's config:" and `certificates: ['0x…']`, "Download the agent .env again", the HandOverLink block (if a key was generated), and the links Open the budget page / Issue transaction ↗ / Create another — [issue-wizard.tsx:367-432](apps/web/components/app/issue-wizard.tsx).
- Wallet errors are mapped to plain words: rejected, wrong network, "doesn't have enough ETH for gas", nonce, allowance not yet visible, not enough USDC, refused without a reason — [apps/web/lib/tx-errors.ts:29-46](apps/web/lib/tx-errors.ts).

**Flow B: Hand-over (giver → holder)**
- After issuing with a generated key, the "Give it to someone" block has a name field ("What should it be called in their wallet?", placeholder "Lantern Café"), then "Show the hand-over link and QR", then a QR, a read-only textarea with the link, and "Copy link". The link is `/wallet#add=<base64url{v,chain,id,key,name}>` (the key sits in the URL fragment) — [apps/web/components/app/hand-over.tsx:23-76](apps/web/components/app/hand-over.tsx), [apps/web/lib/wallet.ts:160-163](apps/web/lib/wallet.ts).
- `/gift#add=…` forwards to `/wallet#add=…`. Without a fragment it says "This link has no budget in it…" — [apps/web/app/gift/forward.tsx:4-18](apps/web/app/gift/forward.tsx), [apps/web/app/gift/page.tsx:6-14](apps/web/app/gift/page.tsx).
- A holder page `/app/people/[id]` offers "Give a budget", which opens the wizard with `holderName` preset. The generated key is then not downloaded; the success screen says "Now give it to {name}: send the hand-over link below privately." — [apps/web/app/app/people/[id]/holder-client.tsx:94-103](apps/web/app/app/people/[id]/holder-client.tsx), [issue-wizard.tsx:375-378](apps/web/components/app/issue-wizard.tsx), [issue-wizard.tsx:626-630](apps/web/components/app/issue-wizard.tsx).

**Flow C: Holder receives a budget and pays at a shop (`/wallet`)**
- On open, the wallet takes a cross-tab lock. If the lock is taken: "Your wallet is already open in another tab." — [apps/web/app/wallet/wallet-client.tsx:66-85](apps/web/app/wallet/wallet-client.tsx), [wallet-client.tsx:97-102](apps/web/app/wallet/wallet-client.tsx).
- First visit via a hand-over link: "Set up your wallet". The intro reads "Someone gave you a budget. First, choose a PIN…" and asks for a 6–12 digit PIN twice ("Nobody can reset it for you, so write it down") — [wallet-client.tsx:103-109](apps/web/app/wallet/wallet-client.tsx), [wallet-client.tsx:211-241](apps/web/app/wallet/wallet-client.tsx).
- Then comes the "A budget for you" panel: warning text, a "Name it (e.g. the shop)" field, "Your PIN" (a third PIN entry), and "Add to my wallet". The button label becomes "Checking on the blockchain…" and adding needs a connection — [wallet-client.tsx:671-722](apps/web/app/wallet/wallet-client.tsx), [apps/web/lib/wallet.ts:97-107](apps/web/lib/wallet.ts) (the AddError texts).
- Wallet home: H1 "Your budgets", with Pay (disabled when there are no budgets) and Add. A card per budget shows the label, chain name, "{left} USDC left · on this phone", "of {face} · valid until {UTC date}", "collected by the shop so far" (online only) and "Only valid at 0x…" — [wallet-client.tsx:277-357](apps/web/app/wallet/wallet-client.tsx).
- Pay: Pay → panel "Scan the price code at the till" (QrScanner: "Open camera", or paste "fm1.…") → "Pay with which budget?" (only when several fit) → Review "Pay {price} USDC to {label}" / "{after} USDC left after this" / "Your PIN" / "Approve and show my code" ("Sealing…") → a full-screen light overlay "Show this to the cashier" with QR, "Copy the code instead", "Did the shop accept it?", "Yes, accepted" / "No, it wasn't accepted" (confirms before cancelling) / "Close (keep it open for later)". The screen is kept awake with wakeLock — [wallet-client.tsx:128-167](apps/web/app/wallet/wallet-client.tsx), [wallet-client.tsx:464-668](apps/web/app/wallet/wallet-client.tsx). An open payment blocks new ones and shows a seal-bordered alert "Show the code again" on home — [wallet-client.tsx:308-318](apps/web/app/wallet/wallet-client.tsx). Background: [docs/DECISIONS.md:28](docs/DECISIONS.md) (D20, no receipt channel from till to phone).
- Error copy on pay: "Wrong PIN.", "Not enough left on this budget.", "You have an open payment on this budget. Settle it first.", "This budget can't pay here (another shop, or it expires too soon)." — [wallet-client.tsx:526-551](apps/web/app/wallet/wallet-client.tsx).
- Add a budget manually (the "Add" button): one PIN field "needed for either option", then either "From a link someone sent you" (paste) or "A budget you fund yourself": make a spending key → "In the Counting House, issue a budget… paste this key's address" → paste the certificate id → Network select → name → "Add the budget" — [wallet-client.tsx:724-884](apps/web/app/wallet/wallet-client.tsx).

**Flow D: Shop till (verify + collect)**
- `/shop` "Open a till." form: Shop name (prefilled "Lantern Café"), Network ("(test money)"/"(real money)"), "Your shop's address (where collected money goes)" (paste, or Connect wallet to autofill), then "Open the till →" and "Shop page and counter QR". Nothing is stored server-side; the name travels in the URL — [apps/web/app/shop/page.tsx:13-30](apps/web/app/shop/page.tsx), [apps/web/app/shop/open-shop.tsx:16-106](apps/web/app/shop/open-shop.tsx).
- The shop public page `/shop/[chain]/[payee]?name=` has a printable QR, "The name comes from the link and isn't verified. The address below is.", "Open my wallet", and "I run this shop: open the till" — [apps/web/app/shop/[chain]/[payee]/page.tsx:29-63](apps/web/app/shop/[chain]/[payee]/page.tsx).
- Till `/shop/.../pos` (one tab per device, lock): the header shows the shop name, "Paid to 0x… on {chain}", and tabs Sell / Today's ledger / Settings — [apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx:37-115](apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx).
- Sell: "Tap an item" (price list; default "Tea 3.50 / Dumplings 6.00 / Mooncake 2.25") or "Or type an amount" with an on-screen keypad → "Charge {x} USDC" → two panes: "Step 1 · the customer scans this" (price QR plus "Cancel order") and "Step 2 · scan the customer's payment code" (camera or paste) → ResultCard — [pos-client.tsx:118-267](apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx), [apps/web/lib/till.ts:20-22](apps/web/lib/till.ts).
- ResultCard states: GUARANTEED → animated seal, "Accepted {price}", "Customer has {x} left", "Guaranteed: backed by money set aside for your shop. Collect before {date}". UNVERIFIED → amber "Unverified · merchant risk", "{price} not guaranteed", float left. REJECTED → one of 12 plain reasons, plus "Scan again" / "Cancel order" — [pos-client.tsx:18-32](apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx), [pos-client.tsx:269-322](apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx).
- Ledger: "To collect: {total} USDC", WalletButton, and "Collect {total} USDC", which is one `redeemMany` transaction and is disabled offline with "Collecting needs a connection". There is a table "Budgets at this till" (Budget / Accepted by you / Collected / To collect) and an "Unverified (accepted offline)" list with "Check now" — [pos-client.tsx:325-505](apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx).
- Settings: shop name, First-visit limit (default 5 USDC), Offline float (default 20 USDC), price list textarea, "primary till" checkbox. Save reloads the page — [pos-client.tsx:508-613](apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx), [apps/web/lib/till.ts:20-21](apps/web/lib/till.ts).
- The payee alternative without a till is `/app/collect`: a RedeemCard per budget with a textarea "Latest payment slip (fm1…)", in-browser validation messages, and a "Redeem" button — [apps/web/components/account/collect.tsx:6-19](apps/web/components/account/collect.tsx), [apps/web/components/app/certificate-lists.tsx:161-261](apps/web/components/app/certificate-lists.tsx).

**Flow E: Agent requests a budget, owner reviews (Requests/inbox)**
- Agent side (MCP): the tools are `fm_status`, `fm_explain`, `fm_quote`, `fm_paid_fetch`, `fm_request_budget` (url, amount, days, reason ≤ 280) and `fm_request_status`. The request goes to the owner's inbox if a grant exists; otherwise the tool returns a link — [packages/mcp/src/server.ts:72-83](packages/mcp/src/server.ts), [server.ts:86-113](packages/mcp/src/server.ts), [server.ts:280-330](packages/mcp/src/server.ts).
- Owner grant: on `/app/people/[id]` for an agent, "Let {name} ask you for budgets": "Most per request (USDC)" (default 1.00), For 7/30/90 days, "Allow requests" (a free signature). The result shows once: `FM_OWNER=…` / `FM_OWNER_GRANT=…` plus Copy. Grants are listed with Revoke — [apps/web/components/account/allow-requests.tsx:18-185](apps/web/components/account/allow-requests.tsx).
- Inbox `/app/requests`: first "Open your inbox", then "Sign in with wallet" ("It's a signature, not a transaction: free, and it moves nothing"). After that come "Waiting for you (n)", "Answered", and "Opened from links" (local), each row with a status pill (Waiting for you / Funded / Declined / Expired). The empty state points to People & agents → Allow requests — [apps/web/components/account/requests.tsx:31-174](apps/web/components/account/requests.tsx).
- Review `/app/requests/new#fm1…` or `?inbox=<id>`: the H1 is "Your agent is asking." The article reads "{agent} asks for {x} USDC to pay {place}, for N days", with three facts (Who asks ✓ signed / Who can be paid, verified badge or ⚠ / How much, how long), an unverified dashed block "Written by the agent, not verified", "If you approve" bullets, and then Decline / "Approve and fund…" — [apps/web/app/app/requests/new/page.tsx:15-29](apps/web/app/app/requests/new/page.tsx), [apps/web/app/app/requests/new/request-review.tsx:233-366](apps/web/app/app/requests/new/request-review.tsx).
- Risk tiers: a red "Check before you pay" banner (unknown agent AND unknown service) requires a vouch checkbox. Amber banners cover an unknown agent key or an unknown/unverified service. The banner stays above the Fund form — [request-review.tsx:139-160](apps/web/app/app/requests/new/request-review.tsx), [request-review.tsx:305-317](apps/web/app/app/requests/new/request-review.tsx), [docs/DECISIONS.md:46](docs/DECISIONS.md) (D37); e2e: [apps/web/e2e/request-warnings.spec.ts:8-40](apps/web/e2e/request-warnings.spec.ts).
- "Approve and fund…" opens the same IssueWizard in locked mode: payee and spender are fixed, the amount can be lowered, and the duration can't go below what was asked. Success reads "Approved. The budget is locked." with "Watch the budget". Wrong wallet: "This request is addressed to {owner}…switch accounts". Expired (>7 days): an amber notice. Top-up requests are not supported ("can't be approved from this page yet") — [request-review.tsx:119-133](apps/web/app/app/requests/new/request-review.tsx), [request-review.tsx:187-221](apps/web/app/app/requests/new/request-review.tsx), [request-review.tsx:299-351](apps/web/app/app/requests/new/request-review.tsx), [issue-wizard.tsx:338-365](apps/web/components/app/issue-wizard.tsx), [issue-wizard.tsx:441-458](apps/web/components/app/issue-wizard.tsx). The e2e flow is in [apps/web/e2e/inbox.spec.ts:67-95](apps/web/e2e/inbox.spec.ts).

**Flow F: Wallet backup/restore (holder) and contacts backup (owner)**
- Holder wallet: a collapsed `<details>` "Backup and restore" at the bottom of the wallet home. It takes a passphrase (12+ characters) and "Export backup" (a JSON download). "Restore a backup" appears only when the wallet is empty. After a restore: "Restored. Use the PIN you had when you made the backup." — [wallet-client.tsx:386-461](apps/web/app/wallet/wallet-client.tsx). The restore writes the old `pin-check` over the new one and refuses a non-empty wallet — [apps/web/lib/wallet.ts:188-203](apps/web/lib/wallet.ts).
- An install nudge sits below the backup: "Add this wallet to your home screen. Browsers can clear data… (Safari after about a week…)", with an Install button or iPhone instructions — [wallet-client.tsx:359-384](apps/web/app/wallet/wallet-client.tsx).
- Owner contacts: `<details>` "Move contacts to another device" with a passphrase of 8+ characters and Export/Import — [apps/web/app/app/people/people-client.tsx:81-152](apps/web/app/app/people/people-client.tsx).

**Flow G: Expiry, reclaim, top up, extend, renew**
- Budget states: Active / Ending soon (< 2 days) / "Ended · take back" / Closed — [apps/web/components/account/budget-row.tsx:10-24](apps/web/components/account/budget-row.tsx). Ended budgets appear in Home "Needs your attention" — [home.tsx:118-145](apps/web/components/account/home.tsx).
- A row's disclosure button reads "Top up or extend…" or, after the end date, "Take back {x} USDC…" → FunderActions. Reclaim is one button, "Take back {x} USDC". Top up takes an amount and may need "1 · Approve" first. Extend offers +1/+7/+30 days, with the 365-day max enforced — [budget-row.tsx:137-160](apps/web/components/account/budget-row.tsx), [apps/web/components/app/funder-actions.tsx:83-232](apps/web/components/app/funder-actions.tsx).
- Renew is only on the holder page: "Renew (same place, amount and length)". An amber "Ends {rel}. Renew?" nudge shows under 3 days — [holder-client.tsx:219-246](apps/web/app/app/people/[id]/holder-client.tsx).
- On the public certificate page `/c/[chain]/[id]`: Terms (funder, payee, spender, token, face value, not collected yet, expiry, id), a Tally, the Timeline (Funded / Topped up / Extended / Collected / Leftovers taken back), "Verify it yourself" (a `cast call` snippet), and a Live auto-refresh every 15 s while open — [apps/web/app/c/[chain]/[id]/page.tsx:50-186](apps/web/app/c/[chain]/[id]/page.tsx), [apps/web/components/auto-refresh.tsx:6-23](apps/web/components/auto-refresh.tsx).

### Inferences
- The flows are complete and defensive about the chain: no double-send, a receipt-trusted allowance, a till lock, a wallet lock. The weak points are orientation (where am I, what's next) and audience fit, not missing capability.
- Because approve plus issue are two wallet popups labelled "1 · Approve" and then a differently named second button, a first-time funder never sees the whole two-step path up front (there is no "2 ·" label).
- The person-gift path from Home (`/app/give?for=person`) looks broken for non-developers: it forces the ".env download + I saved the key" gate and then shows an agent config snippet on success (see Q6).

### Gaps
- Actual rendered layout, focus order and timing were not observed. The dev server was not run, per the constraints.
- `apps/web/app/how-it-works/lifecycle.tsx`, `components/art/*` and `components/guarantees/*` were only skimmed. Their narrative content is not mapped screen by screen.
- The docs Markdown in `docs/site/*.md` (the `/docs/agents` quickstart etc.) was not read, so the developer quickstart steps are not documented here.

---

## Q2. What design system exists (tokens, Tailwind config, fonts, colours, dark mode, motion), and where does it live?

### Takeaway
One CSS file (`apps/web/app/globals.css`, Tailwind v4 `@theme inline`) implements the spec's "Paper, Ink, Seal" system:
9 spec colour tokens plus amber and derived desk/grain tokens, 4 Google fonts, SVG paper texture with deckled edges,
automatic light/dark mode with no manual toggle, and about 20 keyframe animations gated by `prefers-reduced-motion`.
Components are ad hoc Tailwind class strings. Only buttons and sheets are shared primitives. There is no
`tailwind.config`, component library or Storybook.

### Cited Findings
- Spec source: BUILD_SPEC §11 "Paper, Ink, Seal". Principles: heritage not costume; functional clarity; "Every seal means something" (the seal only appears when something is signed or verified) — [docs/BUILD_SPEC.md:1404-1444](docs/BUILD_SPEC.md).
- Tokens: `--paper #f4ede0`, `--paper-2 #eae0cd`, `--ink #1b1a17`, `--ink-2 #4a463f`, `--seal #b7322c`, `--ochre #c08a3e` ("decorative only: < 4.5:1 on paper"), `--indigo #2e3f5c` (links, on-chain), `--celadon #7fa38f` ("fills, not text"), `--line #cdbfa6`, `--seal-button` fixed to the light seal in both themes, `--on-seal #fff8ec`, and `--amber #8a5a12` (UNVERIFIED / merchant risk) — [apps/web/app/globals.css:3-19](apps/web/app/globals.css).
- Dark mode: automatic via `prefers-color-scheme`, with a `[data-theme]` override in CSS — [globals.css:20-47](apps/web/app/globals.css). No code sets `data-theme` (a grep of app, components and lib found none), so users can't choose a theme.
- Tailwind v4 mapping: `@theme inline` exposes `color-paper/ink/seal/...` and the font families display = Cormorant Garamond, sans = Inter, mono = JetBrains Mono, han = Noto Serif TC — [globals.css:49-67](apps/web/app/globals.css); fonts are loaded in [apps/web/app/layout.tsx:10-19](apps/web/app/layout.tsx). PostCSS is only `@tailwindcss/postcss` — [apps/web/postcss.config.mjs:1](apps/web/postcss.config.mjs).
- Paper system: `--desk` background, SVG `--grain` and `--fibres` noise, a `.sheet` with an SVG `#deckle` torn-edge filter and drop shadow, `.smallcaps`, `.ink-rule` hand-inked divider, `.chapter-mark` (formal Chinese numerals 壹貳參… in a seal frame) — [globals.css:69-208](apps/web/app/globals.css), [apps/web/components/section.tsx:4-5](apps/web/components/section.tsx).
- Shared primitives: `Chapter` (eyebrow "Chapter n · …" plus a display h2), `Section`, `Sheet` (optional tilt), and `ButtonLink`/`buttonClass` with only two variants (primary seal and secondary outline), min-h-12, indigo focus outline — [section.tsx:7-127](apps/web/components/section.tsx). Other semantic components: `StatusChip` (open/expired/closed/sealed/accepted/redeemed/unverified/failed), `Seal` (BrandMark with stamp animation), `Tally` (progressbar), `RiskBanner` (caution/danger), `QrCode` (fixed dark-on-light) — [apps/web/components/status-chip.tsx:3-26](apps/web/components/status-chip.tsx), [apps/web/components/seal.tsx:7-20](apps/web/components/seal.tsx), [apps/web/components/tally.tsx:4-25](apps/web/components/tally.tsx), [apps/web/components/app/risk-banner.tsx:7-37](apps/web/components/app/risk-banner.tsx), [apps/web/components/qr.tsx:3-26](apps/web/components/qr.tsx).
- Motion: the seal stamp is 180 ms, the tally join 400 ms, plus page fade-in (`template.tsx`), scroll-driven `.reveal`, the hero card tilt/sheen, slip-fly, demo flights, scan-line and pin-dot. All sit inside `@media (prefers-reduced-motion: no-preference)` — [globals.css:221-280](apps/web/app/globals.css), [globals.css:491-545](apps/web/app/globals.css), [apps/web/app/template.tsx:3-5](apps/web/app/template.tsx). JS art also checks `matchMedia('(prefers-reduced-motion: reduce)')` — [apps/web/components/art/live-tally.tsx:38](apps/web/components/art/live-tally.tsx), [apps/web/components/art/money-flow.tsx:327-330](apps/web/components/art/money-flow.tsx).
- Illustration set: ink icons, ink mountains, silk-road map, live tally, money-flow, counter scene — `apps/web/components/art/*` (file list from `git ls-files`).
- PWA: manifest with standalone display, theme `#b7322c`, and shortcuts Wallet and Open a till; the service worker is registered only on /wallet, /shop and /pos via `OfflineReady` — [apps/web/app/manifest.ts:4-21](apps/web/app/manifest.ts), [apps/web/components/offline-ready.tsx:43-62](apps/web/components/offline-ready.tsx).
- Spec vocabulary table (UI ↔ code), e.g. "Counting House | dashboard | /app" and the status sequence "Sealed → Accepted by seller (GUARANTEED) → Redeemed on-chain" — [docs/BUILD_SPEC.md:1446-1461](docs/BUILD_SPEC.md). The copy deck later replaced several of these terms (see Q6).

### Inferences
- The visual identity is strong and distinctive (paper, deckle, seal, Cormorant). The app screens (account, till, wallet) use it less: mostly `rounded-md border border-line bg-paper` rows and utility classes, with shapes that vary per file (radius values 3px/4px/md/full appear side by side).
- Button styles are not fully centralised. Many secondary actions are hand-rolled (`min-h-11 rounded border border-ink/30 px-4` in hand-over.tsx:52 and :71; `min-h-10 rounded border` in funder-actions.tsx:143), so hover and focus treatment differs from `buttonClass`.

### Gaps
- `public/brand/*` and the brand docs in `docs/brand/` were not read. Logo and brand guidelines are not covered.
- Contrast ratios were not measured. Only the code comments on ochre and celadon are cited.

---

## Q3. How many steps, decisions and technical terms does each flow expose to a non-crypto person?

### Takeaway
The holder and till flows are nearly free of crypto vocabulary at the moment of paying, but they still show raw
`0x…` addresses, "USDC", chain names and "blockchain". The giver and owner flows expose the full stack: payee
address, spending key, gas, signing, approve, network switching, transaction hashes, a 66-char budget id and an
`.env` file. The spec's own rule ("On-chain, EIP-712, ECDSA, gas → plain words in UI") is not met on the account
screens.

### Cited Findings
Counts below are derived from the code paths cited in Q1: user actions = clicks, fields and wallet prompts on the
happy path.

| Flow | Happy-path actions (approx.) | Decisions the user must make | Technical terms on screen |
|---|---|---|---|
| Give a budget to a person (from Home) | Connect wallet (1 popup) → pick/paste place (+ tick "checked twice" if unverified) → Generate key → Download agent .env → tick "I saved the key" → amount → duration → "1 · Approve" (wallet popup) → "Create the budget" (wallet popup) → name → "Show the hand-over link" → Copy/QR → send out of band ≈ 12–14 actions, 3 wallet prompts | place, spender mode (paste vs generate), amount, duration, name | "Payee address", "0x…", "spending key", "pays no gas", "signs notes", "agent .env", "Approve … USDC", "Switch wallet to Arbitrum Sepolia", "Confirming on-chain", tx hash, budget id — [issue-wizard.tsx:499](apps/web/components/app/issue-wizard.tsx), [:561](apps/web/components/app/issue-wizard.tsx), [:566-567](apps/web/components/app/issue-wizard.tsx), [:641](apps/web/components/app/issue-wizard.tsx), [:753](apps/web/components/app/issue-wizard.tsx), [:374](apps/web/components/app/issue-wizard.tsx), [tx.tsx:17-25](apps/web/components/app/tx.tsx) |
| Fund an agent | Same as above, but paste the agent address (from `npx @flying-money/client keygen`) instead of generating ≈ 9–10 actions, 3 wallet prompts | same | same, plus `certificates: ['0x…']` config snippet — [issue-wizard.tsx:381-384](apps/web/components/app/issue-wizard.tsx), [people-client.tsx:259-263](apps/web/app/app/people/people-client.tsx) |
| Holder: first receipt | open link → PIN → repeat PIN → Create my wallet → name → PIN again → Add to my wallet ≈ 7 actions, 3 PIN entries | PIN, name | "certificate's spending key", "Checking on the blockchain…" — [wallet-client.tsx:211-241](apps/web/app/wallet/wallet-client.tsx), [:695-719](apps/web/app/wallet/wallet-client.tsx) |
| Holder: pay | Pay → Open camera → scan → (choose budget) → PIN → "Approve and show my code" → show QR → "Yes, accepted" ≈ 6–7 actions | which budget (if several), accepted or not | "USDC", "Only valid at 0x…", chain name, "Sealing…" — [wallet-client.tsx:340-346](apps/web/app/wallet/wallet-client.tsx), [:573](apps/web/app/wallet/wallet-client.tsx) |
| Shop: open till | name → network → address (paste or Connect wallet) → Open the till ≈ 4 actions | network, address | "Network", "address", "0x…", "(test money)" — [open-shop.tsx:34-99](apps/web/app/shop/open-shop.tsx) |
| Shop: sell | tap item / type amount → Charge → (customer scans) → Open camera → scan → Next customer ≈ 4 actions | none on the happy path | "USDC", "payment code"; offline: "Unverified · merchant risk", "offline float" — [pos-client.tsx:145-322](apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx) |
| Shop: collect | Today's ledger → Connect wallet → Switch network → Collect (wallet popup; needs ETH for gas) ≈ 3–4 actions | when to collect | "To collect", budget ids `0x…`, tx hash — [pos-client.tsx:399-460](apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx), [tx-errors.ts:36](apps/web/lib/tx-errors.ts) |
| Payee collect without a till | paste "fm1…" slip → Redeem (wallet popup) | none | "payment slip (fm1…)", "signature", "spender", "face value", "Redeem" — [certificate-lists.tsx:171-257](apps/web/components/app/certificate-lists.tsx) |
| Owner: review agent request | open link/inbox (sign in = signature) → (tick vouch) → Approve and fund… → optional amount/duration → Approve USDC → Fund the budget ≈ 5–7 actions, 2–3 wallet prompts | approve/decline, amount, duration | "signature, not a transaction", "Signed by this key", addresses, chain name — [requests.tsx:74](apps/web/components/account/requests.tsx), [request-review.tsx:248-267](apps/web/app/app/requests/new/request-review.tsx) |
| Owner: allow agent requests | amount/request → days → Allow (signature) → copy 2 env lines into agent config | cap, days | `FM_OWNER`, `FM_OWNER_GRANT`, "config" — [allow-requests.tsx:93-151](apps/web/components/account/allow-requests.tsx) |
| Reclaim | open row → "Take back X USDC…" → button → wallet popup ≈ 3 actions | none | tx status; "Expired {UTC date}" — [funder-actions.tsx:83-101](apps/web/components/app/funder-actions.tsx) |

- The copy deck rule says: "On-chain, EIP-712, ECDSA, gas | Plain words in UI; technical terms only in /docs | 'Recorded on the blockchain', 'signature', 'network fee'" — [docs/copy/copy-deck.md:205](docs/copy/copy-deck.md) (row in section 8). The issue wizard still says "pays no gas" — [issue-wizard.tsx:561](apps/web/components/app/issue-wizard.tsx) — and the error mapper says "enough ETH for gas" — [tx-errors.ts:36](apps/web/lib/tx-errors.ts).
- The account area never explains how to get test USDC or ETH. Faucet links exist only on `/chains/[chain]` ("Test money") — [apps/web/app/chains/[chain]/page.tsx:90-100](apps/web/app/chains/[chain]/page.tsx). The spec asked for the testnet banner to link the gas faucet and Circle's USDC faucet — [docs/BUILD_SPEC.md:1470](docs/BUILD_SPEC.md) (§12.1 bullet 4).
- The hand-over and holder screens promise "No crypto wallet or fees for them" — [hand-over.tsx:34-35](apps/web/components/app/hand-over.tsx), [shop/[chain]/[payee]/page.tsx:41-42](apps/web/app/shop/[chain]/[payee]/page.tsx).

### Inferences
- For a parent or employer, the giver side is the bottleneck: it needs a desktop browser wallet holding both USDC and ETH on Arbitrum Sepolia, plus fluency with approve/issue. The holder side is close to a consumer app.
- The raw payee address on every wallet card ("Only valid at 0x…") is the one remaining crypto artefact in the holder's steady state. The hand-over name could replace it.

### Gaps
- Real time-on-task and the wallet extension's own popups (MetaMask screens, gas prompts) are outside the codebase and not captured.

---

## Q4. What does the landing page communicate in the first screen, and how does it route different audiences?

### Takeaway
The first screen is a two-door hero ("For AI agents" is the default; "For families & shops" is the other door). It
swaps the headline, body, CTAs and a live animated budget card, and the choice is remembered in localStorage. The
brand tagline is only in a screen-reader h1. The agent door routes to the demo and docs. The people door routes to the
café explainer and the till, not to giving. Holders and existing users have no direct wallet entry in the desktop
header.

### Cited Findings
- The eyebrow reads "飛錢 Flying Money · open source · test network". The real `<h1>` "Hand over a budget, not your wallet." is `sr-only`; the visible headline is a `<p>` styled as H1. Agents: "Let your AI agent pay for what it uses. Never more than you allow." People: "Lunch money that only works at the canteen." — [apps/web/components/hero.tsx:14-32](apps/web/components/hero.tsx).
- Door toggle: a `fieldset` with `aria-pressed` buttons, legend "Who is spending?", default 'agents', persisted as `fm-door` in localStorage. `DoorStack` keeps both variants in one grid cell (inactive = `invisible` + `aria-hidden`) so the layout doesn't shift — [apps/web/components/door.tsx:9-87](apps/web/components/door.tsx). The copy deck specified default door "For AI agents" and remembering the choice — [docs/copy/copy-deck.md:106-107](docs/copy/copy-deck.md).
- Agent-door body text mentions "digital dollars (USDC)", per-request pay and collection in one transaction. CTAs: "Watch an agent pay →" (/demo) and "Add it to your agent" (/docs/agents) — [hero.tsx:36-49](apps/web/components/hero.tsx).
- People-door body: "Your kid, employee or friend pays by showing a QR code… They don't need a crypto wallet and never pay a fee." CTAs: "See how a café uses it →" (/shops) and "Open a till for your shop" (/shop) — [hero.tsx:51-65](apps/web/components/hero.tsx).
- The status line under the CTAs, "Live on Arbitrum Sepolia with test money · Open source (MIT) · Not yet audited · See networks →", is hard-coded text — [hero.tsx:67-75](apps/web/components/hero.tsx). The 25 Sep audit flagged a hard-coded chain in the mode banner — [docs/AUDIT_2026-09-25.md:86](docs/AUDIT_2026-09-25.md).
- Hero card: `LiveTally` shows 500 cents "Silk Road Oracle" / "Research agent" (agents) or 2000 "Lantern Café" / "Mia" (people), with the caption "A controlled budget for … One service/café, your limit." — [hero.tsx:83-135](apps/web/components/hero.tsx).
- Below the fold, chapters 1–6: Problem (strikethrough list per door), How it works (4 steps, auto-advancing StepExplorer), Trust ("Protected / Not protected"), Use cases (6 cards), For developers (CodeTabs: Pay/Charge/MCP), Story (804 CE, Silk Road map). The closing CTA reads "Watch an agent make 20 paid calls and settle them in 3 transactions." with Run the live demo / Read the docs — [apps/web/app/page.tsx:199-345](apps/web/app/page.tsx).
- Header nav (desktop): Agents (/docs/agents), Shops (/shops), Docs, Guarantees, the Account button (shows the short address when connected), and "Try the demo". The mobile menu adds Demo, Account, Wallet — [apps/web/components/site-header.tsx:9-14](apps/web/components/site-header.tsx), [site-header.tsx:48-81](apps/web/components/site-header.tsx), [apps/web/components/account-button.tsx:9-35](apps/web/components/account-button.tsx). `/wallet` is otherwise reachable from the footer only — [apps/web/components/site-footer.tsx:36-45](apps/web/components/site-footer.tsx).
- `/shops` (the families & shops page) routes givers to `/app` (the account home, behind WalletGate), not `/app/give`. It also offers "Open a till" and "Open my wallet" — [apps/web/app/shops/page.tsx:69-74](apps/web/app/shops/page.tsx), [shops/page.tsx:130-139](apps/web/app/shops/page.tsx).
- `/demo`: a looping labelled illustration ("Illustration · not a live run") until "Now run it for real". Toggles: "Cut the network" and "Steal the agent key". The live run uses a 0.30 USDC budget and 20 calls, and afterwards offers "See this budget on the blockchain" / "Give your own agent a budget" (→ /docs/agents) — [apps/web/app/demo/demo-client.tsx:183-274](apps/web/app/demo/demo-client.tsx), [apps/web/components/demo/demo-stage.tsx:44-50](apps/web/components/demo/demo-stage.tsx).

### Inferences
- Audience routing, per the code:
  - Agent developer: hero → /demo or /docs/agents.
  - Seller/API owner: the "Charge (API)" code tab or "Seller quickstart" (/docs/server), only in chapter 5 [page.tsx:282-299](apps/web/app/page.tsx).
  - Shop: hero people door → /shop.
  - Giver/parent: people door → /shops → /app. There is no direct "Give a budget" CTA on the landing page.
  - Holder: a link from the giver, or the footer/mobile menu → /wallet.
  - First-time visitor: the demo in the header.
  - Investor: /pitch, in the footer only.
- Hiding the tagline in `sr-only` means sighted visitors never see the positioning line that every other surface (page title, footer, manifest) uses.

### Gaps
- It is not known which door real visitors choose, or whether they notice the toggle. There is no analytics code in the app (none found in the files reviewed).

---

## Q5. What risk and testnet disclosures exist, and where?

### Takeaway
Disclosures appear on most surfaces (header badge, hero, footer, trust section, demo, till, certificate page) and are
worded consistently ("test money", "not audited"). The account area shows its notice only on desktop, and the holder
wallet has no testnet or "not audited" notice at all. Risk warnings at money-commit moments (unverified payee, unknown
agent, offline merchant risk, generated key) are strong and specific.

### Cited Findings
- Header badge "Testnet"/"Mainnet" (amber or seal border) with a hover `title` of "Testnet · test money · unaudited · {chains}" — [site-header.tsx:37-42](apps/web/components/site-header.tsx), [apps/web/lib/site.ts:9-11](apps/web/lib/site.ts).
- Hero eyebrow "open source · test network" and the line "Live on Arbitrum Sepolia with test money · Open source (MIT) · Not yet audited" — [hero.tsx:16](apps/web/components/hero.tsx), [hero.tsx:67-75](apps/web/components/hero.tsx).
- Landing Trust chapter: "Not protected: … That the USDC issuer never freezes funds. That the code is free of bugs. It is test software and has not been audited." plus "Why there's no cancel button" — [page.tsx:239-257](apps/web/app/page.tsx).
- Footer colophon: "Test network · open source (MIT) · not yet audited." — [site-footer.tsx:13-16](apps/web/components/site-footer.tsx).
- Account area: the NetworkNote reads "Test money only. Not audited." inside a box with the classes `hidden … lg:block` (desktop only) — [shell.tsx:72-97](apps/web/components/account/shell.tsx).
- Certificate page: "{chain} · Testnet · test money · unaudited" — [apps/web/app/c/[chain]/[id]/page.tsx:52-54](apps/web/app/c/[chain]/[id]/page.tsx).
- Demo: the eyebrow "Live demo · Testnet · test money · unaudited" and "with test money: a real 0.30 USDC budget…" — [apps/web/app/demo/page.tsx:21](apps/web/app/demo/page.tsx), [demo-client.tsx:246](apps/web/app/demo/demo-client.tsx).
- Till: "The till · {chain} · test money" and the network dropdown "(test money)" / "(real money)" — [apps/web/app/shop/[chain]/[payee]/pos/page.tsx:29-32](apps/web/app/shop/[chain]/[payee]/pos/page.tsx), [open-shop.tsx:57-61](apps/web/app/shop/open-shop.tsx).
- /shops: "Payments are public on the blockchain but not linked to names. Test network, not yet audited." — [shops/page.tsx:140-141](apps/web/app/shops/page.tsx).
- Wallet page: the header shows only "Wallet · on this device" plus the Online/Offline indicator. No test-money or audit notice was found in `wallet/page.tsx` or `wallet-client.tsx` — [apps/web/app/wallet/page.tsx:14-23](apps/web/app/wallet/page.tsx). The 25 Sep audit also noted that the leftover rule and privacy line are missing from the wallet, `/gift` and the hand-over screens — [docs/AUDIT_2026-09-25.md:95](docs/AUDIT_2026-09-25.md).
- Money-commit warnings:
  - Unverified payee RiskBanner: "Scammers swap addresses in messages and web pages…" — [issue-wizard.tsx:719-727](apps/web/components/app/issue-wizard.tsx).
  - Request risk tiers: [request-review.tsx:144-160](apps/web/app/app/requests/new/request-review.tsx).
  - Generated key: "Only for testing or small budgets. The key is shown once…" — [issue-wizard.tsx:606-608](apps/web/components/app/issue-wizard.tsx).
  - Hand-over: "Anyone holding this link can spend the budget, so send it privately" — [hand-over.tsx:33-36](apps/web/components/app/hand-over.tsx).
  - Till UNVERIFIED: "If this payment is bad, you lose it" — [pos-client.tsx:290-303](apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx).
  - People page: "You can't freeze a budget once issued, so keep amounts small and renew instead" — [apps/web/app/app/people/page.tsx:12-15](apps/web/app/app/people/page.tsx).
- The full `/guarantees` page has sections: three claims, "What if…?", per-party guarantees, control, privacy, "What we left out, and why" — [apps/web/app/guarantees/page.tsx:135-256](apps/web/app/guarantees/page.tsx).

### Inferences
- The people most likely to misread test USDC as real money (holders, who arrive from a link and see "USDC left") are the only audience with no test-money line.
- On phones, the account area's only test-money signal is the small header badge, whose explanatory tooltip needs hover and is unavailable on touch.

### Gaps
- Whether a mainnet mode banner renders anywhere in the account area was not checked: `AccountProvider` filters out mainnets entirely, [apps/web/components/account/context.tsx:47](apps/web/components/account/context.tsx).

---

## Q6. Per-audience screen map, and observed friction, inconsistencies, missing states, accessibility and mobile concerns

### Takeaway
Seven audiences map onto about 25 routes. The main problems are:
- vocabulary drift across screens (budget / certificate / slip / code / note; Account / Counting House / Dashboard; Redeem vs Collect);
- the agent-first issue wizard leaking into the person flow;
- implicit success feedback for top up, extend, reclaim and collect;
- no route-level error or loading boundaries;
- ARIA tab patterns without tabpanels;
- an auto-advancing carousel;
- account-area features hidden below the `lg` breakpoint;
- a browser-extension-only wallet that dead-ends on phones.

### Cited Findings

**Screen map per audience (routes → key components)**
- First-time visitor: `/` (Hero, DoorToggle, StepExplorer, CodeTabs), `/how-it-works` (Lifecycle), `/story`, `/guarantees`, `/demo`, `/chains`, `/chains/[chain]` — [page.tsx](apps/web/app/page.tsx), [apps/web/app/how-it-works/page.tsx:11-31](apps/web/app/how-it-works/page.tsx), [apps/web/app/chains/page.tsx:12-95](apps/web/app/chains/page.tsx).
- Owner/funder (giver or agent owner): `/app` Home, `/app/give`, `/app/budgets` (filter tabs Active / Ending soon / Ended / Closed / All), `/app/people`, `/app/people/[id]`, `/app/places` (Scan at the shop / By domain / Paste an address), `/app/requests`, `/app/requests/new`, `/c/[chain]/[id]` — [apps/web/components/account/budgets.tsx:7-71](apps/web/components/account/budgets.tsx), [apps/web/app/app/places/places-client.tsx:23-110](apps/web/app/app/places/places-client.tsx).
- Holder/spender person: `/gift` → `/wallet` (states: loading, busy, no-pin, home, scan, choose, review, show, add, handover) — [wallet-client.tsx:47-55](apps/web/app/wallet/wallet-client.tsx).
- AI agent via MCP: tools `fm_status`, `fm_explain`, `fm_quote`, `fm_paid_fetch`, `fm_request_budget`, `fm_request_status`; `/llms.txt`, `/llms-full.txt`, `/docs/*.md` — [packages/mcp/src/server.ts:72-330](packages/mcp/src/server.ts), [apps/web/app/docs/page.tsx:19-26](apps/web/app/docs/page.tsx).
- Seller/API owner: `/docs/server`, `/app/collect` (paste slip → Redeem), `/.well-known/flying-money.json` (read by Places "By domain") — [places-client.tsx:230-291](apps/web/app/app/places/places-client.tsx).
- Café/shop: `/shop` → `/shop/[chain]/[payee]` (public QR page) and `/shop/[chain]/[payee]/pos` (Sell / Today's ledger / Settings).
- Developer: `/docs` index ("Read the ledger."), 10 docs pages in groups Start / Reference / About, a Markdown twin per page — [apps/web/lib/docs.ts:9-20](apps/web/lib/docs.ts), [apps/web/app/docs/[slug]/page.tsx:18-34](apps/web/app/docs/[slug]/page.tsx).
- Investor: `/pitch` (Problem, Solution, Why now, Market, Business model, Traction, Ask, Team) — [apps/web/app/pitch/page.tsx:43-132](apps/web/app/pitch/page.tsx).

**Friction points**
- F-1. The person gift flow forces the agent path. `/app/give?for=person` sets `spenderMode: 'generate'` with no `holderName`, so the wizard shows "Download the agent .env" and blocks on "Save the generated key first." The success screen then says "Add it to your agent's config:" — [give.tsx:41](apps/web/components/account/give.tsx), [issue-wizard.tsx:218-219](apps/web/components/app/issue-wizard.tsx), [issue-wizard.tsx:631-652](apps/web/components/app/issue-wizard.tsx), [issue-wizard.tsx:375-395](apps/web/components/app/issue-wizard.tsx). Step 2's toggle still reads "Bring an agent address (recommended)" in person mode — [issue-wizard.tsx:566](apps/web/components/app/issue-wizard.tsx). This was flagged earlier as "The issue wizard defaults to the agent path" in [docs/AUDIT_2026-09-25.md:95](docs/AUDIT_2026-09-25.md) and is partly still present.
- F-2. The holder enters the PIN three times on first receipt: set, repeat, then again to add — [wallet-client.tsx:233-234](apps/web/app/wallet/wallet-client.tsx), [wallet-client.tsx:711](apps/web/app/wallet/wallet-client.tsx).
- F-3. Renew on the holder page passes `holderName: placeName(c.payee)`, so the result screen reads "Now give it to {place name}" instead of the person. A one-key holder gets the agent config snippet instead of hand-over guidance — [holder-client.tsx:231-243](apps/web/app/app/people/[id]/holder-client.tsx), [issue-wizard.tsx:375-386](apps/web/components/app/issue-wizard.tsx).
- F-4. Givers need two wallet transactions (approve, then create). The first button is labelled "1 · Approve" but the second is never labelled "2 ·" — [issue-wizard.tsx:746-764](apps/web/components/app/issue-wizard.tsx); the same applies to top-up, [funder-actions.tsx:198](apps/web/components/app/funder-actions.tsx).
- F-5. There is no faucet or funding guidance in the account area. Balance "—" or 0 gives no next step — [home.tsx:72-77](apps/web/components/account/home.tsx); faucets appear only on [chains/[chain]/page.tsx:90-100](apps/web/app/chains/[chain]/page.tsx).
- F-6. The till's Collect is disabled with no reason when the wallet isn't connected, is on another network, or has no gas. Only offline has a message — [pos-client.tsx:414-424](apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx); also noted in [docs/AUDIT_2026-09-25.md:98](docs/AUDIT_2026-09-25.md).
- F-7. Restoring a wallet backup on a new phone first forces setting a new PIN (the no-pin gate). The restore then silently replaces it with the backup's PIN ("Use the PIN you had…") — [wallet-client.tsx:103-109](apps/web/app/wallet/wallet-client.tsx), [wallet-client.tsx:442-445](apps/web/app/wallet/wallet-client.tsx), [lib/wallet.ts:199-202](apps/web/lib/wallet.ts).
- F-8. Top-up requests from agents can't be approved in the request UI — [request-review.tsx:121-133](apps/web/app/app/requests/new/request-review.tsx).
- F-9. Spec features for people are not built: "Ask for more", "Ask your giver" on an insufficient balance, and "Open a tab here" at the till — spec [docs/BUILD_SPEC.md:2033-2040](docs/BUILD_SPEC.md) (§21.3 people-/shop-facing UX), copy [docs/copy/copy-deck.md:148-150](docs/copy/copy-deck.md). A grep of `wallet-client.tsx` for "Ask" found no such controls. The till's `insufficient` reason offers only "Scan again" / "Cancel order" — [pos-client.tsx:305-321](apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx).
- F-10. The amount field in the issue wizard doesn't normalise a decimal comma ("5,50" fails the regex), unlike top-up and the till — [issue-wizard.tsx:186](apps/web/components/app/issue-wizard.tsx), [issue-wizard.tsx:676](apps/web/components/app/issue-wizard.tsx) vs [funder-actions.tsx:189](apps/web/components/app/funder-actions.tsx) and [pos-client.tsx:190](apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx).
- F-11. Contacts (people, places) live only in this browser. On another device a holder page shows "This person isn't on this device" — [holder-client.tsx:52-61](apps/web/app/app/people/[id]/holder-client.tsx).

**Terminology and visual inconsistencies**
- T-1. Budget vs certificate:
  - UI mostly says "budget", but "certificate(s)" remains: "N certificates →" on the People list [people-client.tsx:64](apps/web/app/app/people/people-client.tsx); "None yet. Use 'Give a certificate'." (no such button exists; it is "Give a budget") [holder-client.tsx:191](apps/web/app/app/people/[id]/holder-client.tsx); "A gift certificate" [gift/page.tsx:10](apps/web/app/gift/page.tsx); "This link holds a certificate's spending key" [wallet-client.tsx:696](apps/web/app/wallet/wallet-client.tsx); page title `Certificate 0x…` vs H1 "Budget 0x…" [c/[chain]/[id]/page.tsx:20](apps/web/app/c/[chain]/[id]/page.tsx), [:57](apps/web/app/c/[chain]/[id]/page.tsx); MCP "Flying Money certificates" [server.ts:77](packages/mcp/src/server.ts).
  - The copy deck wanted "Certificate" on people screens and "Budget" on agent screens, never both — [docs/copy/copy-deck.md:63-64](docs/copy/copy-deck.md). The code uses "budget" for both doors.
- T-2. The owner area's name:
  - Nav and header: "Account" [site-header.tsx:78](apps/web/components/site-header.tsx), [app/app/page.tsx:5](apps/web/app/app/page.tsx).
  - Wallet: "Counting House" [wallet-client.tsx:799](apps/web/app/wallet/wallet-client.tsx), [:820](apps/web/app/wallet/wallet-client.tsx). MCP `fm_explain`: "Ask your funder to issue one in the Counting House" [server.ts:104](packages/mcp/src/server.ts).
  - Certificate page: "take it back from their Dashboard" [c/[chain]/[id]/page.tsx:117-118](apps/web/app/c/[chain]/[id]/page.tsx).
  - DECISIONS D31 says nav = "Dashboard", tabs "Give & collect · Holders · Places" — [docs/DECISIONS.md:33](docs/DECISIONS.md). Spec §21.3 says "Give · Holders · Places · Requests · Collect" — [docs/BUILD_SPEC.md:2002](docs/BUILD_SPEC.md). The code has "Home · Budgets · Requests · Collect · People & agents · Places" — [shell.tsx:12-19](apps/web/components/account/shell.tsx).
- T-3. One payment object, four names: "payment slip" (Collect textarea, wallet QR label) [certificate-lists.tsx:230](apps/web/components/app/certificate-lists.tsx), [wallet-client.tsx:615](apps/web/app/wallet/wallet-client.tsx); "payment code" (till) [pos-client.tsx:240](apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx); "code" (wallet "Show the code again") [wallet-client.tsx:315](apps/web/app/wallet/wallet-client.tsx); "note" ("signs notes", "This note is for another chain") [issue-wizard.tsx:561](apps/web/components/app/issue-wizard.tsx), [certificate-lists.tsx:177-183](apps/web/components/app/certificate-lists.tsx). This was flagged in [docs/AUDIT_2026-09-25.md:88-91](docs/AUDIT_2026-09-25.md).
- T-4. Collect vs Redeem: the nav, heading and timeline say "Collect(ed)", but the Collect page button says "Redeem", with chip "Redeemed {x} USDC" and hint "Anyone may press redeem" — [certificate-lists.tsx:248](apps/web/components/app/certificate-lists.tsx), [:256](apps/web/components/app/certificate-lists.tsx), [:226](apps/web/components/app/certificate-lists.tsx). The copy deck says Redeem → "Collect" — [docs/copy/copy-deck.md:193](docs/copy/copy-deck.md).
- T-5. Three status vocabularies for the same budget:
  - Account rows: Active / Ending soon / Ended · take back / Closed [budget-row.tsx:19-24](apps/web/components/account/budget-row.tsx).
  - Certificate page, holder page and Collect: Open / Expired / Closed [c/[chain]/[id]/page.tsx:46](apps/web/app/c/[chain]/[id]/page.tsx), [holder-client.tsx:203](apps/web/app/app/people/[id]/holder-client.tsx), [certificate-lists.tsx:56-57](apps/web/components/app/certificate-lists.tsx).
  - Wallet: "expired" / "valid until" [wallet-client.tsx:343](apps/web/app/wallet/wallet-client.tsx).
  - The "ending" threshold is 2 days in account rows [budget-row.tsx:15](apps/web/components/account/budget-row.tsx) but 3 days for the holder page "Renew?" nudge [holder-client.tsx:204](apps/web/app/app/people/[id]/holder-client.tsx).
- T-6. Seal semantics: the spec says the seal appears only when something is signed or verified [docs/BUILD_SPEC.md:1410](docs/BUILD_SPEC.md). The wallet's loading label "Sealing…" [wallet-client.tsx:573](apps/web/app/wallet/wallet-client.tsx) uses the verb the copy deck said to avoid ("Seal (verb) → Sign") [docs/copy/copy-deck.md:191](docs/copy/copy-deck.md).
- T-7. The amount formatter is duplicated: `requests.tsx` and `request-review.tsx` define their own `usdc()` instead of `lib/fmt` (no thousands separators) — [requests.tsx:13-16](apps/web/components/account/requests.tsx), [request-review.tsx:18-21](apps/web/app/app/requests/new/request-review.tsx) vs [apps/web/lib/fmt.ts:4-10](apps/web/lib/fmt.ts).
- T-8. Dates: the wallet and certificate page use UTC dates ("… UTC") [fmt.ts:28-29](apps/web/lib/fmt.ts); requests use the locale `toLocaleDateString` [requests.tsx:158](apps/web/components/account/requests.tsx), [allow-requests.tsx:170](apps/web/components/account/allow-requests.tsx); rows use relative time [budget-row.tsx:66-70](apps/web/components/account/budget-row.tsx).
- T-9. Button styling: secondary actions are hand-rolled in several places (hand-over "Show the hand-over link", "Copy link"; FunderActions tabs; TxStatus "Check status") rather than using `buttonClass` — [hand-over.tsx:49-54](apps/web/components/app/hand-over.tsx), [hand-over.tsx:68-74](apps/web/components/app/hand-over.tsx), [funder-actions.tsx:132-145](apps/web/components/app/funder-actions.tsx), [tx.tsx:113-119](apps/web/components/app/tx.tsx).
- T-10. The spec rule "Always show the chain name next to amounts" [docs/BUILD_SPEC.md:2046](docs/BUILD_SPEC.md) is applied unevenly. Account rows show "5.00 / 5.00" with no chain [budget-row.tsx:77-80](apps/web/components/account/budget-row.tsx); the review card does ("{x} USDC · {chain}") [request-review.tsx:261-263](apps/web/app/app/requests/new/request-review.tsx).

**Missing or weak states**
- S-1. No `error.tsx`, `global-error.tsx` or `loading.tsx` anywhere under `apps/web/app` (checked with `find`). A thrown render error falls back to the Next default, and route transitions have no skeleton except the in-component ones.
- S-2. Success feedback is implicit for Top up, Extend and Take back: on success the panel closes (`setPanel(null)`) and the list refetches, so the "Confirmed" TxStatus disappears with no toast or seal — [funder-actions.tsx:74-79](apps/web/components/app/funder-actions.tsx). The till's Collect success shows only the TxStatus "Confirmed" line and the totals reset; the copy deck line "Collected. [n] payments in one transfer." is not implemented — [pos-client.tsx:383-386](apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx), [docs/copy/copy-deck.md:169](docs/copy/copy-deck.md).
- S-3. The "Copy link" in hand-over gives no "Copied" confirmation and no clipboard error handling — [hand-over.tsx:68-74](apps/web/components/app/hand-over.tsx). Allow-requests does show "Copied" — [allow-requests.tsx:100-107](apps/web/components/account/allow-requests.tsx).
- S-4. Loading states are plain text in several places: "Loading…" (People, Places, holder page), "Reading the blockchain…", "Opening your wallet…", "Opening the till…" — [people-client.tsx:38-39](apps/web/app/app/people/people-client.tsx), [places-client.tsx:68-69](apps/web/app/app/places/places-client.tsx), [holder-client.tsx:52](apps/web/app/app/people/[id]/holder-client.tsx), [holder-client.tsx:188-189](apps/web/app/app/people/[id]/holder-client.tsx), [wallet-client.tsx:96](apps/web/app/wallet/wallet-client.tsx), [pos-client.tsx:76](apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx). The account lists use skeletons — [home.tsx:159-164](apps/web/components/account/home.tsx), [budgets.tsx:42-47](apps/web/components/account/budgets.tsx). The request review returns `null` while parsing — [request-review.tsx:110](apps/web/app/app/requests/new/request-review.tsx).
- S-5. Offline:
  - Online/Offline status (`OfflineReady`) appears only on /wallet, /shop and /pos — [offline-ready.tsx:43-62](apps/web/components/offline-ready.tsx).
  - The account area has no offline state; its lists would show the chain-read error "Couldn't read your budgets from the chain" — [home.tsx:165-171](apps/web/components/account/home.tsx).
  - The wallet refuses to add a budget offline, with a clear message — [lib/wallet.ts:102](apps/web/lib/wallet.ts).
- S-6. Empty states exist for account Home, Budgets, Collect, Requests, People, Places, the wallet and the till ledger. The Collect empty state has no CTA (the copy deck suggested "Open a till") — [certificate-lists.tsx:143-149](apps/web/components/app/certificate-lists.tsx), [docs/copy/copy-deck.md:128](docs/copy/copy-deck.md).
- S-7. Error text sometimes passes raw technical messages through: `error.message.split('\n')[0]` on wallet connect [shell.tsx:136-138](apps/web/components/account/shell.tsx); "Couldn't read budgets from the chain: {message}" [certificate-lists.tsx:74](apps/web/components/app/certificate-lists.tsx); "Not a valid payment slip: {message}" [certificate-lists.tsx:186](apps/web/components/app/certificate-lists.tsx); grant errors [allow-requests.tsx:61](apps/web/components/account/allow-requests.tsx).

**Accessibility concerns**
- A-1. Good baseline:
  - skip link, `lang="zh-Hant"` on Chinese glyphs, labelled forms, `aria-live` TxStatus, `role="alert"` errors, `aria-pressed` toggles, `aria-current` nav, a Tally `role="progressbar"`, and QR `role="img"` with label — [layout.tsx:46-51](apps/web/app/layout.tsx), [tx.tsx:89](apps/web/components/app/tx.tsx), [tally.tsx:8-15](apps/web/components/tally.tsx), [qr.tsx:16-20](apps/web/components/qr.tsx).
  - The theme notes spell out contrast intent (ochre and celadon are not used for text) — [globals.css:10-17](apps/web/app/globals.css).
- A-2. The celadon colour is used as text despite the "fills, not text" note: "Active" badge `text-celadon`, "✓ Signed by this key" `text-celadon`, grant "Active" `text-celadon`, and the request "Funded" pill — [budget-row.tsx:20](apps/web/components/account/budget-row.tsx), [request-review.tsx:251](apps/web/app/app/requests/new/request-review.tsx), [allow-requests.tsx:171](apps/web/components/account/allow-requests.tsx), [requests.tsx:20](apps/web/components/account/requests.tsx), [globals.css:12](apps/web/app/globals.css). #7fa38f on #f4ede0 is likely below 4.5:1 (inference; not measured).
- A-3. Tab widgets use `role="tablist"`/`role="tab"` but have no `tabpanel`, `aria-controls` or arrow-key handling (Budgets filters, Places "How to add", Till tabs) — [budgets.tsx:27-40](apps/web/components/account/budgets.tsx), [places-client.tsx:37-56](apps/web/app/app/places/places-client.tsx), [pos-client.tsx:87-106](apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx).
- A-4. The landing StepExplorer auto-advances every 4.2 s while visible, with no pause control other than clicking a step. It is not disabled for `prefers-reduced-motion` (only the timer bar animation is). An `aria-live="polite"` figcaption announces each change, which is noisy for screen readers — [apps/web/components/step-explorer.tsx:30-34](apps/web/components/step-explorer.tsx), [step-explorer.tsx:82-84](apps/web/components/step-explorer.tsx). The demo illustration also loops automatically with an `aria-live` caption — [demo-client.tsx:92-112](apps/web/app/demo/demo-client.tsx), [demo-stage.tsx:53](apps/web/components/demo/demo-stage.tsx).
- A-5. The wallet's full-screen payment overlay (`fixed inset-0 z-50`) is a plain `<section>`: not a dialog, no focus move or trap, no Escape — [wallet-client.tsx:604-608](apps/web/app/wallet/wallet-client.tsx).
- A-6. The till keypad is wrapped in `aria-hidden` with `tabIndex={-1}` buttons. Keyboard and screen-reader users get the text input instead, which is acceptable, but the visible keypad is unreachable by keyboard — [pos-client.tsx:194-206](apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx).
- A-7. Status is sometimes carried by colour plus a glyph only: "⚠ unverified" amber, and budget badges — [issue-wizard.tsx:484-488](apps/web/components/app/issue-wizard.tsx). The ✓/⚠ glyphs help, so this is only partly colour-dependent.
- A-8. The Testnet badge's explanation lives in a `title` attribute (hover only; not read reliably by screen readers or on touch) — [site-header.tsx:37-42](apps/web/components/site-header.tsx).
- A-9. Disabled link-buttons on `/shop` use `pointer-events-none` with `aria-disabled` on an `<a>` without `href`, so they are not focusable and the reason (invalid address) is only shown when the text is non-empty — [open-shop.tsx:86-101](apps/web/app/shop/open-shop.tsx).
- A-10. Emoji avatars (🧒🙂🧑‍🔧🤖) are `aria-hidden`, which is fine; the holder type is also given in text — [people-client.tsx:17-22](apps/web/app/app/people/people-client.tsx).

**Mobile concerns**
- M-1. The owner app needs an injected browser wallet (`injected()` only). On a phone browser without a wallet extension this is a dead end ("No browser wallet found. Install MetaMask…") — [lib/wagmi.ts:21](apps/web/lib/wagmi.ts), [shell.tsx:136-138](apps/web/components/account/shell.tsx); also [docs/AUDIT_2026-09-25.md:95](docs/AUDIT_2026-09-25.md). The till's Collect has the same dependency — [pos-client.tsx:412](apps/web/app/shop/[chain]/[payee]/pos/pos-client.tsx).
- M-2. Below `lg` (1024 px) the account area hides the "+ Give a budget" CTA and the Network box, which holds the test-money notice and the chain selector. The account nav becomes a horizontally scrolling pill row of 6 items with no scroll affordance — [shell.tsx:33-34](apps/web/components/account/shell.tsx), [shell.tsx:60](apps/web/components/account/shell.tsx), [shell.tsx:75](apps/web/components/account/shell.tsx).
- M-3. Home's balance card puts three right-aligned figures in `grid-cols-3` on all widths next to a 5xl balance. The e2e test checks only for no horizontal scroll at 375 px — [home.tsx:79-83](apps/web/components/account/home.tsx), [apps/web/e2e/issue-redeem.spec.ts:68-89](apps/web/e2e/issue-redeem.spec.ts).
- M-4. On phones the docs index and docs pages render the full DocsNav (10 links in 3 groups) above the content, since the grid is single-column below `lg` and there is no collapse — [apps/web/app/docs/[slug]/page.tsx:22-24](apps/web/app/docs/[slug]/page.tsx), [apps/web/components/docs-nav.tsx:3-32](apps/web/components/docs-nav.tsx).
- M-5. Mobile header: below 420 px the Demo button moves into the menu, and below 400 px the wordmark is sr-only (the badge stays). The mobile menu is a fixed panel at `top-24` with Escape and outside-click close but no focus management — [site-header.tsx:34](apps/web/components/site-header.tsx), [site-header.tsx:68-73](apps/web/components/site-header.tsx), [apps/web/components/mobile-menu.tsx:10-59](apps/web/components/mobile-menu.tsx).
- M-6. Positives for mobile:
  - The wallet is a narrow `max-w-2xl` single column; PIN inputs use `inputMode="numeric"`; the QR scanner prefers the rear camera with `playsInline`; the payment QR is a fixed light full screen with wakeLock; there is an install-to-home-screen nudge.
  - Sources: [wallet/page.tsx:16](apps/web/app/wallet/page.tsx), [wallet-client.tsx:262-270](apps/web/app/wallet/wallet-client.tsx), [apps/web/components/qr-scanner.tsx:48](apps/web/components/qr-scanner.tsx), [qr-scanner.tsx:93](apps/web/components/qr-scanner.tsx), [wallet-client.tsx:590-608](apps/web/app/wallet/wallet-client.tsx), [wallet-client.tsx:359-384](apps/web/app/wallet/wallet-client.tsx).
  - e2e asserts no sideways scroll at 375 px on Home, Budgets, Fund and request-fund — [issue-redeem.spec.ts:68-89](apps/web/e2e/issue-redeem.spec.ts), [request-warnings.spec.ts:35-39](apps/web/e2e/request-warnings.spec.ts).
- M-7. Addresses are shown shortened (`0x1234…abcd`), but the success screen prints the full 66-char budget id with `break-all`, and the hand-over link sits in a small textarea (`text-xs`) — [issue-wizard.tsx:374](apps/web/components/app/issue-wizard.tsx), [hand-over.tsx:61-67](apps/web/components/app/hand-over.tsx).

### Inferences
- The highest-leverage fixes for non-crypto users, as a hypothesis for the report:
  1. split the person-gift flow from the agent wizard (no .env, hand-over first);
  2. one vocabulary per door, enforced by a shared glossary constant;
  3. collapse the PIN setup and add in the wallet;
  4. explicit success moments for every transaction;
  5. an add-funds/faucet step in the account area;
  6. a mobile wallet connection path (WalletConnect or similar).
- Three documents currently disagree on the owner area's name and tabs (BUILD_SPEC §21.3, DECISIONS D31, and the code), so any redesign has to settle the information architecture first.

### Gaps
- No usability test data, analytics or support logs exist in the repo, so the frictions above are inferred from the code, not observed with users.
- Contrast was not measured with a tool; A-2 is an estimate.
- Screen-reader behaviour of the paper SVG filters and the demo stage was not tested.
