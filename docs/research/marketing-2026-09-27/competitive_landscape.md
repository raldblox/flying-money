# Competitive Landscape and Category Narratives: AI-Agent Payments and Spending Controls (as of 2026-09-27)

Source-quality note: primary sources (Coinbase, Circle, Tempo, Stripe, OpenAI, Cloudflare, Lightning Labs, a16z, Morgan Stanley, Chainalysis, TechCrunch, CoinDesk) are marked as such by URL. Several facts come only from secondary explainers (eco.com support articles, dev.to posts, web3trackers, agenteconomy.to); these are flagged "(secondary)" and should be spot-checked before external use. Searches were run on 2026-09-27; fetched pages were read the same day.

## 1. Protocols and standards: what exists, what is live, how each frames the problem

### Takeaway
By Sept 2026 the category has split into (a) **card-network / checkout rails** (Visa Intelligent Commerce + TAP, Mastercard Agent Pay, OpenAI/Stripe ACP, Google AP2), which frame the problem as *trust, consent and identity* for human-scale shopping, and (b) **crypto/stablecoin machine-payment rails** (x402, Tempo MPP, Circle Nanopayments, L402), which frame it as *per-request micropayments without per-request cost*. The single closest design to Flying Money is **Tempo/Stripe's MPP "sessions"**: escrowed deposit, cumulative off-chain vouchers verified locally, one settlement transaction, unused funds refunded. That design went live on Tempo mainnet in March 2026 with Stripe/Paradigm backing.

### Cited Findings

