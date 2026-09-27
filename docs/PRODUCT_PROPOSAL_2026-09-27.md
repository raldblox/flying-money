# Flying Money: usefulness, experience, and release proposal

**DRAFT FOR REVIEW · Revision 2 · 27 September 2026** · **Decided 27 Sep 2026 in BUILD_SPEC §22 (v1.6); see the outcomes in §15.**

This document consolidates the product discussion, earlier independent audit, targeted source rechecks, and research. It proposes improvements to Flying Money, not a replacement product. It does not amend the sealed build specification, authorize a deployment, or establish a delivery commitment.

Repository snapshot at final recheck: `26455d9`. Earlier audit evidence predates the request-inbox changes and was carried forward only with the qualifications below. Application code was not changed to produce this proposal.

**Revision 2:** incorporates the competitive evidence review and corrects the positioning, release scope, compatibility priorities, and proposed copy. The earlier audit ledger remains historical evidence, not a fresh audit. The original marketing memo and its research files have not been rewritten; conflicting claims there must not be used as approved copy. Detailed event-specific comparisons remain in the internal submissions review, not public product surfaces.

## 1. Recommendation in one page

Make Flying Money useful by making its existing primitive understandable and dependable:

> Fund a budget for a seller you choose. Use it yourself or let someone else use it. Keep track of purchases and what remains.

**Proposed category:** seller-specific funded budgets for people and assistants. **Initial job:** repeated purchases from a service or seller the user already wants to use, without sharing the funding wallet's key. **Seller value to validate:** prefunded spending with a known commitment period and a dependable path from acceptance to collection.

This is a product position, not a claim to have invented payment channels. Seller binding, delegated signing, and cumulative off-chain payments are shared mechanisms. Our opportunity is to make the complete relationship usable and reliable. The no-early-cancellation rule is a deliberate commitment trade-off, not universal superiority.

Keep one app, one identity, and one vocabulary. A person can fund a budget, use another budget, and accept payments without choosing a permanent account type. Reveal actions according to their actual permissions and activity.

The recommended priorities are:

1. Resolve the payment-safety findings and prove recovery after interruptions.
2. Make money states, purchase outcomes, and next actions unambiguous.
3. Connect the existing request inbox, funding, spending, seller collection, and expiry into complete journeys.
4. Prove one repeat-purchase flow with a useful seller, including assistant setup, receipts, recovery, and seller collection.
5. Investigate x402 batch-settlement and MPP session compatibility early, in parallel with safety work; implementation requires an approved semantic and trust mapping.
6. Expand organization and additional seller use cases only after repeat use is demonstrated. Money plans and a converter pilot remain optional, separately gated additions.

Do not add a savings contract, yield product, transferable certificate market, shared pool, or revived World simulator to accomplish these goals.

The release test is not “does it have as many screens as a financial super-app?” It is “can a new user complete a useful purchase, understand the commitment, and recover safely when something fails?”

## 2. Authority and existing foundations

[BUILD_SPEC.md](BUILD_SPEC.md), [SPEC_CHANGE_NOTICE.md](SPEC_CHANGE_NOTICE.md), and [DECISIONS.md](DECISIONS.md) govern implementation. The v1.5 addendum is normative; the protocol invariants remain unchanged. [STATUS.md](STATUS.md) records implementation reports, not independent assurance.

### What is already valuable

- A deliberately small funded-certificate model with a named seller and a separate spending key.
- A funder does not need to hand an assistant the funding wallet's signing key.
- Cumulative signed notes allow repeated purchases without requiring a new on-chain transaction for every purchase.
- Contract, SDK, seller, MCP, and web components already exist. This is not a proposal to rebuild them.
- Public explanatory pages, budgets, people/agents, places, collection, shop/POS, requests, and demonstrations already provide foundations for the proposed flows.
- The new request-inbox commit adds owner sessions, grants, relay-backed requests, approval/decline flows, and tests. The funding update also preserves successful approval progress and improves wallet errors.

### Changes since the earlier review

| Area | Current interpretation |
|---|---|
| Request inbox | Implemented in `26455d9`; improve and independently verify it, do not propose it as entirely missing. |
| Funding approval recovery | Improved in `19ce948`; test the full journey rather than replacing it. |
| Historical open V4 list | An older STATUS section still lists work now reported complete above it. Read chronologically; reconcile stale status during an approved documentation pass. |
| Verification | STATUS reports `pnpm verify --e2e` green for the inbox. This proposal did not independently rerun that full gate. |
| Marketing research | A new [marketing memo](MARKETING_2026-09-27.md) exists. Treat its market conclusions and proposed claims as research, not approved product copy. |

The marketing memo's “four doors” can be acquisition examples, but the user's preference is one app and one copy system. Do not turn them into four products. Also avoid absolute phrases such as “no one can raise” a budget: authorized top-ups exist. “Whatever remains goes back” needs an explicit reclaim action and network fee, not an automatic-return implication.

## 3. Audit findings and verification limits

These are engineering findings, not an external security certification. Severity is provisional. The earlier reproductions were local tests, not attacks on a deployed service. Source patterns were rechecked at `26455d9`; the reproductions and complete suite must be rerun before closing or asserting a finding against that revision.

### A1 · P1 · Replay protection can expire before the spending relationship ends

**Evidence:** [Redis store](../packages/server/src/redis-store.ts), `OUTCOME_TTL_SECONDS` and outcome storage. The outcome retention is 30 days, while certificate lifetimes and extensions can outlive that window.

The earlier local mock reproduction accepted a note with cumulative value 20 for a purchase of 10. After forcibly expiring the stored outcome to model the TTL, replaying the same request was admitted again and consumption increased from 10 to 20. This demonstrates duplicate seller accounting, not a claim that the contract paid twice.

**Why it matters:** retry safety must outlive a response-cache entry. S1 cannot depend on a short-lived cached response.

**Proposed correction:** separate expendable response caching from durable replay tombstones. Retain replay identity until it is safe to retire, including extension and recovery cases. Resolve the apparent tension between the database TTL prescription and S1 explicitly; do not weaken S1.

**Closure test:** replay after TTL, restart, extension, and collection never increments consumption or repeats fulfillment.

### A2 · P1 · An assistant's per-call price limit can be bypassed by re-quoting

**Evidence:** [MCP server](../packages/mcp/src/server.ts), `fm_paid_fetch`, approximately lines 171–183. The per-call `max_price` is checked against one quote, then `fm.fetch` obtains the operative quote separately.

Earlier in-memory MCP/seller reproduction: requested maximum `0.001` USDC, actual payment `0.005` USDC, tool returned no error. This is a per-call authorization failure within other configured/funded limits, not evidence of unlimited wallet access.

**Proposed correction:** pass the call-specific maximum to the signing/payment decision and enforce it against the final accepted terms. Specify whether any gateway fees are included.

**Closure test:** a changing quote, redirect, retry, or concurrent call cannot sign above that call's approved ceiling.

### A3 · P1 · Concurrent unverified counter payments can exceed the offline risk budget

**Evidence:** [counter SDK](../packages/server/src/counter.ts), unverified exposure read near line 242 followed by admission/storage. The aggregate check and reservation are not one atomic operation.

