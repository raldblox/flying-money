# UX patterns for delegating spending authority to AI agents, and for spending controls (as of 2026-09-27)

Scope note: this is based on 19 search and fetch calls. Several vendor pages blocked fetching (Mastercard returned 403, Coinbase Help had a TLS error, and Base docs have moved to CDP). Where only search snippets or secondary explainers were available, that is flagged. "Shipped" means a production feature you can use today. "Announced/pilot" means a press release, spec, or limited pilot.

## Q1. How do shipped and announced products design agent payment consent and limits?

### Takeaway
The industry has converged on one mental model: **a human creates a scoped, time-boxed, revocable grant up front. The agent spends inside it without per-transaction prompts. Anything outside it either auto-declines or escalates to a human.** The grant is scoped by amount per transaction and/or per period, merchant or category, and expiry. Flying Money's certificate (one seller, one spender, one end date, fixed locked amount) is a stricter, fully pre-funded version of that model. Its narrowness is a UX strength because the approval screen can be read in one glance.

### Cited Findings

**Google AP2 (Agent Payments Protocol). Open spec, announced Sept 2025, an extension to A2A with "more integrations in progress" (spec/announced; no consumer UI of its own)**
- Two consent modes. **Human-present**: the user reviews and cryptographically signs a **Cart Mandate** covering "the exact items and price." **Human-not-present**: the user signs an **Intent Mandate** up front, giving the agent "authority to execute a transaction within defined constraints" — [AP2 protocol site](https://ap2-protocol.net/en/); [Google Cloud blog](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)
- Secondary explainers say the Intent Mandate carries a price cap, time window, merchant allowlist, item spec and "prompt playback" (a natural-language restatement of the user's intent the merchant can show back). I could not verify prompt playback on the primary site fetched — [Eco explainer](https://eco.com/support/en/articles/14845479-ap2-agent-payments-protocol-explained); [Goh Soon Heng, Medium](https://gohsoonheng00.medium.com/the-missing-trust-layer-a-deep-dive-into-the-agent-payments-protocol-ap2-and-verifiable-mandates-4cd2a1674316)
- A three-mandate chain (Intent → Cart → Payment) is described as a "non-repudiable audit trail of who authorized what, within what limits" — [Eco explainer](https://eco.com/support/en/articles/14845479-ap2-agent-payments-protocol-explained)
- FIDO Alliance positions passkeys as the signing and "verifiable intent" layer for AP2 mandates — [FIDO Alliance](https://fidoalliance.org/building-the-trust-layer-for-agentic-payments-with-ap2-and-verifiable-intent/)

**Visa Intelligent Commerce (VIC). APIs and a partner program. First "secure agentic transactions" completed with partners late 2025. APAC/Europe pilots planned for early 2026 (pilot/partial)**
- Marketing claims consumers can "set spending limits, specify merchant categories, and even require real-time approval for certain transactions." Data sharing is consent-managed via "data tokens" — [VentureBeat](https://venturebeat.com/ai/visa-launches-intelligent-commerce-platform-letting-ai-agents-swipe-your-card-safely-it-says); [Visa solution page](https://www.visa.com/en-us/solutions/intelligent-commerce)
- Visa predicted "millions of consumers" would use agents to buy by the 2026 holiday season. APAC and Europe pilots were set for early 2026 — [Visa press release](https://usa.visa.com/about-visa/newsroom/press-releases.releaseId.21961.html); [Asian Banker](https://www.theasianbanker.com/press-releases/visa-expands-visa-intelligent-commerce-in-asia-pacific-prepares-2026-ai-pilot)
- Separately, Visa has a "Visa Intelligent Commerce Connect" / business-facing launch — [Visa press release 22276](https://usa.visa.com/about-visa/newsroom/press-releases.releaseId.22276.html); [AI Economy substack](https://theaieconomy.substack.com/p/visa-intelligent-commerce-connect-agentic-shopping)

**Mastercard Agent Pay. Agentic Tokens plus Payment Passkeys plus "Verifiable Intent" (2026). Reported live in Singapore and Malaysia (live in some markets)**
- Agentic tokens "can carry task-specific authority and be restricted by agent, merchant, category, spending limit, timeframe or usage rules" — [Mastercard agentic token framework](https://www.mastercard.com/global/en/news-and-trends/stories/2025/agentic-commerce-framework.html)
- Per-agent tokens: one card can hold separate tokens for ChatGPT, Gemini and Perplexity, each with its own scope such as "groceries only," "$500 monthly cap," or "weekdays only." This is a secondary source — [Stellagent](https://stellagent.ai/insights/mastercard-agent-pay-agentic-tokens)
- Verifiable Intent "links identity, intent, and action into a single, privacy-preserving record": which cardholder authorized, what the instructions were, and the agent-merchant interaction. It uses selective disclosure — [Mastercard Verifiable Intent (2026)](https://www.mastercard.com/us/en/news-and-trends/stories/2026/verifiable-intent.html) (page returned 403 to the fetcher, so this is a search-snippet quote)
- Live deployment reported in Singapore and Malaysia — [Yahoo Finance](https://finance.yahoo.com/markets/crypto/articles/mastercard-goes-live-agentic-payments-100104227.html). An Aug 2026 Mastercard "Signals" report on building trust for agentic commerce exists — [Mastercard newsroom](https://www.mastercard.com/news/eemea/en/newsroom/press-releases/en/2026/august/building-trust-for-agentic-commerce-mastercard-signals-report-explores-the-path-forward/) (not read in full)

**OpenAI ChatGPT Instant Checkout / ACP (shipped Sept 2025, retired March 2026)**
- It launched Sept 2025 with Stripe on the Agentic Commerce Protocol. The user taps "Buy" and confirms shipping and payment in the chat — [OpenAI](https://openai.com/index/buy-it-in-chatgpt/); [Stripe newsroom](https://stripe.com/newsroom/news/stripe-openai-instant-checkout)
- **It was retired in about March 2026.** OpenAI's quoted reason: "the initial version of Instant Checkout did not offer the level of flexibility that we aspire to provide, so we're allowing merchants to use their own checkout experiences while we focus our efforts on product discovery." Secondary sources, consistent with each other — [Hypotenuse](https://www.hypotenuse.ai/blog/chatgpts-instant-checkout-the-next-phase-of-agentic-commerce); [Exploding Topics](https://explodingtopics.com/blog/agentic-commerce-protocol)

**Stripe + Tempo Machine Payments Protocol (MPP). Announced 18 Mar 2026 with Tempo mainnet (shipped as a protocol and in Stripe docs)**
- A "session" primitive: the agent authorizes a spending cap once, then streams micropayments per call without an on-chain transaction for each one. When the cap is reached it opens a new session or stops. Credentials are scoped by merchant, time and amount — [Stripe MPP docs](https://docs.stripe.com/payments/machine/mpp); [The Defiant](https://thedefiant.io/news/blockchains/tempo-launches-mainnet-unveils-machine-payments-protocol-with-stripe); [WorkOS x402 vs MPP](https://workos.com/blog/x402-vs-stripe-mpp-how-to-choose-payment-infrastructure-for-ai-agents-and-mcp-tools-in-2026)

**Coinbase / Base Account Spend Permissions (shipped)**
- A grant is: token, allowance per recurring period (for example "10 USDC / month"), period duration, and start and end time. Usage resets to zero each period. The app shows it to the user as an `eth_signTypedData` popup to approve or reject — [coinbase/spend-permissions GitHub](https://github.com/coinbase/spend-permissions); [Coinbase Help](https://help.coinbase.com/en/wallet/getting-started/smart-wallet-permissions)
- Revocation: the user can revoke at any time. An app can call `requestRevoke` to pop a wallet revoke dialog, or the spender can revoke silently via `prepareRevokeCallData`. The Coinbase Smart Wallet supports ERC-7715 `wallet_grantPermissions` — [search summary of Base docs / GitHub](https://github.com/coinbase/spend-permissions). (Base docs have moved to docs.cdp.coinbase.com, so the popup screenshots were not retrieved.)

**MetaMask Advanced Permissions (ERC-7715) in the Smart Accounts Kit / Delegation Toolkit (shipped as "Advanced Permissions"; earlier versions were marked experimental)**
- Example grant: "spend 10 USDC per day … over the course of a month." Permission types include ERC-20 periodic and native-token permissions. The wallet shows "a rich UI including the start time, amount, and period duration" — [MetaMask docs](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/); [MetaMask news](https://metamask.io/news/introducing-advanced-permissions)
- **The user can edit the requested parameters** ("The user can modify the permission parameters if the request is configured to allow adjustments"). This is the counter-offer pattern — [MetaMask docs](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/)
- ERC-7715 defines the purpose as "a scoped, time-bounded delegation … so that subsequent actions can run without a per-transaction popup" — [Eco ERC-7715 explainer](https://eco.com/support/en/articles/11953354-erc-7715-explained-wallet-permissions-sessions-and-subscriptions)

**Ramp Agent Cards (launched March 2026, shipped)**
- A human admin creates the agent identity, optionally with a role ("Purchasing," "Bill approvals," "Data analysis"). The admin then assigns a fund with a monthly budget, per-transaction cap, merchant and category rules, and approval chains. **"The agent can't bypass or raise its own limit."** — [agents.ramp.com/cards](https://agents.ramp.com/cards); [Ramp blog](https://ramp.com/blog/virtual-cards-for-ai-agents)
- **The agent requests a credential per purchase** with fund_id, merchant name, URL and country, amount, and a **rationale** field. The credential is "limited to the merchant and requested amount. It expires after the first authorization or 12 hours, whichever comes first." The agent then uploads the receipt and fills in memo and accounting fields — [agents.ramp.com/cards](https://agents.ramp.com/cards)
- Amounts in the API are in minor units ("`10000` means $100.00") — [agents.ramp.com/cards](https://agents.ramp.com/cards)
- Authorization checks: spend cap (per transaction or cumulative), MCC allowlist, velocity (transactions per window), and geofence. Any failure auto-declines — [Ramp blog](https://ramp.com/blog/virtual-cards-for-ai-agents); [PYMNTS](https://www.pymnts.com/news/artificial-intelligence/2026/ai-agents-just-got-their-own-company-credit-cards/)

**Apple "Ask to Buy" (shipped for years; the canonical request→approve pattern)**
- The parent gets a notification stating **who is asking, what the item is, and what it costs**. On a Mac it opens a Family pop-up with Approve and Decline. On iPhone the buttons are "Approve" top-left and "Deny" top-right. Approval completes the download on the child's device, and the child is notified of a decline. Missed requests are also summarised in Messages — [Apple Support 105055](https://support.apple.com/en-us/105055); [Apple Mac guide](https://support.apple.com/en-au/guide/mac-help/mh4fbc04939b/mac)

### Inferences
- Across AP2, Mastercard, Coinbase, MetaMask, Ramp and MPP, a grant always has the same core fields: **who can spend (agent identity), how much (cap per transaction and/or per period), where (merchant or category), until when (expiry), and a revoke path**. Flying Money's certificate fields line up with these: seller = merchant allowlist of one; spender key = agent token; end date = expiry; locked amount = cumulative cap. The UI should say this explicitly with a 4-line summary: "Up to 50 USDC · at shop.example · by Agent X · until 12 Oct."
- Flying Money has no per-period reset. That makes a single "spent / remaining / time left" meter enough, unlike Coinbase or MetaMask, which have to explain resetting windows. Leftovers returning after expiry map to the familiar "unused balance comes back" story. Show that as a line on the meter ("Unspent 12.40 returns to you on 12 Oct").
- The ChatGPT Instant Checkout retirement suggests that fully in-chat checkout for arbitrary retail was hard to make flexible enough. Pre-funded, narrow budgets for API or service spend (MPP sessions, Ramp per-merchant credentials) are where agent spending is shipping. Flying Money sits in that second category.
- Ramp's "rationale" field and per-purchase request are a close match to Flying Money's Requests feature. Consider requiring a free-text "why" plus merchant and amount on every agent request, and showing it on the owner's review card.
- MetaMask letting users edit requested parameters suggests the owner's review screen should allow counter-offers: lower the amount or shorten the end date before approving.

### Gaps
- I could not get screenshots or exact copy for Visa's consumer-side limit-setting UI or Mastercard's consumer enrollment UI. Both appear to live inside issuer or bank apps and agent apps, not network-owned screens.
- I could not confirm whether AP2's "prompt playback" is in the current primary spec.
- I did not research Privy or Turnkey policy engines, Brex agent cards, or Apple Pay / Google Wallet agent features for lack of budget. Treat them as uncovered.
- Coinbase's permission-management settings screen was not retrieved because the page failed a TLS check and the docs have moved.

## Q2. What does HCI and human-AI interaction research say about delegation, trust calibration, approval fatigue and explainability?

### Takeaway
Users calibrate trust **per task and per action type, not per agent**. They want confirmation specifically for **irreversible, externally visible** actions, and they regret an agent acting beyond what they would have authorized more than they regret errors. Too much checking defeats the point of delegating. The design answer is to **pre-authorize well-scoped envelopes and interrupt only at the boundary**.

### Cited Findings
- "Delegation regret": in a 20-participant study with the open-source agent OpenClaw, users were dissatisfied when agents "executed actions without preview, even when the output was rated as successful." Participants "granted wide autonomy for advisory and low-stakes tasks but demanded confirmation for irreversible, externally visible actions." Sending email caused the sharpest trust drop (M=3.10) and the highest demand for approval (M=4.65). **Irreversibility and external visibility, more than stakes, drove trust withdrawal.** Recommendations: action-boundary displays, preview-before-execution, per-task autonomy policies, activity logs for side effects, and visual separation of advisory output from execution. Caveats: arXiv preprint, May 2026, small student sample — [arXiv 2607.18257](https://arxiv.org/html/2607.18257)
- CHI 2025 "Plan-Then-Execute" study of LLM agents as daily assistants frames the tension this way: "too much user involvement to check and control AI outcomes is undesirable as it goes against the premise that AI systems are introduced to reduce human workload" — [ACM DL, CHI 2025](https://dl.acm.org/doi/full/10.1145/3706598.3713218)
- Microsoft's 18 Guidelines for Human-AI Interaction (CHI 2019) that apply here include: make clear what the system can do; support efficient invocation, **dismissal**, and **correction**; **scope services when in doubt** (disambiguate or degrade gracefully); and make clear why the system did what it did — [Amershi et al., CHI 2019](https://dl.acm.org/doi/fullHtml/10.1145/3290605.3300233); [Microsoft Learn](https://learn.microsoft.com/en-us/training/modules/introduction-to-microsofts-responsible-ai-approach/3-use-guidelines-for-human-ai-interaction)
- Practitioner guidance repeats the same pattern language: per-action overrides, pause/undo, policy-based permissions, audit logs, and prominent cancel or turn-off controls. A widely repeated stat — "63% of users are more likely to rely on AI systems that display confidence levels or explain their reasoning" — is attributed to NN/g, but the only source I found is secondary and I could not trace it to a primary NN/g study, so treat it as unverified — [UXmatters](https://www.uxmatters.com/mt/archives/2025/11/the-design-psychology-of-trust-in-ai-crafting-experiences-users-believe-in.php); [Gökhan Meriç](https://www.gokhanmeric.com/blog/designing-for-ai-agents-ux-principles-autonomous-systems/)
- Consumers are cautious: a snippet reports "only 30 percent of consumers would allow an AI agent to complete a purchase on their behalf." The originating survey is unclear, from a secondary aggregator — [nhimg.org](https://nhimg.org/articles/ai-shopping-agents-expose-a-trust-gap-in-autonomous-commerce/); [Checkout.com blog](https://www.checkout.com/blog/how-to-build-consumer-trust-in-ai-agents)

### Inferences
- For Flying Money, the irreversible step is **locking funds** (issuing the certificate), not each slip. The design should put the confirmation weight on the issue wizard's final review. After that, slips inside the envelope need no per-payment prompt, only visibility (a feed and a meter). This is the "interrupt at the boundary" model the research supports.
- The "delegation regret" finding supports showing, before signing, **exactly what the spender can and cannot do**: "can pay only shop.example," "cannot exceed 50 USDC," "cannot spend after 12 Oct," "you cannot claw back mid-period" (if true). That last point is the one users would regret not knowing.
- The dismissal and correction guidelines translate here to: requests from agents need a one-tap Decline that is as prominent as Approve, and the owner should be able to edit (lower) the amount or date.

### Gaps
- I found no primary NN/g article specifically on agent spending or payment consent, and I didn't retrieve Google PAIR Guidebook chapters. Both need a direct fetch.
- There are no CHI or CSCW 2025–2026 papers specifically on consent fatigue for agent payments. The approval-fatigue evidence above comes from general agent studies.

## Q3. Which patterns work for budget meters, per-transaction ceilings, activity feeds, notifications, revoke or kill switch, and expiry?

### Takeaway
The proven set is: **a remaining-balance meter with a time component, hard ceilings enforced below the UI (auto-decline rather than "are you sure"), per-spend receipts with a rationale, real-time notifications, and a single revoke control.** Periodic grants must also explain resets.

### Cited Findings
- **Hard ceilings enforced below the UI:** Ramp auto-declines on cap, MCC, velocity or geofence failures, and the agent cannot raise its own limit — [Ramp blog](https://ramp.com/blog/virtual-cards-for-ai-agents). MPP sessions stop at the cap and require a new session — [The Defiant](https://thedefiant.io/news/blockchains/tempo-launches-mainnet-unveils-machine-payments-protocol-with-stripe)
- **Period meters:** Coinbase spend permissions track usage per period and reset it to zero in each new period. MetaMask's approval card shows start time, amount and period — [coinbase/spend-permissions](https://github.com/coinbase/spend-permissions); [MetaMask docs](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/)
- **Receipts and activity:** Ramp requires agents to attach receipts and memos after each transaction — [agents.ramp.com/cards](https://agents.ramp.com/cards). Mastercard Verifiable Intent records instruction → agent → merchant for disputes — [Mastercard](https://www.mastercard.com/us/en/news-and-trends/stories/2026/verifiable-intent.html). The delegation-regret study recommends activity logs for side effects — [arXiv 2607.18257](https://arxiv.org/html/2607.18257)
- **Revoke:** Coinbase supports user-initiated revoke via a wallet popup (`requestRevoke`) and spender-initiated silent revoke — [Coinbase GitHub/docs](https://github.com/coinbase/spend-permissions)
- **Single-use and short-lived credentials** reduce the need for monitoring: Ramp credentials expire after the first authorization or 12 hours — [agents.ramp.com/cards](https://agents.ramp.com/cards)
- **Notifications with who, what and cost:** Apple Ask to Buy — [Apple Support](https://support.apple.com/en-us/105055)

### Inferences (screen-level suggestions for Flying Money)
- **Budget card (budgets list):** seller name and domain; spender label (agent name or device); a meter showing "Spent 37.60 / 50.00 USDC" from the latest slip's running total; a countdown ("ends in 3 days · 12 Oct 18:00 your time"); and a status chip (Active / Nearly used / Expired – returning 12.40 / Returned). Amounts come from bigint base units formatted at display only.
- **Detail view activity feed:** one row per slip (time, increment, running total), with the "what each slip adds" labelling already used in the demo. Mark whether the seller has redeemed.
- **Revoke honesty:** Flying Money's contract has no admin and leftovers return only after expiry. If there is no early-revoke path, the UI must not show a "kill switch" that implies instant clawback. Better: "Stop this spender" with an honest explanation. The fallback is short end dates and small amounts, both set in the wizard. The kill-switch patterns elsewhere (Coinbase revoke, Ramp card freeze) work because a custodian or permission manager can refuse future spends. The fact that Flying Money can't do this should be explained where the owner commits, not discovered later.
- **Expiry communication:** show the end date in absolute local time plus a relative time. Send a notification before expiry and at expiry ("12.40 USDC is back in your wallet"). Suggested thresholds are unsourced.
- **Nearly-used threshold:** notify the owner at around 80% spent and prompt a "top up / issue another" action. There is no source for 80%; it is a common product heuristic.

### Gaps
- There is no published quantitative evidence on optimal notification thresholds or on meter visualisations for agent budgets specifically.

## Q4. How should agent-to-human budget requests be presented, and what are the consent pitfalls?

### Takeaway
The best analogues are **Apple Ask to Buy** (who, what, cost, Approve/Decline, requester notified of the outcome), **Ramp agent credential requests** (merchant, amount and a required rationale, bound to a fund the human pre-set), **MetaMask's editable permission requests**, and **MCP elicitation's rules**: requester identity is visible, decline and cancel are distinct, and the user can review and edit before sending. Pitfalls are consent fatigue, vague scopes, and link and URL spoofing.

### Cited Findings
- MCP elicitation (spec 2025-11-25) requires clients to "provide UI that makes it clear which server is requesting information," provide "clear decline and cancel options," let users "review and modify their responses before sending," and, for URL mode, "clearly display the target domain/host and gather user consent before navigation." Responses are a three-way accept / decline / cancel — [MCP spec: Elicitation](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation)
- The same spec: servers "MUST NOT use form mode elicitation to request … payment credentials" and "MUST use URL mode" for sensitive interactions including payments. Clients "MUST show the full URL … before consent," "MUST NOT open the URL without explicit consent," and should highlight the domain and warn on Punycode. Servers must bind the elicitation to the same user to prevent phishing where an attacker forwards the link to a victim. Clients "SHOULD implement rate limiting" — [MCP spec: Elicitation](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation)
- Ramp's agent request payload requires merchant, amount, currency and a rationale — [agents.ramp.com/cards](https://agents.ramp.com/cards)
- Apple Ask to Buy shows who, what and cost, and notifies the requester on decline — [Apple Support](https://support.apple.com/en-us/105055)
- MetaMask lets the user adjust requested permission parameters — [MetaMask docs](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/)

### Inferences
- **Request review card for Flying Money (owner inbox):** requester (agent name + spender key fingerprint + "via Claude / MCP"); seller (name + highlighted domain); amount requested; end date; rationale in the agent's words, visually set apart as *claimed*, not verified; and a notice that "This locks X USDC until <date>; unspent returns then." Actions: **Approve** (goes into the issue wizard prefilled and editable), **Edit & approve** (lower the amount or shorten the date), and **Decline** with equal prominence. Notify the agent of the outcome.
- **Anti-fatigue:** rate-limit requests per spender, collapse duplicates, and show "this agent has asked 3 times today." Never auto-approve from the request screen. The funds-locking signature is the irreversible step and deserves a deliberate confirm.
- **Anti-dark-pattern:** don't let the agent's rationale text style itself as system UI. Render it as quoted plain text. Don't preselect the largest amount. Consider defaulting the end date to the shortest option offered.
- **Anti-phishing:** a request link opened from chat must show the Flying Money domain and require the owner to be signed in as the same owner. The MCP URL-mode phishing scenario applies directly to "agent sends owner a link to approve a budget."

### Gaps
- I did not retrieve GitHub App permission screens or OAuth consent-screen research. These are well-known patterns but uncited here.
- There is no empirical study of agent-initiated budget requests specifically.

## Q5. How is spending surfaced inside chat (MCP Apps, OpenAI Apps SDK, elicitation)?

### Takeaway
Inside chat, keep spend UI **small and single-purpose** (an inline card with at most two actions), and move anything sensitive (signing, funding, credentials) **out of band via URL-mode elicitation** to the owner's trusted web app. Rich in-chat approval UIs through MCP Apps are still a proposal.

### Cited Findings
- OpenAI Apps SDK UI guidelines define display modes: inline card, inline carousel (3–8 items), fullscreen, and picture-in-picture. Cards support "up to two actions maximum, with one primary CTA and one optional secondary CTA," with no deep navigation or nested scrolling. The guidelines don't address payments explicitly — [OpenAI Apps SDK UI guidelines](https://developers.openai.com/apps-sdk/concepts/ui-guidelines)
- MCP elicitation form mode is limited to flat schemas of primitives (string, number, boolean, enum), with defaults the client should prefill. It must not be used for payment credentials. URL mode (added 2025-11-25) is for payments and auth, and completion is signalled by `notifications/elicitation/complete` — [MCP spec](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation)
- "Rich UI elicitation," which would attach an MCP App to an `elicitation/create` request, is an open proposal (ext-apps issue #511, SEP-1865 MCP Apps draft), not shipped — [GitHub ext-apps #511](https://github.com/modelcontextprotocol/ext-apps/issues/511)
- Client support for URL mode varies. For example, a Kiro issue requests support for spec 2025-11-25 URL mode — [Kiro issue #4785](https://github.com/kirodotdev/Kiro/issues/4785); see also [WorkOS on URL mode](https://workos.com/blog/mcp-url-mode-elicitation); [Vercel form vs URL mode](https://vercel.com/i/mcp-elicitation-form-vs-url-mode)

### Inferences
- **For the Flying Money MCP server:**
  1. When an agent has no budget, use a URL-mode elicitation to the web app's request or issue page. The message should say "Ask <owner> for a budget at flying-money.example," and the owner signs there, never in chat.
  2. Use form mode only for non-sensitive choices, such as picking which of several active budgets to use, or confirming a purchase description.
  3. Show a compact inline card after each payment: seller · paid 2.50 · running total 37.60/50.00 · ends 12 Oct. Offer at most one secondary action, such as "View budget."
  4. Always handle decline and cancel distinctly: decline means the owner said no, so don't re-ask immediately; cancel means ask again later.
- Clients differ in support, so the MCP tools should also degrade to returning a plain URL in text. Warn in the text never to paste keys into chat.

### Gaps
- I did not verify what Claude's current client UI shows for elicitation or URL mode, or whether Claude supports MCP Apps UI as of Sept 2026. That needs direct checking.
- The OpenAI Apps SDK guidance has no payment-specific rules, and no official agentic-checkout component guidance was found after the Instant Checkout retirement.