**Coinbase x402 (live; Base, Solana and others)**
- x402 Foundation launched by Coinbase and Cloudflare to standardize payment negotiation between websites and agents over HTTP 402 — [The Block](https://www.theblock.co/post/372064/cloudflare-coinbase-launch-x402-foundation); [Coinbase blog](https://www.coinbase.com/blog/coinbase-and-cloudflare-will-launch-x402-foundation)
- Cloudflare proposed a **deferred** payment scheme for x402 (session-based aggregation of many small requests, settlement at the end of a period, e.g. daily batch) — [The Block](https://www.theblock.co/post/372064/cloudflare-coinbase-launch-x402-foundation); [Cloudflare blog](https://blog.cloudflare.com/x402)
- An experimental **"upto"** consumption-metered scheme exists in the reference repo; motivation stated as: at $0.0001/call gas becomes a meaningful share of spend — (secondary) [PolicyLayer glossary](https://policylayer.com/glossary/x402-payment-streaming). Status of "upto" as of Sept 2026 not confirmed from x402.org (gap).
- Traction, Dec 2025: 75M transactions, ~$24M in paid calls — (secondary) [Eco](https://eco.com/support/en/articles/14839402-x402-protocol-explained)
- Late April 2026: Coinbase reported 69,000 active agents, 165M transactions, ~$50M cumulative volume, alongside launch of the **Agent.market** directory — (secondary) [DEV Community](https://dev.to/t49qnsx7qtkpanks/x402-hit-165-million-transactions-heres-what-it-still-cant-do-4f4d)
- July 19, 2026: 157.4M cumulative on-chain x402 transactions, $41.06M stablecoin volume, 7 chains, 18 tracked facilitators — (secondary tracker) [web3trackers x402 dashboard](https://www.web3trackers.com/x402-dashboard). NOTE: conflicts with the "~$50M / 165M" Coinbase-reported figure above; counts differ by methodology/source.
- CoinDesk (Mar 11, 2026): ~$28,000 daily volume, ~131,000 daily transactions, average payment ~$0.20, and **roughly 50% of activity "gamed"**; analyst quote: "The x402 'agent payments' boom is still mostly a mirage." — [CoinDesk](https://www.coindesk.com/markets/2026/03/11/coinbase-backed-ai-payments-protocol-wants-to-fix-micropayment-but-demand-is-just-not-there-yet)
- Chainalysis (June 3, 2026): 100M+ cumulative x402 transactions on Base; transactions of $1+ grew from 49% to 95% of volume (early 2025 to early 2026), 10c–$1 fell from 46% to 4%; a single meme coin (PING) drove 150k+ transactions in its first month; weekly retention peaked at 87% during PING then fell to 5%; tester-to-payer conversion improved 4x in six months; "mass adoption remains distant" — [Chainalysis](https://www.chainalysis.com/blog/x402-agentic-payments-adoption/)
- Bitcoin Lightning support being added to x402 (post dated 2026-09-25) — [Ken Ashe blog](https://kenashe.ai/blog/2026-09-25-bitcoin-lightning-joins-x402-and-agent-payments-get-a-little-more-real) (secondary; not verified against primary)

**Tempo + Stripe Machine Payments Protocol (MPP) — live, closest analogue**
- Tempo (Stripe + Paradigm) mainnet launched March 18, 2026 with MPP, "lets software programs make payments on their own"; testnet participants included Mastercard, UBS, Klarna, Visa — [CoinDesk](https://www.coindesk.com/tech/2026/03/18/stripe-led-payments-blockchain-tempo-goes-live-with-protocol-for-ai-agents)
- Launch partners reported as Anthropic, OpenAI, DoorDash, Mastercard, Nubank, Revolut, Shopify, Standard Chartered; payments directory with 100+ services; gas < 1 cent paid in stablecoins, no volatile native token; Stripe, Visa and Lightspark extended MPP to cards, wallets and Lightning — [The Defiant](https://thedefiant.io/news/blockchains/tempo-launches-mainnet-unveils-machine-payments-protocol-with-stripe); [crypto.news](https://crypto.news/stripe-and-paradigms-tempo-mainnet-goes-live-for-machine-payments/)
- **MPP sessions (Apr 2, 2026)**: "exactly two onchain transactions" (open + settle); funds "locked onchain in an escrow contract at session start"; vouchers are signed off-chain messages of cumulative claimable amount ("each voucher replaces the previous one"); server verifies locally; on close "any unused funds from the original deposit are released back to the agent's wallet"; one payer to one payee — [Tempo blog: MPP Sessions](https://tempo.xyz/blog/mpp-sessions/)
- Sessions support mid-stream **top-up** (server emits payment-need-voucher, client signs new voucher) and SSE per-token charging via `mppx` client — [Tempo docs](https://docs.tempo.xyz/guide/machine-payments/streamed-payments)
- Forrester framed Stripe Sessions 2026 as "rearchitecting payments for an agentic AI economy" — [Forrester](https://www.forrester.com/blogs/stripe-sessions-2026-stripe-is-rearchitecting-payments-for-an-agentic-ai-economy/)

**Circle Nanopayments / Gateway + Agent Stack — live on mainnet**
- Circle Agent Stack announced May 11, 2026: Circle CLI, Agent Wallets, Agent Marketplace, Nanopayments — [Circle press](https://www.circle.com/pressroom/circle-launches-ai-infrastructure-to-power-the-agentic-economy)
- Nanopayments: gas-free USDC transfers down to $0.000001; buyers sign off-chain authorizations, Gateway batches and settles **net positions** in bulk; live on mainnet on Ethereum, Arbitrum, Base, Optimism, Polygon, Avalanche, Sei, Sonic, Unichain, HyperEVM, World Chain — [Circle blog (mainnet)](https://www.circle.com/blog/nanopayments-powered-by-circle-gateway-is-now-live-on-mainnet); [Circle docs](https://developers.circle.com/gateway/nanopayments)

**Google AP2 (Agent Payments Protocol) — open spec; v0.2**
- Announced Sept 16, 2025 with 60+ partners (PayPal, Mastercard, Amex, Adyen, Coinbase, Salesforce, Worldpay, Etsy etc.); cryptographically signed "mandates" (Intent/Cart) built on W3C Verifiable Credentials; payment-method agnostic — (secondary) [Eco AP2](https://eco.com/support/en/articles/15192002-ap2-protocol-explained-google-s-agentic-commerce-standard-2026)
- AP2 v0.2 (April 2026) added "Human Not Present" mode for fully autonomous purchases (announced via FIDO Alliance blog) — (secondary) [Eco AP2](https://eco.com/support/en/articles/15192002-ap2-protocol-explained-google-s-agentic-commerce-standard-2026); [Tom Wang](https://tomcn.uk/news/2026-04-03-google-ap2-agentic-payment-protocol-stack)
- Framing: a "verifiable, cryptographically signed permission slip from a human before it can spend" — i.e., consent/authorization, not settlement.

**OpenAI + Stripe Agentic Commerce Protocol (ACP) / Instant Checkout — pivoted**
- Original launch: Stripe powers Instant Checkout in ChatGPT, ACP co-developed with OpenAI — [Stripe newsroom](https://stripe.com/newsroom/news/stripe-openai-instant-checkout); [OpenAI](https://openai.com/index/buy-it-in-chatgpt/)
- OpenAI ended Instant Checkout March 24, 2026; merchants use their own checkout, OpenAI focuses on discovery; reportedly only ~a dozen Shopify merchants shipped with near-zero sales — [Digital Commerce 360](https://www.digitalcommerce360.com/2026/03/06/openai-shifts-checkout-plans-agentic-commerce-strategy/); [Checkout.com](https://www.checkout.com/blog/openai-agentic-commerce-shift) (merchant count is secondary)
- June 10, 2026: Visa Intelligent Commerce integrated into OpenAI experiences — tokenized Visa credentials, real-time authorization, **user-defined guardrails (spend cap, merchant categories, human approval)**; in-chat buying relaunched for Shopify brands (Glossier, SKIMS, Spanx, Vuori) and Etsy — [Digital Commerce 360](https://www.digitalcommerce360.com/2026/06/12/visa-openai-agent-led-payments/)
- ACP spec Apache 2.0 on GitHub; last stable 2026-04-17 — (secondary) [Verity Score](https://verityscore.io/en/kb/acp-agentic-commerce-protocol/)

**Visa Intelligent Commerce / Trusted Agent Protocol; Mastercard Agent Pay — live in pilots/markets**
- Mastercard Agent Pay launched Apr 29, 2025; Visa Intelligent Commerce Apr 30, 2025; Visa TAP Oct 14, 2025 — (secondary) [Eco comparison](https://eco.com/support/en/articles/15192003-mastercard-agent-pay-vs-visa-trusted-agent-2026-compared)
- Mastercard "Agentic Tokens" bind a tokenized card to a specific agent, merchant scope and consent policy; live authenticated agentic transactions in Hong Kong (Mar 27) and Thailand (Apr 7) — (secondary) [Eco Agent Pay](https://eco.com/support/en/articles/15192001-what-is-mastercard-agent-pay-ai-agent-commerce-protocol-in-2026)
- Visa + Inflow "Visa cards for AI agents" (May 2026) — [Forbes](https://www.forbes.com/sites/johnkoetsier/2026/05/08/visa-cards-for-ai-agents-visa-and-inflow-enable-agentic-payments/); Visa single integration for agent payments — [TechInformed](https://techinformed.com/visa-opens-one-integration-for-ai-agent-payments/)

**Cloudflare pay-per-crawl -> pay-per-use**
- Pay per crawl (July 2025): publishers set a per-request price for AI crawlers enforced at edge with HTTP 402 — [Cloudflare blog](https://blog.cloudflare.com/introducing-pay-per-crawl/)
- July 2026: Cloudflare moved toward "pay per use" (compensation when content appears in AI answers) and set a Sept 15, 2026 default blocking training/agent crawlers on ad-supported pages — [TechCrunch](https://techcrunch.com/2026/07/01/cloudflares-new-policy-pushes-ai-companies-to-pay-for-publishers-content/); Stack Overflow is a pay-per-crawl adopter — [Stack Overflow blog](https://stackoverflow.blog/2026/02/19/stack-overflow-cloudflare-pay-per-crawl/)

**L402 / Lightning**
- Lightning Labs positions L402 as "the internet-native payments protocol for agents" (Mar 11, 2026); released Lightning Agent Tools (seven skills: pay L402 APIs, host paid endpoints) — [Lightning Labs](https://lightning.engineering/posts/2026-03-11-L402-for-agents/); [Lightning Labs Feb 2026](https://lightning.engineering/posts/2026-02-11-ln-agent-tools/); dedicated L402 site launched Jul 29, 2026 — [The Defiant](https://thedefiant.io/news/infrastructure/lightning-labs-launches-site-for-l402-bitcoin-agent-payments); [l402.tech](https://l402.tech/)

**Wallet-level spend permissions (ERC-7715, Coinbase Spend Permissions, session keys)**
- Coinbase Spend Permissions: a designated spender can spend tokens from a smart account within token/amount/**recurring period** limits (e.g. 10 USDC/month); docs name agentic payments as a use case — [Coinbase docs](https://docs.cdp.coinbase.com/server-wallets/v2/evm-features/spend-permissions); [GitHub](https://github.com/coinbase/spend-permissions)
- Coinbase Agentic Wallets launched Feb 11, 2026: MPC wallets with session caps, spend limits, native x402 — (secondary) [Eco](https://eco.com/support/en/articles/14845485-coinbase-agentic-wallets-explained)
- ERC-7715 (`wallet_grantPermissions`) still draft as of April 2026 — (secondary) [Eco ERC-7715](https://eco.com/support/en/articles/11953354-erc-7715-explained-wallet-permissions-sessions-and-subscriptions)

### Inferences
- **MPP sessions is Flying Money's nearest twin** (escrow, cumulative signed voucher, local verification, one settle tx, refund of unused). Flying Money cannot claim the channel/voucher mechanism as novel. Differentiation has to come from what MPP sessions *doesn't* state: explicit hard end date + owner-reclaim-after-expiry, spender key separate from the funding owner, no admin/upgrade, permissionless contract on any EVM L2 rather than tied to a Stripe-led chain, and immutable caps. (Whether MPP's escrow has a timeout/admin was not stated in the blog — see Gaps.)
- Circle Nanopayments competes on "no gas per payment" but relies on Circle's Gateway as a batching intermediary (custodial netting); Flying Money's pitch is "no intermediary between buyer and seller."
- x402's own traction data (small average size shifting to $1+, ~50% gamed, tiny daily $) supports a message that the problem isn't the 402 handshake but trust in how much an agent can spend.
- Card rails are converging on "spend cap + merchant scope + consent" guardrails (Visa/OpenAI, Mastercard Agentic Tokens). The words "cap", "scope", "budget" are becoming table stakes; Flying Money's distinctive angle is that the cap is *enforced by prefunded money that can only go to one seller*, not by a policy an issuer/platform can change.

### Gaps
- Could not confirm from x402.org whether "upto" or "deferred" schemes are finalized/live as of Sept 2026.
- MPP sessions: dispute window, channel timeout, who can force-close, and whether the escrow contract has admin keys were not stated in the fetched blog.
- No primary Coinbase figure for x402 volume after April 2026; tracker figures conflict.
- No reliable volume data for AP2, Visa Intelligent Commerce, Mastercard Agent Pay, Tempo MPP or Circle Nanopayments.

## 2. Startups: positioning, funding, adopters

### Takeaway
Venture money (>$100M in 2026) is going to **agent wallets/orchestration and "agent banks"** (Natural, Sapiom, Catena, Skyfire, Crossmint), framed around identity/KYA and letting agents hold and move funds — i.e., custodial or platform-mediated control. None found markets a non-custodial, no-intermediary, prepaid single-seller budget as its core.

### Cited Findings
- **Natural**: $30M Series A led by Forerunner (Jul 20, 2026), $40M total; "an agent orchestration layer that enables AI agents to move and store funds"; in beta; names Stripe and Skyfire as competitors; CEO: volume could grow "two or three or four orders of magnitude" at machine speed — [TechCrunch](https://techcrunch.com/2026/07/20/natural-raises-30m-to-reinvent-payments-for-ai-agents-and-take-on-stripe/)
- **Sapiom**: $15M seed (Feb 2026) and $35M Series A (Aug 2026) led by Dragonfly with Accel, Coinbase Ventures, VanEck Ventures etc., $50M total; "Power the Next Trillion AI Agents"; agents buying their own tech tools/APIs — [Sapiom blog](https://www.sapiom.ai/resources/blog/series-a/); [The AI Insider](https://theaiinsider.tech/2026/02/12/sapiom-raises-15m-seed-round-to-build-financial-infrastructure-for-ai-agents/)
- **Catena Labs** (CEO Sean Neville, Circle co-founder): $18M led by a16z, "AI-native financial institution"; a further ~$30M round in June 2026 is reported only by secondary sources — [CB Insights](https://www.cbinsights.com/company/catena-labs); (secondary) [DEV Community taxonomy](https://dev.to/agentwallex/the-agent-payments-land-grab-a-taxonomy-4819)
- **Skyfire**: $9.5M (a16z CSX, Coinbase Ventures, Neuberger Berman); "agent trust stack" — agents prove who they are, hold funds, complete purchases; open **KYAPay** protocol (JWT identity+payment tokens, IETF draft); demoed a purchase with Visa Intelligent Commerce (Dec 2025) — [Tracxn](https://tracxn.com/d/companies/skyfire/__-gSNwLdAbLR2EH3jQO5ja24BZ2dqjmKWC_BS3-4pf1s); [BusinessWire](https://www.businesswire.com/news/home/20250626772489/en/Skyfire-Launches-Open-KYAPay-Protocol-With-Agent-Checkout); [IETF draft](https://datatracker.ietf.org/doc/draft-skyfire-kyapayprofile/); [BusinessWire Dec 2025](https://www.businesswire.com/news/home/20251218520399/en/Skyfire-Demonstrates-Secure-Agentic-Commerce-Purchase-Using-the-KYAPay-Protocol-and-Visa-Intelligent-Commerce)
- **Payman**: works with banks to capture consumer intent; fits agents paying human workers/contractors — (secondary) [Rye](https://rye.com/blog/agentic-commerce-startups); [FintechSpecs](https://fintechspecs.com/blog/skyfire-vs-payman-vs-natural-ai-agent-payment-infrastructure/)
- **Nevermined**: $4M raise, $7M total, "PayPal for AI" / AI-to-AI payments — [PYMNTS](https://www.pymnts.com/news/investment-tracker/2025/nevermined-raises-4-million-to-help-ai-agents-pay-and-get-paid/); [Finovate](https://finovate.com/nevermined-raises-4-million-for-decentralized-ai-payments-protocol/) (2025 data; may be superseded)
- **Crossmint**: Agentic Cards API with Visa — (secondary) [DEV Community](https://dev.to/agentwallex/the-agent-payments-land-grab-a-taxonomy-4819)
- Other named players: Cobo (enterprise agent wallets, 80+ chains), Alipay "AI Pay", AgentWallex (MPC wallets + x402, claims 3,600-team waitlist) — (secondary) [DEV Community](https://dev.to/agentwallex/the-agent-payments-land-grab-a-taxonomy-4819). Stated gap there: LangChain-style developers who want pay-per-API-call "without becoming a crypto custody expert".

### Inferences
- Dominant startup framing = **identity/trust (KYA)** and **agents as account holders**. Flying Money's framing ("hand over a budget, not your wallet") is the owner's-risk framing, which is underserved and complements KYA rather than competing with it.
- Funded players are custodial or platform-mediated; a zero-fee, no-admin, MIT contract is a credible "neutral primitive" story that could be integrated by these players rather than fought head-on.

### Gaps
- Could not verify current funding/traction for Paid, Lava, Payman (2026), Privy/Turnkey agent-policy products, or Stripe Issuing for agents in this pass.
- No customer/volume numbers found for Natural, Sapiom, Skyfire, Catena.

## 3. Analyst/VC narratives and market sizing; what they say is unsolved

### Takeaway
Forecasts are huge but definition-dependent ($190B–$5T by 2030) and focus on consumer shopping; crypto VCs emphasize KYA and programmable micropayments. On-the-ground data (x402) shows demand lagging infrastructure, and the concrete risk frame buyers respond to is "how do I cap what an agent can spend."

### Cited Findings
- McKinsey: up to $1T orchestrated US retail revenue by 2030; $3–5T globally — [Digital Commerce 360](https://www.digitalcommerce360.com/2025/10/20/mckinsey-forecast-5-trillion-agentic-commerce-sales-2030/)
- Morgan Stanley: agentic shoppers $190B–$385B of US e-commerce by 2030 (10–20% share) — [Morgan Stanley](https://www.morganstanley.com/insights/articles/agentic-commerce-market-impact-outlook)
- Bain: $300–500B by 2030 (15–25% of e-commerce); Gartner: 40% of enterprise apps embed agents by 2026 — (secondary aggregation) [Stellagent](https://stellagent.ai/insights/agentic-commerce-market-size-forecast-2030); US $1T by 2030 — [Retail Dive](https://www.retaildive.com/news/agentic-commerce-us-one-trillion-2030/818936/). Spread explained by definitions of "agentic" — (secondary) [Stellagent](https://stellagent.ai/insights/agentic-commerce-market-size-forecast-2030)
- a16z crypto "17 things for 2026": Sean Neville — bottleneck shifted from intelligence to identity; "non-human identities now outnumber human employees 96-to-1" in financial services; agents need signed credentials linking them to principals, **constraints**, and liability; industry has "months" before merchants keep blocking agents. Crowley/Carvolth — x402-style primitives let agents pay "instantly and permissionlessly". — [a16z crypto](https://a16zcrypto.com/posts/article/big-ideas-things-excited-about-crypto-2026/)
- CoinDesk-quoted analyst: "we'll probably overestimate how fast agentic commerce takes off in the next year, but we're largely underestimating what it can become in five" — [CoinDesk](https://www.coindesk.com/markets/2026/03/11/coinbase-backed-ai-payments-protocol-wants-to-fix-micropayment-but-demand-is-just-not-there-yet)
- Academic SoK on agentic-commerce security exists (arXiv 2604.15367) — [arXiv](https://arxiv.org/pdf/2604.15367) (not read in full)

### Inferences
- Unsolved items recurring across sources: agent identity/liability (KYA), merchant willingness to accept agents, real demand for per-request pricing, and per-payment settlement cost (motivating deferred/upto/sessions/nanopayments). Spending caps are being addressed by issuers/platforms as *policy*; bounded-loss-by-construction is a less-crowded message.
- Paradigm's position is expressed through Tempo (co-incubated with Stripe), i.e., Paradigm is effectively a backer of the nearest competitor design.

### Gaps
- No primary Paradigm research note or Gartner/Bain primary document fetched.
- Found no analyst source explicitly naming "prepaid escrow" or "refunds for agent micropayments" as unsolved; would need targeted reading.

## 4. Where Flying Money is differentiated vs. overlapping or weaker

### Takeaway
Genuinely distinctive combination: owner-funded, non-custodial, **hard-capped loss** to one named seller with an **end date and automatic owner refund**, no intermediary/facilitator, no fees/token/admin, immutable caps, EVM-portable. Overlaps heavily with MPP sessions mechanics; weaker on multi-seller reach, fiat/card onboarding, ecosystem, audit status, and scale limits.

### Cited Findings (comparison anchors)
- MPP sessions = escrow + cumulative voucher + 2 txs + refund, one payer to one payee — [Tempo](https://tempo.xyz/blog/mpp-sessions/)
- Circle Nanopayments = off-chain authorizations netted by Circle Gateway — [Circle](https://www.circle.com/blog/nanopayments-powered-by-circle-gateway-is-now-live-on-mainnet)
- x402 exact scheme = settlement per request through facilitators (18 tracked) — (secondary) [web3trackers](https://www.web3trackers.com/x402-dashboard)
- Coinbase Spend Permissions = recurring allowance from the owner's smart account, not prefunded escrow — [Coinbase docs](https://docs.cdp.coinbase.com/server-wallets/v2/evm-features/spend-permissions)
- Card-rail guardrails (spend cap, merchant categories, human approval) are set by user in platform — [Digital Commerce 360](https://www.digitalcommerce360.com/2026/06/12/visa-openai-agent-led-payments/)

### Inferences
Differentiated (message-worthy):
- **Bounded loss by construction**: worst case = the locked amount, only to the named seller; vs. allowances (Spend Permissions) that pull from a live wallet, or policies a platform enforces.
- **No intermediary**: no facilitator (x402), no batching operator (Circle Gateway), no network/issuer (Visa/MC), no chain operator dependency (Tempo). Seller verifies offline in ms.
- **Zero protocol fee, no token, no admin/pause/upgrade** — x402 also has zero protocol fees (per [Eco](https://eco.com/support/en/articles/14839402-x402-protocol-explained)), so "no fees" alone is not unique; "no admin + immutable caps" is stronger.
- **Expiry + automatic return of leftovers** (MPP also refunds on close; the explicit end-date guarantee is the stronger framing).
- **For people too**, not only agents (gift/allowance-like budgets) — distinct from infra-only players.
- Complements KYA: Flying Money limits *what* a key can spend regardless of *who* the agent is.

Overlapping / weaker (be honest in messaging):
- Mechanism overlaps MPP sessions (and classic payment channels); avoid "first" or "novel" claims.
- **Single seller per certificate** vs. x402/Circle/card rails that pay any merchant; agents calling many APIs need many certificates (capital fragmentation).
- **Stablecoin onboarding**: owner must hold USDC on Arbitrum; card rails and Stripe/Natural hide this.
- **Testnet, unaudited, tiny caps** (100/1,000 USDC) vs. mainnet incumbents with Stripe/Coinbase/Circle distribution; position caps as a safety feature ("training wheels by design").
- No ecosystem directory (x402 Agent.market, Tempo 100+ services, Circle Agent Marketplace).
- ECDSA-only spenders exclude smart-account/passkey spenders that Coinbase/Circle wallets use.

### Gaps
- Could not verify whether MPP sessions have an explicit expiry/refund-after-timeout guarantee or an upgradeable escrow; this is the key head-to-head claim to confirm before publishing any comparison.
- No data on seller-side willingness to accept single-seller prepaid certificates.