Earlier local reproduction: two concurrent purchases of 4 each, against an offline float of 5, were both accepted as UNVERIFIED, creating exposure of 8. Certificate reads were deliberately mocked unavailable. A UI busy flag does not protect other SDK callers.

**Proposed correction:** atomic admission or serialization at the authoritative till/store boundary, including the interaction with verification and release of reservations.

**Closure test:** simultaneous requests across different certificates cannot exceed total or per-certificate exposure limits, including after restart and partial failures.

### A4 · P2 · A top-up request can appear approved without proof of new funding

**Evidence:** [client SDK](../packages/client/src/client.ts), `requestStatus`, direct-chain fallback near lines 695–699. It adopts the existing requested certificate and checks the payee, without establishing a funding increase since the request.

The earlier injected-reader reproduction requested 100 against an unchanged certificate of 10, with a different funder, and received an approved status. The new relay branch adds funder/closed checks; that improvement does not by itself repair the fallback branch. Its behavior requires a fresh reproduction against the new inbox revision.

**Proposed correction:** fail closed for unsupported top-up approvals, or verify the intended certificate, owner, actual funding increase, and current usability against a persisted request baseline or qualifying transaction. Show actual approved terms; do not assume the full requested amount was granted.

**Closure test:** unchanged funding, unrelated funding, wrong owner, closed/expired certificates, relay outage, and restart cannot falsely complete the request.

### A5 · P2 · Generated spending-key handover can be lost after issuance

**Evidence:** [issue wizard](../apps/web/components/app/issue-wizard.tsx), successful issuance clears pending storage near line 157. The earlier review also identified a named-holder path that can bypass the prior key-saved confirmation.

This is a **source-level finding**, not a reproduced browser failure. Issuance can finish while the generated spending key remains only in component state before handover. Refreshing then may lose access to spending. The funder can still reclaim eligible remaining funds after expiry; do not describe this as necessarily permanent total loss.

**Proposed correction:** recipient-generated keys where practical; otherwise a recoverable, protected handover state until explicit acknowledgement. Do not solve it with plaintext secrets in links, logs, analytics, or unprotected cloud storage.

**Closure test:** refresh/close/return at every point between approval, issuance, confirmation, backup, and recipient acknowledgement preserves a safe recovery path.

### Verification ledger

| Check | Evidence and limitation |
|---|---|
| Foundry | Earlier audit: 41 passed, 0 failed, 0 skipped; invariants included 256 runs at depth 50. Not rerun for the new inbox commit here. |
| TypeScript tests | Earlier audit: 211 passed and 1 skipped across package/app runs, deduplicating reruns. Not current-HEAD totals. |
| Typechecks | Earlier package, web, and agent checks passed. Not a new full gate. |
| Dependency audit | Earlier check reported no known vulnerabilities. This is not proof of absence of vulnerabilities. |
| Secret/public-surface checks | Earlier built-in scanner was clean; gitleaks was unavailable. Public-surface check used an existing build, not a freshly generated one. |
| Lint | **Rechecked at `26455d9`: passed, 237 files, 4 warnings and 1 informational diagnostic; no fixes applied.** |
| Earlier lint failure | The temporary file responsible is no longer present. Historical failure is not an open current blocker. |
| Full release gate | Not independently rerun here. STATUS reports a green gate for the new inbox work. |
| Browser/mobile/accessibility | No fresh comprehensive visual or real-device audit in this proposal. No numerical UX score is justified. |
| Hosted deployment / real settlement | No fresh live-RPC, deployed-contract, hosted-store durability, or external paid-redemption verification here. |

**Release implication:** green existing tests and an unchanged contract do not close these SDK/store/UI findings. Add targeted regression tests and run the full gate after fixes are approved.

## 4. Product truths that copy and UI must preserve

1. A certificate funds spending for one named seller and one spending key. It is not general cash or a freely transferable claim.
2. A converter can be the seller chosen at creation. An existing certificate cannot be redirected to a different converter.
3. Funding, local purchase acceptance, fulfillment, seller collection, and owner reclaim are different events.
4. Expiry does not automatically transfer remaining funds back. Eligible reclaim requires an on-chain action.
5. Current certificates do not support early owner cancellation, downward limit edits, or spending-key rotation. Top-up/extension permissions do not imply those operations.
6. Revoking a request grant stops that grant's future request capability; it does not revoke an already funded certificate's spending authority.
7. A seller must collect while eligible. Acceptance needs an adequate expiry margin, especially with scheduled collection.
8. Offline acceptance is conditional on verified information, authoritative seller state, and the defined risk policy. A first-seen unverified certificate is merchant risk, not guaranteed money.
9. Local organization is not contractual restriction. Names, folders, plans, and assistant task labels cannot create on-chain guarantees.
10. Simulation, testnet funds, live payments, and estimates must never share an ambiguous “money received” label.

## 5. Essential market discoveries

### Observations supported by primary sources

