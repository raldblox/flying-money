# Developer and agent-builder GTM playbooks for open-source dev infra and payments/crypto dev tools (as of 2026-09-27)

Scope note: ~20 tool calls. Several primary pages (circle.com/grant, coinbase.com CDP hackathon winners, a Medium hackathon analysis) failed to fetch (TLS/403), so those items rely on search snippets and are flagged. Vendor claims are marked [vendor]; independent analyses are marked [independent].

## 1. Launch playbooks that worked 2023–2026 (Show HN, Product Hunt, X, Reddit, etc.) and what results they got

### Takeaway
Hacker News is still the highest-leverage single launch for an open-source dev tool, but it is a 48-hour spike with a fat-tailed distribution: the median Show HN gets 2 points, and only ~6% reach 50+. Stars convert at roughly 1.4 per upvote and 92% of the star gain is over within 48 hours, so a launch must be paired with a durable channel (repeated launch weeks, integrations, content). Resend and Supabase show the "repeatable launch" pattern beats a single launch.

### Cited Findings
- [independent] Analysis of 188,085 Show HN posts (2012–Apr 2026): median score 2; 90th percentile 24; top 6% score 50+; top 1% score 250+. — [Daniel King, Show HN by the Numbers (Apr 2026)](https://danfking.github.io/blog/2026/04/23/show-hn-by-the-numbers/)
- [independent] ~1.4 GitHub stars per HN upvote within 48h; day-1 median spike of 509 stars for high-scoring posts, day 2 ~40, days 3–7 ~9/day; star half-life ~24h; "92% of star-getting is over" after 48h. Diminishing returns: 700+ point posts convert 0.79 stars/point vs 1.77 for 258–350. Caveat: sample is biased to posts scoring 258+. — [Daniel King](https://danfking.github.io/blog/2026/04/23/show-hn-by-the-numbers/)
- [independent] HN score explains only ~8% of variance in stars (r=0.29); comments are a weak predictor (r=0.10). — [Daniel King](https://danfking.github.io/blog/2026/04/23/show-hn-by-the-numbers/)
- [independent] Best posting slot: Monday 00:00 UTC (Sunday 7pm US Eastern), 10.8% chance of 50+ points; also Sunday 02:00 UTC (9.8%) and Saturday 19:00 UTC (9.2%). Worst: Thursday 06:00 UTC (2.6%). The "Show HN" tag itself shows no statistical advantage after controls. — [Daniel King](https://danfking.github.io/blog/2026/04/23/show-hn-by-the-numbers/)
- [independent] Competition is rising: ~10,000 Show HN posts/yr in 2019 vs 28,302 in 2025; ~200/day in 2026. — [Daniel King](https://danfking.github.io/blog/2026/04/23/show-hn-by-the-numbers/)
- A secondary source cites 5,000–50,000+ visitors in 48h from a successful Show HN and repos averaging 121 stars in 24h, 189 in 48h, 289 in a week after HN exposure (different, broader sample than King's). — [daily.dev Ads, HN marketing for dev tools](https://business.daily.dev/resources/hacker-news-marketing-developer-tools-show-hn-launch-day-sustained-coverage/)
- Counter-example: a Dec 2025 Show HN launched 3 days before Christmas got 1 point, 0 comments, 0 signups after 4 hours. — [Indie Hackers post-mortem](https://www.indiehackers.com/post/i-built-a-saas-in-9-days-for-200-launched-on-hn-to-zero-signups-heres-what-actually-happened-87c39638c6)
- HN launch tactics: title = "[Name] – one plain sentence of what it does"; flag open source (HN "overindexes on open-source, privacy-first products"); first comment = who you are, one-line what, problem, backstory, technical detail, differentiation, request for feedback; no superlatives, no hard sell, no booster comments; link GitHub; answer every comment deeply (Fly.io founder answered 53). — [Markepear, How to launch a dev tool on HN](https://www.markepear.dev/blog/dev-tool-hacker-news-launch)
- Supabase hit the HN front page two days in a row in spring 2020, taking users from 80 to 800 overnight. — [Supabase growth summaries citing founders](https://www.craftventures.com/articles/inside-supabase-breakout-growth) (the 80→800 figure appears in search snippet of the Craft/related articles; see also [Supabase: How we launch](https://supabase.com/blog/supabase-how-we-launch))
- Supabase runs quarterly "Launch Weeks": one feature per day for five days, each day posted to HN, Product Hunt, X, email and Discord; the engineer who built the feature writes the post. launchweek.dev counted 126 launch weeks by 94 companies in 2024. — [Supabase: How we launch](https://supabase.com/blog/supabase-how-we-launch); [fmerian analysis of Supabase/Laravel launches](https://fmerian.medium.com/i-analyzed-how-supabase-and-laravel-launched-heres-what-i-learned-7cb662f227cc)
- Resend [vendor]: open-source React Email (Dec 2022) was the top-of-funnel, reaching 10,000 GitHub stars by Nov 2023; Jan 2023 announcement tweet got "more than 1M views"; first paying customer was a friend's startup charged via a $10 payment link (Sep 2022); 1,000 paying customers by Dec 2023; 100,000 users by Apr 2024; 3,000,000 by Jun 2026; five launch weeks run by Nov 2025; 2025–26 focus on Claude Code/Cursor plugins and an MCP server. — [Resend handbook: How we got here](https://resend.com/handbook/company/how-we-got-here); [Resend $3M seed post](https://resend.com/blog/resend-raises-3m-seed-round)

### Inferences
- For Flying Money, expect a realistic Show HN outcome of a handful of points (median) and a best case of several hundred stars; plan the launch for Sunday evening US Eastern and have the live demo, one-command quickstart and GitHub link ready so the 48-hour window converts to trials, not just stars.
- The Resend pattern (an adjacent free open-source tool that is useful on its own, driving attention to the paid/hosted product) maps to Flying Money shipping standalone pieces, e.g. the Hono verify middleware or MCP server, as independently useful "wedge" packages.
- Launch weeks are cheap for a solo team if features are already built: batch small shippable features (new framework adapters, demo improvements, invariant write-up) into a 5-day week rather than one big launch.

### Gaps
- No reliable 2024–2026 numbers found for Product Hunt outcomes for dev tools specifically, or for Reddit (r/LocalLLaMA, r/ClaudeAI, r/ethdev) or YouTube-creator-driven launches; searches returned no primary data. Treat PH/Reddit as unquantified.
- No verified numbers for GitHub trending effects.

## 2. DevRel for agent infra: how Stripe, Coinbase (x402/AgentKit/CDP), E2B, Mastra, Composio, Browserbase etc. grew adoption

### Takeaway
The agent-infra winners grew by being present wherever agent builders already are: one toolkit with adapters for every popular framework (Stripe, Composio), provider slots inside framework SDKs (E2B in OpenAI Agents SDK), an MCP server, and sponsor-funded hackathons that require use of the SDK (Coinbase). x402 in particular became an industry standard via partners and a neutral foundation, and its early volume was heavily speculative.

### Cited Findings
- Stripe Agent Toolkit (Nov 2024) launched as one Python + TypeScript library with adapters for LangChain, CrewAI and Vercel AI SDK, later OpenAI Agents SDK and MCP, built on the existing Stripe SDKs, plus metered-billing middleware for Vercel AI SDK. — [Stripe agent toolkit (mirror of repo README)](https://github.com/DTTconnect/stripe-agent-toolkit); [Cryptopolitan launch coverage](https://www.cryptopolitan.com/stripe-sdk-ai-agents-payment-billing-apis/)
- x402 [mixed vendor/independent]: Coinbase and the Linux Foundation launched the x402 Foundation on 2026-04-02; members listed include Visa, Mastercard, Amex, Stripe, Adyen, Google, AWS, Circle, Shopify, Solana Foundation. — [Linux Foundation press release](https://www.linuxfoundation.org/press/linux-foundation-is-launching-the-x402-foundation-and-welcoming-the-contribution-of-the-x402-protocol); [Cloudflare blog](https://blog.cloudflare.com/x402/)
- Cloudflare and AWS embedded x402 at the edge (reported July 2026). — [InfoQ](https://www.infoq.com/news/2026/07/cloudflare-aws-x402-micropayment/)
- Aggregated claim: 169M payments, 590k buyers, 100k sellers in x402's first year; Solana ~65% of 2026 volume. Source is an explainer/aggregator, not primary; treat as unverified. — [Concordium x402 explainer / search snippet](https://www.concordium.com/article/x402-explained-agentic-payments-identity); [Major Matters x402 tracker](https://majormatters.co/x402)
- [independent, Chainalysis] 100M+ cumulative x402 transactions on Base from mid-2025 through Q1 2026, with a Q4 2025 surge driven by speculative activity (the PING "pay-to-mint" meme coin did 150k+ tx in its first month); moderated in early 2026. Tester-to-payer conversion improved 4x in six months; weekly wallet retention trending up. x402 wallets are young (197 days vs 423 avg Base), hold 26 tokens on average vs 4. Share of tx ≥$1 grew from 49% to 95%. — [Chainalysis: Inside x402](https://www.chainalysis.com/blog/x402-agentic-payments-adoption/)
- Coinbase ran the "Agents in Action" AgentKit hackathon (Devfolio) and required AgentKit use at ETHGlobal "Agentic Ethereum" (Jan 31–Feb 14, 2025); later CDP prize tracks at ETHGlobal events list x402 with the CDP facilitator, embedded/server wallets. Participant counts not retrieved (Coinbase page failed TLS). — [ETHGlobal Agentic Ethereum](https://ethglobal.com/events/agents); [Devfolio hackathon](https://cdp-agentkit-hackathon.devfolio.co/); [ETHGlobal Buenos Aires prizes](https://ethglobal.com/events/buenosaires/prizes)
- A Medium analysis of 8,200 hackathon projects (Jun 2026) reportedly found x402-style "agents that pay" at 3.5% of the most recent cohort "from a standing start" (search snippet only; page 403). — [Simon Brown, Medium](https://simbro.medium.com/what-8-200-hackathon-projects-reveal-about-what-actually-wins-f105346ec97c)
- E2B [vendor]: 40k sandboxes/month (Mar 2024) → 50M (Mar 2025); site claims 7M+ monthly SDK downloads and 1B+ sandboxes by mid-2026; early distribution came from being the runtime for swyx's smol-developer and from the code-interpreter wedge; Apache-2.0 core. — [Latent Space: E2B](https://www.latent.space/p/e2b); [Jimmy Song analysis](https://jimmysong.io/blog/e2b-browserbase-report/); [E2B about](https://e2b.dev/about)
- [independent] E2B has ten integration guides but only two are "cooperative provider slots" (OpenAI Agents SDK, Claude Managed Agents); eight are unilateral templates (Claude Code, Codex, Devin, etc.). OpenAI's SDK lists seven equal sandbox providers, so slots are non-exclusive. Recommendation to smaller players: "ship the MCP server first", pursue cooperative slots selectively, skip unilateral templates as maintenance overhead. — [bex.co, Jul 2026](https://bex.co/blog/2026/07/08/e2b-openai-agents-sdk-sandbox-neutrality)
- Mastra: ~19.4k GitHub stars and 300k+ weekly npm downloads by Mar 2026 (third-party tutorial citing), YC W25, v1.0 Jan 2026; growth assets include templates, a course and YouTube videos. — [Firecrawl Mastra tutorial](https://www.firecrawl.dev/blog/mastra-tutorial); [mastra-ai GitHub](https://github.com/mastra-ai/mastra)
- Composio publishes one integration page per toolkit per framework (e.g. Browserbase × OpenAI Agents SDK, × Mastra, × Vercel AI SDK, × Claude Code, × AutoGen, × Codex): a programmatic-SEO matrix of tool × framework. — [Composio Browserbase × OpenAI Agents SDK](https://composio.dev/toolkits/browserbase_tool/framework/open-ai-agents-sdk); [× Mastra](https://composio.dev/toolkits/browserbase_tool/framework/mastra-ai)

### Inferences
- For Flying Money the Stripe-toolkit pattern is directly copyable at near-zero cost: a thin `@flying-money/client` adapter per framework (Vercel AI SDK tool, LangChain tool, Mastra tool, OpenAI Agents SDK tool) with one example each, plus the existing MCP server as the universal fallback.
- x402 is both the category's awareness engine and the obvious comparison. Positioning as complementary (capped prepaid budgets with off-chain slips and one redemption, vs per-request on-chain settlement) lets Flying Money ride x402 search traffic and hackathon tracks rather than fight them. Chainalysis's data that early x402 volume was speculative is a useful, independent point for a "why budgets" write-up; cite it carefully.
- Hackathon sponsor tracks where Coinbase/Base require CDP/x402 are an opening: a Flying Money starter that works alongside AgentKit/x402 could be used by hackers even without Flying Money paying for a prize.

### Gaps
- No primary numbers found for Browserbase, Composio, LangChain or Vercel AI SDK early-adoption tactics (search returned only integration docs).
- No official Coinbase developer count for AgentKit/x402 retrieved; Coinbase CDP pages failed to load.
- Stripe has not published adoption numbers for the agent toolkit (none found).

## 3. Integration-led growth: getting into framework docs/examples, MCP clients and template marketplaces

### Takeaway
The durable distribution in agent infra is being listed inside frameworks (provider slots, docs pages, templates) and MCP directories. For a tiny team, the evidence favors: MCP server first, then a small number of high-traffic framework adapters, then PRs into framework example/integration directories; avoid maintaining many unilateral templates.

### Cited Findings
- "Ship the MCP server first" as a single implementation that yields broad compatibility; E2B hedged framework dependence via MCP and a Docker MCP gateway exposing 200+ tools. — [bex.co](https://bex.co/blog/2026/07/08/e2b-openai-agents-sdk-sandbox-neutrality)
- The Stripe Agent Toolkit is itself indexed in MCP directories (e.g. mcpmarket, mcpserver.space), showing MCP listing sites as a discovery surface. — [mcpmarket: Stripe Agent Toolkit](https://mcpmarket.com/server/stripe-agent-toolkit); [mcpserver.space](https://mcpserver.space/mcp/stripe~ai/)
- Supabase became the default backend inside AI app builders (Bolt, Figma Make, Lovable, v0); scaled from 1M to 4.5M+ developers in under a year; 55% of the latest YC batch uses it [vendor/investor claim]. — [Craft Ventures: Inside Supabase's breakout growth](https://www.craftventures.com/articles/inside-supabase-breakout-growth)
- Resend's 2024–26 expansion ran through integrations: Zapier (May 2024), Vercel partnership, and Claude Code/Cursor plugins plus an MCP server. — [Resend: How we got here](https://resend.com/handbook/company/how-we-got-here)
- x402 ecosystem has SDKs in TypeScript, Python, Rust, Go and framework integrations for Next.js and Cloudflare Workers. — [Wikipedia/secondary via search](https://en.wikipedia.org/wiki/X402); [Cloudflare blog](https://blog.cloudflare.com/x402/)

### Inferences
- Priority order for Flying Money: (1) list the MCP server in the official MCP registry and major directories; (2) Vercel AI SDK and Mastra adapters (TypeScript-native, matches the SDK); (3) OpenAI Agents SDK and LangChain.js tool; (4) a PR to framework "community integrations" pages. Each should be a <20-line example that performs a real capped payment against the testnet demo seller.
- Seller-side integrations matter as much as buyer-side: a Hono middleware is good; a Next.js route handler and Cloudflare Workers example would mirror where x402 got embedded.

### Gaps
- No data found on acceptance rates or traffic from being listed in LangChain/CrewAI/Mastra/ElizaOS integration docs, or on MCP-directory referral volumes.

## 4. Content that converts developers

### Takeaway
The best-evidenced conversion drivers are fast time-to-value (a single "key event"), engineer-written technical launch posts, and credible docs/YouTube. No rigorous 2024–26 study of specific content formats (benchmarks, comparison pages) was found.

### Cited Findings
- Supabase identified one activation "key event" (creating the first database); after it, adoption of other products rose sharply. They segment into two ICPs (experienced Postgres devs vs newcomers) with different messaging. DevRel/YouTube/tutorials framed as proof of expertise, not SEO. — [Craft Ventures](https://www.craftventures.com/articles/inside-supabase-breakout-growth)
- Engineer who shipped the feature writes the launch post; technical depth, no marketing noise. — [Supabase: How we launch](https://supabase.com/blog/supabase-how-we-launch)
- [low-quality/unsourced] Claim that tools with time-to-value under 5 minutes see 65% activation vs 12% for vague promises; activation typically 20–40%. Treat as indicative only (agency blog, no methodology). — [SaaS Hero](https://www.saashero.net/strategy/devtools-saas-growth-marketing-strategies/)
- Resend validated with a real payment link before building more ($10), i.e. an early "first payment" moment. — [Resend handbook](https://resend.com/handbook/company/how-we-got-here)

### Inferences
- Flying Money's key event is likely "first slip verified by a seller" (or "first budget locked"). The demo and README should drive to that in under 5 minutes on testnet with no wallet setup where possible (faucet + pre-funded demo key).
- Content ideas grounded in the evidence: an engineer-voice deep dive on the invariants (I1–I7) and why there is no admin key; a latency benchmark of local slip verification vs on-chain settlement; an honest "Flying Money vs x402 vs Stripe agent toolkit" comparison page (HN rewards candor, not superlatives).

### Gaps
- No independent data found on conversion from interactive demos, benchmark posts or comparison pages specifically for dev tools in 2024–26.

## 5. Crypto-specific dev acquisition: grants, ecosystem programs, hackathons, and marketing to web2 devs

### Takeaway
Non-dilutive money exists but mostly rewards live mainnet usage (Base Builder Grants, Optimism Retro Funding) or milestone-based USDC integrations (Circle). Hackathon sponsor tracks from Coinbase/CDP and ETHGlobal are the main place agent-payment builders gather. Flying Money is testnet and unaudited, which limits eligibility for retro programs until it has mainnet usage.

### Cited Findings
- Base Builder Grants: retroactive grants for functional apps live on Base mainnet (payments infra included); running since Mar 2024 across 20+ cohorts; part of a stack with Base Ecosystem Fund, Optimism RetroPGF, Builder Rewards and Base Batches. — [Gitcoin: Base Builder Grants](https://gitcoin.co/apps/base-builder-grants)
- Optimism has allocated 850M OP to Retro Funding; every Base project is eligible; missions include "Onchain Builders" (rewarding measured onchain impact). — [Optimism Collective](https://optimism.mirror.xyz/nz5II2tucf3k8tJ76O6HWwvidLB6TLQXszmMnlnhxWU); [OP Atlas Retro Funding: Onchain Builders](https://atlas.optimism.io/missions/retro-funding-onchain-builders)
- Circle Developer Grants: funding, co-marketing and mentorship for teams building real-world financial flows onchain; tiered USDC funding tied to integrations and ecosystem impact; milestone-based payouts (from search snippet; page failed TLS fetch). — [Circle Developer Grants](https://www.circle.com/grant)
- ETHGlobal Agentic Ethereum (Jan 31–Feb 14, 2025) required AgentKit use for Coinbase prizes; subsequent ETHGlobal events list CDP prizes for x402 with CDP facilitator. — [ETHGlobal Agentic Ethereum](https://ethglobal.com/events/agents); [ETHGlobal Buenos Aires prizes](https://ethglobal.com/events/buenosaires/prizes)
- Chainalysis: x402 users skew crypto-native (young wallets holding 26 tokens on average), and early volume was driven by speculation. — [Chainalysis](https://www.chainalysis.com/blog/x402-agentic-payments-adoption/)
- x402's legitimacy for web2 audiences came from non-crypto partners (Cloudflare, AWS, Google, Visa, Stripe) and a Linux Foundation home. — [Linux Foundation](https://www.linuxfoundation.org/press/linux-foundation-is-launching-the-x402-foundation-and-welcoming-the-contribution-of-the-x402-protocol); [InfoQ](https://www.infoq.com/news/2026/07/cloudflare-aws-x402-micropayment/)

### Inferences
- Circle's program is the best fit today (USDC-native, milestone based, co-marketing). Base Builder Grants / OP Retro Funding become relevant after a mainnet deploy with real redemptions (which needs audit + human approval per project rules).
- Marketing to web2 devs: lead with "prepaid, capped API budget for agents; verify in ms; no token, no fees, no admin keys" and dollar amounts, keep chain/wallet mechanics behind the SDK; the x402 precedent shows web2 credibility comes from neutral/standard framing and infra partners, while the crypto-native audience is the one actually transacting today.

### Gaps
- Could not retrieve current (Sep 2026) Circle grant tiers/amounts, Arbitrum grant program details, or Base Batches terms.
- No participant/submission counts for Coinbase agent hackathons.

## 6. Metrics and funnel benchmarks for dev tools

### Takeaway
Best available benchmarks (boldstart, 2023): ~10% of site visitors sign up, ~5% of signups pay within 6 months, 30% 7-day and 23% 28-day retention. Stars are a weak proxy for usage; HN score predicts stars poorly. For an OSS SDK, track npm downloads, quickstart completions and "first verified slip" events instead.

### Cited Findings
- [VC benchmark, 2023] Median website-visitor→signup 10% (free trial 5%, freemium 9%); signup→paid median 5% within 6 months (vs 10% non-dev products); per 100 visitors ~10 signups, <1 paid; 7-day retention 30%, 28-day 23%; 3.3 site visits before signup; 54% of conversions within first 3 months; organic = 31% of leads (41% for PLG); product-led sales roughly doubles conversion. — [boldstart ventures devtool benchmarks](https://boldstart.vc/devtoolkit/an-alternative-to-nps-for-dev-tools/)
- [independent] HN score vs stars r=0.29; stars/upvote ~1.4. — [Daniel King](https://danfking.github.io/blog/2026/04/23/show-hn-by-the-numbers/)
- Practitioner view: stars "cost nothing to give" and don't imply the repo was cloned or run. — [Startup Fortune community thread](https://startupfortune.com/community/whats-your-actual-github-stars-to-paying-user-conversion-for-a-niche-dev-tool)
- Reference growth curves [vendor]: Resend 1,000 paying customers ~1 year after launch, 100k users at 15 months; E2B 40k→50M sandboxes/month in 12 months; Mastra ~19.4k stars / 300k weekly npm downloads ~14 months after YC W25. — [Resend](https://resend.com/handbook/company/how-we-got-here); [Jimmy Song](https://jimmysong.io/blog/e2b-browserbase-report/); [Firecrawl](https://www.firecrawl.dev/blog/mastra-tutorial)

### Inferences
- Reasonable zero-budget targets for "first 100–1,000 developers": if a Show HN reaches ~100 points, expect ~140 stars and perhaps 5k–20k visitors; at 10% signup-equivalent (here: quickstart run), that is several hundred to ~2,000 trial developers, of whom ~23% might still be active at 28 days. These are extrapolations from benchmarks, not measured outcomes.
- Instrument (privacy-respecting) counters for: npm installs per package, demo budgets opened, first slip verified, first on-chain redemption. The testnet "redemption" is the analogue of Supabase's key event.

### Gaps
- No 2024–26 benchmark specific to OSS SDK stars→weekly active integrations, or to crypto dev tools' testnet→mainnet conversion, was found.
- No Product Hunt, Reddit or Discord conversion benchmarks for dev tools were found.