- Agent spending controls are already a competitive category. Coinbase describes agent wallets with controls and x402 support. Flying Money should demonstrate its exact funding/key/payee model rather than claim that agent budgets are unique. [Coinbase agentic wallets](https://www.coinbase.com/developer-platform/products/agentic-wallets)
- Machine payment sessions and cumulative authorization already exist elsewhere. Compete on usability, verifiable boundaries, integration, and reliability, not a claim to have invented off-chain cumulative payments. [Stripe MPP announcement](https://stripe.com/blog/machine-payments-protocol), [MPP session update](https://mpp.dev/blog/sessions-improved)
- HTTP 402 alone does not establish interoperability. Client, seller, scheme, and facilitator support must agree. A Flying Money note is not automatically acceptable to an arbitrary x402 endpoint. [x402 protocol repository](https://github.com/x402-foundation/x402)
- Agent authorization is broader than payment settlement. AP2's mandate flows are useful context for recording user intent, but integrating such evidence does not change what Flying Money's contract enforces. [AP2 flows](https://ap2-protocol.org/ap2/flows/)
- Useful fintech patterns include explicit transfer stages, request reminders, organized budgets, and visible costs. These are experience references, not claims that Flying Money offers the same protections or services. [Wise tracking](https://wise.com/help/articles/2452305/how-do-i-check-my-transfers-status), [PayPal reminders](https://qwac.paypal.com/us/cshelp/article/how-do-i-send-a-reminder-for-an-invoice-or-money-request-help1152), [Aspire budgets](https://aspireapp.com/budgets), [Wirex cost transparency](https://help.wirexapp.com/article/cost-transparency-disclosure-1655)

### Product inferences, not proven demand

- A strong first use is repeat purchases from a seller the user already intends to use. Funding is easier to justify when subsequent purchases are frequent and small.
- The biggest everyday upgrade may be confidence about “what happened and what do I do now?”, not another payment mechanism.
- An ordinary assistant user needs a guided setup and a useful compatible service. Owning a certificate alone provides little benefit.
- People who save money may value planning labels and reminders, but these alone are not a reason to move long-term savings into seller-bound escrow.
- Diverse users can share objects and language even when they arrive through different examples.

### Unknowns to validate

The founder reports access to agents, merchants, and converters. This is potential access, not validated demand or signed partnerships. We still need evidence on willingness to prefund, acceptable locked duration, seller integration effort, repeat purchase frequency, recovery comprehension, and conversion-provider reliability.

Do not copy market statistics, competitor exclusivity claims, or legal conclusions from the marketing memo into public copy without checking their original sources and applicability.

### 5.1 Competitive findings that change the proposal

| Finding | Strategic implication | Proposal change |
|---|---|---|
| Solana channels already bind payer, payee and authorized signer. | A chosen seller and separate key are not unique inventions. | Present these as explicit product properties, not an exclusive moat. |
| x402 batch settlement supports escrow and cumulative vouchers on EVM and Solana. | The competition is not limited to on-chain-per-request payments or another chain. | Compare equivalent repeat-use flows; raise compatibility research before expansion. |
| MPP sessions support a corresponding payee/signer model and forced-close rules. | A familiar mechanism does not imply identical lifetime, recovery or interoperability semantics. | Compare exact rules and integration effort, not slogans. |
| Flying Money disallows early owner cancellation. | A seller's previously verified funding commitment cannot be shortened by owner withdrawal, but owners lose early liquidity. | Explain this before funding and validate whether buyers and sellers both accept the trade-off. |
| Some users want immediate revocation. | Those users may be a poor fit for this commitment model. | Do not advertise instant take-back or disguise stopping requests as cancelling funds. |
| Familiar substitutes include API credits, prepaid tabs and payment cards. | Users judge usefulness and acceptance, not just cryptographic design. | Measure total effort and cost against how the same purchase is made today. |

Primary evidence: [Solana channel design](https://github.com/solana-foundation/payment-channels), [x402 batch settlement](https://docs.x402.org/schemes/batch-settlement), [Tempo session specification](https://paymentauth.org/draft-tempo-session-00.html). Competitor documentation is evidence of a documented design, not independent verification of every deployed configuration. No exhaustive uniqueness claim is justified.

The meaningful technical hypothesis is **a known commitment window without owner-triggered early closure**. Reviewed channel designs allow closure after a grace period; Flying Money instead requires the seller to collect before the known expiry. This may reduce early-close monitoring requirements, but does not eliminate collection, clock, authoritative-state, contract, token or chain risks. [Solana closure state machine](https://github.com/solana-foundation/payment-channels/blob/main/docs/001-payment-channel-state-machine.md)

Do not generalize this into “competitors cannot work offline.” Local verification, prolonged disconnection and successful later collection are different capabilities. Independently test the exact deployment and failure assumptions before making security comparisons.

### 5.2 Positioning: broad primitive, specific first reason to use it

**Internal positioning statement:** For people who want to fund repeat spending by themselves or an assistant at a chosen seller, Flying Money provides a seller-specific funded budget and one place to manage its use. The intended experience connects permission, purchase, delivery, collection and reclaim. Its fixed commitment period is explicit, rather than disguised as an instantly revocable wallet allowance.

The public promise should be the useful outcome: **give spending a purpose, a recipient and a visible limit**. The technical explanation comes next. Do not make “offline money”, “faster than a blockchain”, “the first agent budget”, or “a new bank” the umbrella position.

The same objects serve diverse users:

| User's job | Same underlying flow | Critical limitation to explain |
|---|---|---|
| “Let my assistant buy reports from this service.” | Fund the chosen service, delegate the spending key, review purchases. | It cannot spend at arbitrary services or replace the assistant subscription. |
| “Let someone use a budget at this shop.” | Fund the chosen shop, hand over spending access, retain receipts. | Not a general allowance accepted everywhere; no early cancellation. |
| “Keep my own repeat purchases organized.” | Use a self-held budget with that seller. | Funds are committed, not merely categorized in a wallet. |
| “Accept payments from customers or their assistants.” | Validate, account, fulfill, collect and reconcile. | Escrow is not merchant cash already received; delivery remains the seller's responsibility. |
| “Set money aside for later.” | Optional non-locking plan, followed by explicit funding when needed. | The plan itself does not protect funds, earn interest or create a spending commitment. |

**Recommended first acquisition example:** a person funding a useful paid tool for their assistant. This is a pilot recommendation based on the existing SDK/MCP/seller foundations, not a permanent agent-only product or proven market ranking. The service must solve a real task, not exist solely to demonstrate payments. A human-initiated purchase should work against the same seller and produce the same understandable record.

**Second validation track:** a known repeat merchant with intermittent connectivity and a single authoritative till. This tests whether the commitment window matters. Do not begin with strangers, disconnected multi-till acceptance, arbitrary cash-out, or a promise of universal merchant acceptance.

A primitive can remain generic while distribution starts narrowly. Supporting every role does not require launching every optional feature at once.

### 5.3 Evidence, differentiation and honest limits

| Layer | What we can say | What would establish value |
|---|---|---|
| Implemented model | Seller-specific escrow, separate spending key, cumulative notes and no early owner reclaim, subject to current spec and audit limits. | Fresh correctness, recovery and deployment verification. |
| Proposed product strength | One coherent owner/spender/seller journey for humans and assistants. | Users complete real tasks with less confusion and fewer support interventions. |
| Technical hypothesis | A stable commitment window may suit disconnected seller acceptance. | Comparable tests plus sellers choosing the trade-off after seeing its costs. |
| Potential defensibility | Useful seller integrations, operational reliability and earned trust. | Repeat customers, retained sellers, successful recovery and maintained integrations. |
| Not established | Superior security, unique mechanism, broad acceptance, production readiness, traction or a network-effect moat. | Cannot be claimed from the current research or repository alone. |

The difficult competitor is often an existing credit balance or card, not another channel library. Flying Money must justify funding friction, fragmented balances, network fees, key recovery and expiry management. Small, consciously chosen commitments may reduce inconvenience, but do not remove those costs. Do not automatically prefund extra sellers or recycle reclaimed funds without authorization.

### 5.4 Replace a feature launch with one complete release slice

The 56 options below remain a backlog, not a commitment to ship 56 features. This release-slice recommendation takes precedence over the broader “Now” labels until scope is approved.

| Release slice | Existing feature IDs | Required result |
|---|---|---|
| Know what is committed | F01, F05, F11, F16, F17, F37 | Correct amounts, exact seller/key, expiry, fees and no-early-cancel explanation before funding. |
| Fund and recover | F18, F19, F20, F50 | Funding and handover survive interruption; requests never falsely appear funded. |
| Buy and understand the result | F04, F25–F29, F54 | One useful purchase, stable identity, delivery/payment separation and safe unknown-outcome recovery. |
| Let an assistant repeat the task | F33, F34, F38 | Guided setup, operative price ceiling, visible receipts and honest stopping controls. |
| Let the seller finish the payment | F41, F44; F31 for counter pilot | Durable acceptance and accounting, collection before expiry, evidence and reconciliation. |
| Make it usable | Relevant F02, F03, F07, F52 | Clear next actions, names, accessible mobile and desktop flows. |

Compatibility research (F40) starts alongside this work; it is not a release claim. Promote F33/F34 from generic “Next” into the selected assistant pilot. Keep folders, advanced reports, forecasts, team approvals, bulk actions and money plans outside the minimum slice. Seller fulfillment may start with a focused order view rather than a new operations suite.

Do not compensate for unresolved safety findings by adding more onboarding polish. A1–A5 retain their evidence qualifications and must be reproduced, resolved and regression-tested before the relevant release claims.

### 5.5 What would make us change direction?

Run small, explicitly approved pilots, not an unbounded platform launch:

1. Compare one useful assistant task with the user's current payment method. Measure setup time, total lifecycle cost, successful paid results and repeat choice.
2. Ask a merchant and customer to explain the same commitment independently. If either expects instant revocation or automatic refunds, the flow has failed comprehension.
3. Exercise lost responses, restart, conflicting retries, disconnection and approaching expiry. Count accepted, delivered and collected purchases separately.
4. Test a native Flying Money integration and investigate an existing standard's integration burden. Record which changes belong to the client, seller, backend or contract.
5. Follow unused funds through reclaim. Measure committed-but-unused value and time, not just successful payments.

Before each pilot, agree a duration, participant group, baseline and success threshold. Safety failures block continuation; convenience metrics cannot offset them. Testnet demonstrations validate mechanics and comprehension, not willingness to spend real money. Any real-money pilot requires separate security, legal/partner and deployment approval.

If people prefer existing credits/cards and sellers do not value the commitment rules, do not manufacture differentiation by adding savings or more chains. Reconsider the acquisition focus. If standards compatibility requires changing economic rights, return for a spec decision rather than silently replacing the protocol. If cancellation is essential to the intended user, acknowledge a product-fit conflict instead of calling a UI switch “revoke”.

## 6. One app, one mental model

### Recommended shared vocabulary

| Primary UI | Meaning / technical detail revealed on demand |
|---|---|
| Budget | Funded certificate when funded; explicitly labelled Draft otherwise. |
| Funded by | Owner/funder. |
| Can use | Person or assistant controlling the spending key. |
| Pays | The one designated seller/payee. |
| Available to spend | Remaining usable authority according to current verified/seller state, not the funder's free wallet balance. |
| Purchase | A request and its outcome, with a stable reference. |
| Collect | Seller's eligible on-chain redemption. |
| Reclaim remaining funds | Funder's eligible post-expiry action. |
| Money plan | Optional organizational allocation in a wallet; not a funded certificate or locked vault. |

Avoid making users learn Giver/Holder/Place on one screen and Owner/Agent/Service on another. This is a proposed change to §21.3, requiring approval, not a silent copy cleanup.

### Monetary overview: no misleading grand total

Separate “In your wallet”, “Committed to budgets”, “You can spend”, and “Your seller collections”. These can overlap economically and belong to different authorities. Do not add them into a single available balance.

For example, funding a budget moves money out of freely available wallet funds; it does not create an additional asset available for immediate owner withdrawal. Seller receivables are not collected funds. A person may view the same certificate as both funder and spender without doubling it.

Every amount needs its asset, network where relevant, source, and freshness. When accurate cross-network aggregation is unavailable, show separate amounts, not an invented fiat total.

### Proposed navigation

**Home · Budgets · Activity · Contacts**, with a persistent, accessible **Requests** inbox and context-visible **Collect / Orders** actions for sellers.

This is an option, not an approved replacement for current navigation. If testing shows the inbox or collection is harder to find, retain those as top-level destinations. Do not hide essential actions merely to reach four tabs.

- Home: money states, outstanding actions, recent purchases, shortcuts.
- Budgets: funded, usable, expiring, closed, and draft items; perspective filters rather than separate products.
- Activity: purchases and funding lifecycle, grouped by real operation.
- Contacts: people, assistants, and sellers; labels do not grant authority.
- Seller panels appear because the user accepts payments, not because they switched to another app.

### Route opportunities

| Destination | Proposed treatment |
|---|---|
| Existing `/app`, budgets, requests, people, places, collect | Preserve and improve. Existing links and stored state must survive any rename. |
| `/app/activity` and detail | Unified history with private access controls; technical hashes are secondary evidence. |
| `/app/pay` | One scan/paste/open-payment entry point. |
| Budget detail | A contextual detail page or drawer; reuse the existing certificate view where appropriate. |
| `/app/contacts` | Optional merged directory. Keep old people/place URLs as compatible destinations if adopted. |
| `/app/orders` | Seller delivery and collection workflow, only if activity/detail cannot serve it clearly. |
| Settings / reports | Add only where there is real content: recovery, notifications, exports, privacy. |

No new route exists merely to fill a sitemap. No World route is proposed.

## 7. Feature options and acceptance conditions

These are improvements or extensions, not assertions that every underlying component is absent. **Now** means recommended first after approval and safety fixes; **Next** means after core journeys; **Explore** needs validation or a separate risk design. App = UI/local organization; Service = SDK/backend/indexing; Partner = external capability. Contract changes are explicitly called out rather than presumed.

### A. Understand and organize money

| ID | Proposal / user benefit | Priority · layer | Minimum acceptance condition |
|---|---|---|---|
| F01 | Clear monetary overview | Now · App/Service | Never double-count wallet funds, funded budgets, spending authority, or seller receivables. |
| F02 | Action inbox | Now · App/Service | Every item has an owner, reason, status, and safe next action; resolved items stop prompting. |
| F03 | Contextual shortcuts | Now · App | Create, pay, request, or collect without selecting a permanent persona. |
| F04 | Unified activity | Now · Service/App | Retry, note, funding, delivery, and collection correlate without duplicate purchases. |
| F05 | Freshness/source labels | Now · App/Service | Cached, seller-reported, and chain-confirmed values are distinguishable. |
| F06 | Watch-only views | Next · App | Viewing does not request signing authority or imply control. |
| F07 | Budget names | Now · App | Rename without changing certificate terms; names are private by default. |
| F08 | Tags, folders, search, saved filters | Next · App | Useful across larger lists; no labels imply enforcement. |
| F09 | Optional money plans | Next · App/Service | Explicitly non-locking; external wallet spending triggers reconciliation, not a stale “saved” balance. |
| F10 | Reusable budget templates | Next · App | Every new funding action gets fresh terms and authorization. |
| F11 | Budget lifecycle | Now · App/Service | Spending, collection, and reclaim states are separate, not one misleading progress bar. |
| F12 | Relationship summary | Next · App/Service | Show history with a person/assistant/seller without confusing spending authority with ownership. |

### B. Create, request, and hand over budgets

| ID | Proposal / user benefit | Priority · layer | Minimum acceptance condition |
|---|---|---|---|
| F13 | Purpose-first creation | Now · App | Ask who can use it, which seller, amount, and duration in understandable language. |
| F14 | Recipient-generated key invitation | Next · Service/App | Verify recipient identity/key binding before funding; never share the funding wallet key. |
| F15 | Invitation progress | Next · Service/App | Sent, opened, accepted, funded, and ready are not conflated. |
| F16 | Funding preflight | Now · App/Service | Asset, network, allowance, fee balance, seller, and spender checked before commitment. |
| F17 | Commitment preview | Now · App | One seller, spending key, amount, expiry, no early cancellation, and reclaim requirements shown before signing. |
| F18 | Persistent operation tray | Now · App/Service | Navigation, refresh, and mobile wallet return do not restart a completed approval or duplicate issuance. |
| F19 | Complete existing request inbox | Now · Service/App | Verify new/top-up/extension semantics independently; preserve grant versus funded-authority distinction. |
| F20 | Requested-versus-approved comparison | Now · App | Agent and owner see actual amount and dates; changed terms are explicit. |
| F21 | Partial approval / counteroffer | Next · Service/App | Distinguish a proposed change from funded approval; obey request rules. |
| F22 | Decline reasons and context | Next · Service/App | Optional, private, sanitized; never treated as executable assistant instructions. |
| F23 | Reminders and duplicate grouping | Next · Service/App | No repeated signing or notification storms; pending agents wait with bounded polling. |
| F24 | Team review workflow | Explore · Service | Clearly advisory unless real authorization supports multiple approvers; no false multisig claim. |

### C. Pay and resolve outcomes

| ID | Proposal / user benefit | Priority · layer | Minimum acceptance condition |
|---|---|---|---|
| F25 | Single pay entry | Now · App | Scan, paste, or link reaches one validated review flow. |
| F26 | Matching budget picker | Now · App/Service | Match exact seller, asset, network, expiry, and available authority; never redirect an existing certificate. |
| F27 | Complete purchase preview | Now · Service/App | Price, seller, fees, item, and expiry visible; authorization binding reviewed where protocol extensions are needed. |
| F28 | Payment versus delivery status | Now · Service/App | Unknown delivery is not Failed or Refunded; recovery retains the same operation identity. |
| F29 | Receipts and download | Now · App/Service | Show seller, amount, time, budget, delivery state, and collection evidence without leaking secrets. |
| F30 | Buy again | Next · App | Obtain a fresh quote and authorization; do not replay an old purchase as a new one. |
| F31 | Counter readiness | Now · Service/App | Last verification, authoritative till, expiry margin, and offline risk are visible. |
| F32 | Support/evidence flow | Next · Service/App | Attach redacted operation evidence; do not promise chargebacks or recovery the protocol cannot provide. |

### D. Assistants and repeat services

| ID | Proposal / user benefit | Priority · layer | Minimum acceptance condition |
|---|---|---|---|
| F33 | Guided assistant setup | Next · App/SDK | Connect a supported client, fund a chosen service, verify a small authorized call, show its receipt. |
| F34 | Assistant detail | Next · App | Show budgets, spending key identity, request permissions, activity, and limits by enforcement layer. |
| F35 | Task/project attribution | Next · Service/App | Labels attach to receipts; they do not become contractual restrictions by implication. |
| F36 | Compatible service directory | Next · Service | Distinguish protocol compatibility, domain verification, and endorsement; show availability honestly. |
| F37 | Enforcement labels | Now · App/docs | Identify contract limits versus client settings versus gateway policies. |
| F38 | Stop future funding/requests | Now · App/Service | Clearly does not revoke existing spending authority; show outstanding exposure. |
| F39 | Budget run-rate estimates | Next · App | Derived from actual spending, time window disclosed; no guarantee about future cost. |
| F40 | x402 / MPP compatibility assessment | Research now; implementation gated · SDK/Partner | Map batch/session semantics, authorization, closure, replay, collection and recovery before selecting native support or a gateway. |

### E. Sellers and converters

| ID | Proposal / user benefit | Priority · layer | Minimum acceptance condition |
|---|---|---|---|
| F41 | Seller onboarding checklist | Now · App/Service | Real payee identity, durable state, fulfillment, collection, and recovery tested. |
| F42 | Quotes, invoices, payment links | Next · Service/App | Order identity, amount, expiry, and recipient are verified; link display is not authority. |
| F43 | Order/fulfillment queue | Next · Service/App | Accepted, delivered, disputed, and unknown outcomes kept separate. |
| F44 | Collection health/settings | Now · Service/App | Eligible notes, fees, last success, expiry danger, and actual transaction receipts shown. |
| F45 | Authoritative till handover | Next · Service | Prevent two disconnected tills from independently spending one shared state history. |
| F46 | Explicit refund workflow | Explore · Service/Partner | Distinguish unused seller credit, failed purchase recovery, and a separately authorized asset refund. |
| F47 | CSV and statements | Next · Service/App | Stable identifiers, assets, networks, fees, and status; no claims of tax advice or audited accounts. |
| F48 | Converter/cash-out seller | Explore · Partner | Bound quote, payout destination, fees, identity checks, liquidity, expiry, delivery evidence, and dispute process. |

### F. Trust and daily operation

| ID | Proposal / user benefit | Priority · layer | Minimum acceptance condition |
|---|---|---|---|
| F49 | Notification preferences | Next · Service/App | Opt-in channels, actionable events, quiet hours, redacted lock-screen content. |
| F50 | Security/recovery center | Now · App/Service | Explain which key was backed up, recovery limitations, and exposed active budgets. |
| F51 | Protected device migration | Next · Service/App | Preserve C1 and pending purchases; not uncontrolled concurrent copies of a spending key/state. |
| F52 | Accessibility and localization | Now · App | Keyboard/focus, contrast, readable amounts, touch targets, and text statuses; estimated fiat conversions labelled. |
| F53 | Scoped sharing | Next · Service/App | Share only intended evidence; no key, grant, session, or sensitive purchase leakage. |
| F54 | Contextual service health | Now · App/Service | Differentiate RPC unavailable, seller unavailable, inbox unavailable, and unknown outcome. |
| F55 | Scheduled drafts/reminders | Next · Service/App | Reminder does not imply unattended funding; automatic authority needs a separately approved design. |
| F56 | Bulk organization/actions | Next · App/Service | Partial failure and per-item authorization explicit; no fictional atomic batch guarantee. |

## 8. Complete journeys to prioritize

### Journey 1: “Give my assistant a small budget”

Choose or connect the assistant → establish its spending identity → choose a compatible seller → set amount and expiry → review commitment and fees → fund → verify confirmed terms → run one permitted purchase → see delivery and receipt.

An assistant using several sellers needs separate certificates. The UI can group them as a project, but that group is not a shared spending pool. “Stop requests” is not “cancel all active budgets”.

Codex/Claude compatibility would mean supported tool calls can buy services through Flying Money. It does **not** mean Flying Money automatically pays the user's native subscription or model bill. Client setup and distribution policies need separate verification before publishing instructions.

### Journey 2: “Someone asks me for a budget”

Open existing inbox → inspect requester, seller, purpose, amount, expiry → compare with saved contacts → approve, adjust where supported, or decline → complete funding → verify the actual on-chain change → notify requester of actual funded terms.

A signed request grant lets the requester ask; it is not unlimited permission to withdraw. A missing inbox response must not cause a false approval through fallback logic.

### Journey 3: “Pay this seller”

Scan/open request → verify seller and quote → pick a matching usable budget or explicitly fund one → review purchase → sign → seller accepts → delivery occurs → receipt records both outcomes → seller collection updates separately.

After a connection loss, display “Checking this purchase” and look up the same request. Never blindly create a second payable request because the first response was lost.

### Journey 4: “I accept payments”

Set up seller and durable state → publish a supported payment request → accept and account atomically → deliver → persist outcome → collect eligible cumulative authorization → verify receipt → reconcile to orders.

Collection must respect consumed value, eligible signed notes, contract rules, gas, and expiry. “A signature exists” is not enough to label all of its cumulative value as earned revenue.

### Journey 5: “My budget is expiring”

Warn with the seller's collection margin → stop unsafe new acceptance → collect eligible spending before deadline → show funder's reclaim eligibility after expiry → funder submits reclaim → confirm remaining funds returned → optionally create a new budget.

Do not present reclaimed funds as available before confirmation. Do not promise that turning off an assistant releases funds immediately.

### Journey 6: “I want to exchange value for cash or another asset”

Choose a converter as the certificate's original seller → obtain a quote → review input, output, destination, fees, expiry, and provider identity → authorize the agreed operation → converter accepts → track payout → retain receipt/evidence.

This is a legitimate *use case proposal*, not an existing universal cash-out rail. The certificate does not guarantee delivery of cash or the output asset. Physical cash and external bank transfers are not made atomic by the certificate. Unknown payout status needs reconciliation before another payout attempt.

Jurisdiction-specific licensing, custody, AML/KYC, sanctions, consumer protection, and partner obligations require qualified review. For Philippine planning, BSP's VASP framework is relevant context, not a determination of Flying Money's legal classification. [BSP Circular 1108](https://www.bsp.gov.ph/Regulations/Issuances/2021/1108.pdf)

### Journey 7: “I want to keep money for later”

Create a money plan → assign a target and optional date → show the allocation against actual wallet funds → reconcile external spending → remind the user → when ready, explicitly fund a seller budget.

A plan neither locks funds nor earns interest. The assistant cannot access it just because it appears in the same app. Only a separately funded, authorized budget enables spending.

## 9. Savings, retirement, and new-contract decisions

| Idea | Fit | New contract? | Recommendation |
|---|---|---|---|
| Names, folders, expense categories | Direct | No | Add as organization. |
| Money plans / targets | Adjacent and useful | No, if non-locking | Keep subordinate to budgets; test demand. |
| Future-use seller budget | Direct, but funds are committed to that seller | Existing mechanism | Explain expiry and reclaim, not savings-account language. |
| Scheduled funding reminder | Direct | No | Safe convenience with fresh human approval. |
| Automatic recurring funding | Conditional | Depends on chosen authorization | Separate security design; never infer permission from a reminder. |
| True timed savings vault | Different custody/locking semantics | Usually separate contract or provider | Defer; existing seller escrow is not a substitute. |
| Interest/yield/retirement fund | Changes risk and product promise | Separate system/provider and legal scope | Not part of this release proposal. |
| Converter as named seller | Fits payee model | Not inherently | Payout service and legal/operational risks remain. |
| Paying arbitrary x402 seller from any certificate | Does not fit immutable payee | Cannot be achieved by UI relabelling | Use only an explicit compatible scheme or gateway model. |

Wise-style jars are an experience reference for organization, not evidence that Flying Money provides a bank savings account. [Wise jars](https://wise.com/help/articles/2978074/what-are-jars-and-how-can-i-keep-money-in-them)

## 10. Draft copy system

All copy below is proposed. Feature-dependent copy must not ship before its flow works. Use real network/testnet status dynamically, and place essential commitments beside the action, not only in an FAQ.

### Homepage: recommended broad message

**Headline:** Give a budget. Not your wallet.

**Subheadline:** Fund a budget for a seller you choose. Use it yourself, or let another person or an AI assistant use it. See what was spent and what remains.

**Primary action:** Open Flying Money

**Secondary action:** See how it works

**Supporting line:** Pay from a budget. Accept payments as a seller. Keep track of both in one app.

**Commitment line beside the funding action:** Funds stay committed until the budget ends. You cannot cancel early. After expiry, reclaim eligible remaining funds with a network transaction.

**Testnet qualifier while applicable:** Try it with test funds. Real-money payments are not available in this environment.

Why this direction: it describes delegation without sharing the funding wallet key, rather than claiming a novel mechanism. The subheadline includes self-use and the chosen-seller restriction. The headline is not a guarantee against loss or a claim that no signing wallet exists. Keep the commitment line visible before any funding approval.

### Alternative headline options

1. **Your money. A clear purpose.** Broader organization-led option; keep the funded, seller-specific meaning in the subheadline and test that users do not infer savings protection.
2. **Choose who can spend. Choose who gets paid.** More explicit control language; clarify that the seller is fixed when funded, not an editable destination.

Alternative primary actions: **Create a budget** when the visitor is ready to fund, or **Try a test budget** in a clearly testnet-only funnel. Avoid a “Start saving” CTA.

### How it works

**1. Set the terms**

Choose the person or assistant, one seller, an amount, and an end date.

**2. Fund the budget**

Review the commitment and network fee before you approve.

**3. Use it and keep track**

See purchases, remaining spending capacity, and payment status. After expiry, reclaim eligible remaining funds.

### Use-case cards, not separate products

- **For your day-to-day spending:** Keep repeat purchases with a seller in one named budget.
- **For someone you support:** Fund a budget they can use with the seller you choose.
- **For your assistant:** Give it access to a funded budget for a compatible service, not your funding wallet key.
- **For your business:** Accept supported payments, track delivery, and collect eligible funds.

Do not present hypothetical cafés, APIs, or converters as integrated partners.

### Proof and objections, not novelty claims

**Why use Flying Money?** Fund a specific seller, give only the intended spending access, and follow purchases through to their outcome. These are product benefits, not claims that competing channels lack them.

**Why does the money stay committed?** So the seller's previously verified funding period cannot be cut short by an early withdrawal. The seller must still follow acceptance rules and collect before expiry. Choose an amount and duration you are comfortable committing.

**Can I use it anywhere?** Only with a seller that supports Flying Money, using a budget funded for that seller. Standard compatibility and gateway routes must be labelled separately if implemented.

**Is it the same as prepaid store credit?** It serves a similar repeat-purchase job, but uses a funded contract and a separate spending key. Eligible unused funds can be reclaimed after expiry; that is not an automatic refund or a promise of consumer chargeback rights.

**What proves it works?** Show a reproducible supported purchase, its receipt, the seller's collection evidence and the funder's reclaim path. Publish environment and verification limits. Do not substitute partner logos, payment animations or synthetic throughput for this proof.

### Budget creation labels

| Element | Proposed text |
|---|---|
| Title | Create a budget |
| Name | What is this budget for? |
| Spender | Who can use it? |
| Payee | Which seller can it pay? |
| Amount | How much will you fund? |
| Expiry | When does it end? |
| Review action | Review budget |
| Signing action | Fund budget |
| Commitment notice | This budget pays only [seller]. You cannot cancel it early or change who can use it. After it expires, you can reclaim eligible remaining funds with a network transaction. |
| Top-up | Add funds |
| Extension | Extend end date |
| Grant revoke | Stop new requests |

For top-ups, show added funds and resulting commitment, not a second full funding charge. Separate token approval from budget funding in the progress UI.

### Status and recovery copy

| Situation | Draft message / action |
|---|---|
| Waiting for wallet | Review this in your wallet. / Open wallet |
| Approval confirmed | Spending approval confirmed. Continue to fund the budget. |
| Funding submitted | Funding submitted. You can leave this page while we check confirmation. |
| Funded | Budget funded. [Name] can use it with [Seller] until [date]. |
| Purchase accepted | [Seller] accepted this purchase. / View delivery status |
| Lost response | We're checking this purchase. Don't pay again yet. / Check status |
| Seller collection pending | The purchase is recorded. The seller has not collected it on-chain yet. |
| Collection confirmed | Seller collection confirmed. / View transaction |
| Expired | This budget has ended. Check whether remaining funds can be reclaimed. |
| Reclaim eligible | Remaining funds can be reclaimed. A network fee applies. / Reclaim funds |
| Request grant stopped | New requests using this permission are stopped. Existing funded budgets are unchanged. |
| Price above limit | The latest price is above your limit. Nothing new was signed. / Review price |
| Offline, previously verified | Connection unavailable. Showing the last verified information from [time]. |
| Counter unverified | This budget could not be verified. Accepting it uses your configured offline risk allowance. |
| Unknown seller | This seller is not saved. Check its identity and address before funding. |

Messages such as “nothing new was signed” are conditional on that being demonstrably true. If the state is unknown, say so instead.

### Empty states

- **No budgets yet:** Create a budget for yourself, someone else, or an assistant. Start by choosing the seller it can pay.
- **No purchases yet:** Purchases made from your budgets will appear here, with their delivery and payment status.
- **No requests:** Requests from people and assistants you allow will appear here. You decide what to fund.
- **No collections due:** No eligible payments are ready to collect. This does not mean every pending order has been delivered.
- **No money plans:** Give part of your wallet balance a purpose. Plans help you organize money; they do not lock it or earn interest.

### Assistant setup copy

**Title:** Give your assistant a budget

**Body:** Connect a supported assistant client and choose a compatible service. Your assistant receives a spending key for its funded budget, not your funding wallet key.

**Clarification:** This pays supported tools and services. It does not replace your assistant subscription or automatically pay its model provider.

**Actions:** Connect assistant · Choose service · Review limits · Try an authorized request

### Copy to avoid

“Spend anywhere”, “instant cash-out”, “risk-free”, “foolproof”, “fully audited”, “guaranteed offline money”, “cancel whenever”, “automatic refund at expiry”, “insured savings”, “retirement account”, “no fees”, and “unlimited TPS”. None should be inferred from the current primitive.

**Proposed page title:** Flying Money | Funded budgets for people and assistants

**Proposed description:** Choose who can use a budget, the seller it can pay, and how much you fund. Track purchases and seller collection in one app.

## 11. Integration options without changing the story

### x402 / MPP: investigate early, choose one explicit model

Treat compatibility as an acquisition and acceptance question, not a logo feature. A seller already using a standard should not be asked to adopt another method without a demonstrated benefit. The relevant baseline includes x402 batch settlement and MPP sessions; x402 `upto` is a request-level maximum and is not by itself the equivalent of a long-lived seller budget. [x402 scheme overview](https://docs.x402.org/schemes/overview)

The research deliverable is a versioned compatibility matrix and go/no-go recommendation, not an unsupported “x402 compatible” badge:

| Boundary | Required comparison / test |
|---|---|
| Identity | Funder, spender, seller and receiver bindings; signature domain and key type. |
| Economics | Asset, funded amount, cumulative amount, consumed value, fees and price ceiling. |
| Lifetime | Early-close rights, expiry, reclaim, collection margin and offline assumptions. |
| Transport | Exact challenge, headers, payload, scheme negotiation and error semantics. |
| Recovery | Stable request IDs, replay/outcome retention, retries, process failure and unknown delivery. |
| Settlement | Who submits and pays fees; actual contract and accepted evidence; no fabricated receipts. |
| Distribution | Which client, seller and facilitator versions really support the method; channel policy approval where required. |

If the formats or rights do not match, do not relabel a Flying Money note as an existing standard voucher. Supporting another channel contract would be a separate architectural/spec decision, not a small serialization patch. Record the minimum actual changes and whether they preserve the sealed protocol.

**Native negotiated support:** implement a Flying Money payment scheme where the participating seller/client infrastructure explicitly supports it. The certificate stays bound to that seller. This does not unlock every x402 endpoint.

**Gateway seller:** the user funds a certificate whose payee is the gateway. The gateway purchases an upstream service using its own supported payment method and liquidity. The ultimate seller is not the certificate payee. Price ceilings, fees, permitted destinations, refunds, unknown outcomes, and provider trust become gateway responsibilities.

A gateway is a new service responsibility, not a transparent certificate conversion. SSRF controls, signed quote/order binding, idempotency, and upstream failure reconciliation must be designed before implementation. Do not say it is atomic unless the complete delivery/payment mechanism actually provides that property.

### Practical commerce integrations

Gift cards, airtime, data, or other repeat services could be useful seller offerings, but availability requires commercial/API access and actual delivery integration. Bitrefill documents such business APIs; that is an integration possibility, not an existing Flying Money partnership. [Bitrefill API overview](https://docs.bitrefill.com/docs/api-overview)

### No unnecessary contract expansion

Most recommended features need UI, metadata, SDK, durable backend, indexing, or partner work. Do not alter the core to make a navigation label true. Changes to signing payloads, economic rights, authorization semantics, or refund guarantees require explicit protocol review and specification approval.

## 12. Scale and performance: useful evidence, not a TPS contest

The scalable unit is independent funded relationships with correct local accounting. Preserve per-certificate serialization/atomicity while allowing independent certificates to proceed in parallel. Do not remove C1's protection to improve a benchmark.

Recommended engineering work after approval:

- Partition seller accounting by stable certificate identity while retaining atomic replay/outcome handling.
- Preserve durable acknowledgement and recovery semantics under process/store failure.
- Make global indexes and event history incremental, paginated, and rebuildable.
- Use stable order/request identifiers and an outbox pattern where external work must survive a crash.
- Separate authoritative state from analytics, UI caches, and downloadable reports.
- Check Redis deployment constraints before sharding Lua operations: multi-key operations in a cluster need compatible key placement. [Redis cluster specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/)
- Batch eligible collections where supported, but include funding, top-ups, reclaim, gas, and expiry pressure in cost analysis.

Measure completed valid paid requests per wall-clock second, p50/p95/p99 latency, error/unknown rates, durable-write latency, and collection cost separately. Report offered load and completed work separately. Publish hardware, seller configuration, network, payload, number of independent certificates, duration, and failure injection.

An illustrative 100,000 purchases across 1,000 certificates might require far fewer collection transactions than purchases, but issuance and other lifecycle transactions still count. This is not a measured throughput result or a proof that local service execution has the same finality as on-chain transactions.

No simulated World is proposed. If operational visibility is later requested, use a read-only view of real, privacy-filtered operations, not animated invented activity or a revived graph protocol.

## 13. Recommended delivery sequence and release gates

### Stage A: trust and recovery

Resolve A1–A5 with regressions. Recheck the newly added inbox's grants, decisions, fallback, persistence, and access controls. Complete the release gate and independently verify deployment configuration. Reconcile documentation that now contradicts newer implementation.

Deliver first: accurate states, preflight/commitment preview, persistent operations, key handover/recovery, and counter/collection readiness.

In parallel, complete the bounded x402/MPP comparison in §11 and choose a real repeat-purchase task for the pilot. Research can start now; integrations, outreach and real-money activity still need the appropriate approval.

### Stage B: a coherent daily app

Approve vocabulary/navigation, then improve overview, budget detail, activity, contacts, receipts, and accessible mobile flows. Integrate existing capabilities rather than rebuilding them. Preserve deep links and stored data during migration.

Use §5.4 to limit the first slice. Do not wait for every contact feature, folder or report before testing the useful purchase journey.

### Stage C: repeat use

Bring guided assistant setup into the first assistant pilot. Demonstrate repeat use and completed collection with the same useful seller; then add templates, reminders, task attribution, seller order improvements and exports where observed friction warrants them. Money plans remain optional, non-locking organization, not the acquisition promise.

### Stage D: bounded experiments

Implement a selected compatibility approach only after its earlier research passes the semantic, security and product gates. A converter pilot is a separate later decision with a risk specification, real provider and measurable success criterion. Neither experiment is required to claim the initial native purchase flow works. No mainnet transaction or launch is authorized by this proposal.

### Acceptance checklist

- [ ] A new user can explain who can spend, where, how much, and until when before funding.
- [ ] No balance double-counting or testnet/live ambiguity.
- [ ] Refresh/restart/mobile-wallet return works across approval, issuance, handover, payment, and collection.
- [ ] Lost responses and duplicate requests cannot cause another charge or fulfillment.
- [ ] Maximum-price and offline-exposure limits hold under concurrency.
- [ ] Requests cannot appear funded without the required evidence.
- [ ] Grant revocation is not represented as revoking active certificates.
- [ ] Seller expiry/collection hazards are actionable and tested.
- [ ] Key backup, migration, and private-data sharing have explicit boundaries.
- [ ] Full verification and real-device/accessibility testing pass for the chosen release scope.
- [ ] Live integrations are demonstrated end to end; planned integrations are labelled as planned.
- [ ] Independent security review and legal/partner checks match the intended real-money scope.

No calendar estimate is proposed before choosing scope and confirming engineering capacity. “Now” in the backlog is priority, not a promise of a one-day change.

## 14. Validation and success metrics

Interview and observe a small initial mix of everyday users, assistant users, sellers, and a prospective converter. Suggested starting sample: three from each relevant group, expanding until recurring confusion is understood. This is formative research, not statistically representative market proof.

Ask participants to perform tasks, not merely say whether they like the idea:

- Fund a small budget and explain what they cannot change afterward.
- Recover a interrupted purchase without paying twice.
- Find remaining usable money versus reclaimable funds.
- Let an assistant request funding and explain what revoking its request permission does.
- As seller, distinguish accepted purchases, delivered orders, and collected funds.
- As saver, explain whether a money plan locks funds or pays interest.

Track first completed useful purchase, time to fund/use, abandonment by step, repeat use with the same seller, unknown-outcome resolution time, support cases, duplicate-charge incidents, and seller collection completion before expiry. Separate testnet demos from unrelated real buyers. Use privacy-preserving, opt-in analytics where appropriate; never log keys, grants, or private request content.

Add competitive-fit measures: integration hours, buyer and seller understanding of the commitment, voluntarily repeated purchases versus their existing payment method, unused committed funds over time, successful reclaim, collection net of lifecycle fees, and stated reasons for abandoning the flow. A popular demonstration does not prove merchants accept the economics. Agent request volume does not establish that humans want to fund it.

Working north-star candidate: **repeat users completing useful purchases that are delivered and successfully collected**, measured by cohorts and within the appropriate collection window. Report its components separately so a delivery or collection failure cannot hide inside a single success number. No numerical traction, market-size or performance claim is established by this proposal.

Set numeric conversion/performance targets after baseline measurement. Do not treat requests created, animation speed, repository stars, or signups as evidence of successful commerce.

## 15. Decisions requested, not assumed

| Decision | Recommendation | Review outcome |
|---|---|---|
| D-P01 Product scope | Improve the existing funded-budget product; no new savings/retirement product. | **Approved** (§22.1 P01) |
| D-P02 Core promise | Seller-specific funded budgets: one broad message, concrete examples, no mechanism-exclusivity claim. | **Approved** (§22.1 P02, §22.4) |
| D-P03 Taxonomy | Adopt the shared vocabulary, explicitly amending §21.3 if approved. | **Approved**; amends §21.3/D31 (§22.3) |
| D-P04 Navigation | Test Home/Budgets/Activity/Contacts with clearly discoverable Requests and Collect. | **Revised**: keep current nav for R1; tree-test the four-tab layout first |
| D-P05 Safety work | Prioritize A1–A5 and rerun new-HEAD reproductions before release work. | **Approved**: A1–A5 confirmed in source; release blockers (§22.2) |
| D-P06 Daily-use scope | Prioritize overview, activity, receipts, recovery, contacts, and completion of existing journeys. | **Approved** as release slice R1 (§22.5) |
| D-P07 Planning | Permit non-locking money plans, not savings-account claims. | **Deferred** |
| D-P08 Assistant adoption | Guided setup and compatible services; no implied native subscription billing. | **Approved** (§22.5 i) |
| D-P09 Compatibility | Investigate x402 batch settlement and MPP sessions now; approve the semantic mapping and trust/failure design before building. | **Research only** (§22.7) |
| D-P10 Converter | Explore a named-payee partner flow; no general certificate exchange or guaranteed payout claim. | **Rejected for v1.6** |
| D-P11 Copy | Select a headline and test comprehension before publication. | **Approved with corrections** (§22.4) |
| D-P12 Release | Require fresh verification and explicit authorization for real-money deployment. | **Unchanged** (§0.1) |
| D-P13 First release slice | Approve §5.4 rather than treating all 56 backlog options as launch scope. | **Approved** (§22.5) |
| D-P14 Initial acquisition | Pilot a useful assistant-accessible repeat service, while retaining human use in the same app. | **Approved**; the founder names the pilot seller |
| D-P15 Commitment differentiation | Validate the no-early-close benefit and owner liquidity cost; do not claim a proven moat. | **Approved** as a disclosed trade-off |
| D-P16 Marketing corrections | Separately revise the marketing memo/research before publication; this proposal does not silently approve their conflicting claims. | **Research only**; honesty rules adopted (§22.4) |

Each decision may be approved, revised, deferred, or rejected independently. Approval of copy is not approval of a contract change. Approval of research is not approval of partner outreach, spending, or deployment.

## 16. Final assessment

Flying Money does not need to impersonate Wise, PayPal, Aspire, or Wirex to feel useful. It needs their clarity about amounts, commitments, status, receipts, and recovery around its own narrower capability.

The strongest proposed experience is a single place to fund a seller-specific budget, let the intended person or assistant use it, understand each purchase, and finish collection or reclaim without confusion. That outcome is the position; payment-channel novelty is not. The fixed commitment period is a deliberate trade-off to validate, not a benefit every user will want.

Start with a useful repeat-purchase relationship. Organization makes it easier to live with; standards research may make adoption easier; optional money plans do neither by themselves. Integrations become valuable when they lead to services people actually use, not when they merely add another protocol badge. The potential advantage is execution, acceptance and earned trust, none of which can be declared from a specification alone.

**This remains a proposal. No application change, spec amendment, partnership, financial guarantee, or production-readiness claim is approved by this document.**
