# Developer UX and multi-audience landing pages (as of Sept 2026)

Scope: (a) developer-facing surfaces of an SDK/protocol product (docs, quickstarts, errors, agent-readable docs, demos), (b) a landing page for developers, sellers/API owners and everyday people. Written for Flying Money (open-source, prepaid, capped USDC budgets for AI agents; testnet, unaudited). Research date 2026-09-27. About 18 tool calls; several questions below are only partly answered and are listed under Gaps.

## 1. Developer docs and DX: what top docs do, and what data links docs to activation

### Takeaway
The best docs (Stripe, Resend, Vercel, PostHog, Hugging Face) aim at one thing: **time to first success**. They do it with runnable, personalized code (test keys filled into samples, language tabs, a three-column layout), a structure where tutorials, how-to guides, reference and explanation stay separate (Diátaxis), errors that link back to the docs, and, new in 2025–26, **docs built for agents**: llms.txt and llms-full.txt, a `.md` version of every page, `Accept: text/markdown` content negotiation, "Copy page / Open in Claude / Open in ChatGPT" menus, copyable onboarding prompts and a hosted MCP server. The hard data on activation is thin and mostly comes from vendors. Postman's time-to-first-call (TTFC) data is the most cited.

### Cited Findings
**Time to first call (TTFC) as the north-star metric**
- Postman calls TTFC "the most important API metric". Their April 2023 study found that a ready-to-run collection cut TTFC 1.7x at one company (17 min to 10 min) and up to 56x at other publishers. It credits two things: requests that are "quickly executable" and a format developers already know. — [Postman blog, "Improve your TTFC by 20x"](https://blog.postman.com/improve-your-time-to-first-api-call-by-20x/); [Postman, "The most important API metric is TTFC"](https://blog.postman.com/the-most-important-api-metric-is-time-to-first-call/)
- Fern (a docs vendor, so treat this as marketing) defines time-to-hello-world as the time from landing on the docs to the first successful response. It puts early quit rates at 50–70% when developers hit friction, and cites Postman's 2023 State of the API: lack of documentation is the top blocker for 52% of developers. — [Fern, reduce time-to-hello-world (Jul 2026)](https://buildwithfern.com/post/reduce-time-to-hello-world-enterprise-partners); [Fern, API docs best practices (Feb 2026)](https://buildwithfern.com/post/api-documentation-best-practices-guide)
- Stack Overflow 2025 survey (49k+ respondents): people who learned to code in the past year still used technical documentation more than any other resource (68%); AI tools reached 44%. More developers distrust AI accuracy (46%) than trust it (33%), and only 3% "highly trust" it. 52% don't use agents or use only simple AI tools. — [Stack Overflow 2025 Developer Survey](https://survey.stackoverflow.co/2025/); [SO blog, results](https://stackoverflow.blog/2025/12/29/developers-remain-willing-but-reluctant-to-use-ai-the-2025-developer-survey-results-are-here/)

**Stripe patterns**
- Stripe uses a three-column layout: a stable navigation tree on the left, explanation in the center, and live, executable code on the right, often personalized to the reader's account. — [Moesif, Stripe DX teardown 2026](https://www.moesif.com/blog/best-practices/api-product-management/the-stripe-developer-experience-and-docs-teardown/)
- When you are logged in, Stripe fills your test API keys into the code samples. Readers can also pick their language, and many endpoints can be run from the page with the response shown inline. — [Mintlify, "How Stripe creates the best documentation"](https://www.mintlify.com/blog/stripe-docs); [Moesif teardown](https://www.moesif.com/blog/best-practices/api-product-management/the-stripe-developer-experience-and-docs-teardown/)
- Stripe's quickstarts are interactive, step-by-step samples organized by use case and framework. — [Stripe quickstarts](https://docs.stripe.com/quickstarts)
- Every Stripe error object has `type`, `code`, `message`, `param` and `doc_url`, and `doc_url` links to the entry for that error code. Errors are meant to teach you the API as well as tell you what failed. — [Stripe API errors](https://docs.stripe.com/api/errors); [Stripe error codes](https://docs.stripe.com/error-codes); [Stripe error handling](https://docs.stripe.com/error-handling)

**Resend patterns (agent-first onboarding)**
- After signup you land directly on "send your first email" instructions with an "Add API Key" button. A shared sender (`onboarding@resend.dev`) lets you send before verifying a domain. — [Apidog Resend guide](https://apidog.com/blog/resend-api-key/)
- Resend's "AI onboarding" page offers a copyable quick-start prompt with steps, decision matrices and code; a Markdown version of every doc (append `.md`) plus llms.txt; a hosted MCP server (`mcp.resend.com/mcp`, OAuth); a CLI; installable skill packages; "Copy" and "Open in Cursor" buttons; one-click connectors for Claude and Codex; and guides for AI app builders (Lovable, Bolt). — [Resend AI onboarding](https://resend.com/docs/ai-onboarding)

**Agent-readable docs (llms.txt, markdown, "Open in Claude")**
- Mintlify generates `/llms.txt` and `/llms-full.txt` automatically, serves every page as `.md`, and honours `Accept: text/markdown`. Its page menu has Copy page (as Markdown), View as Markdown, Open in ChatGPT and Open in Claude. — [Mintlify docs PR](https://github.com/mintlify/docs/pull/727/files); [GitHub issue listing the pattern](https://github.com/hrustalq/knowledge/issues/68)
- Hugging Face docs expose llms.txt and llms-full.txt, and every page has buttons to view the Markdown source or chat about the page with a chatbot. PostHog and Sentry document the same approach. — [HF changelog](https://huggingface.co/changelog/docs-llms-txt); [PostHog](https://posthog.com/docs/ai-engineering/markdown-llms-txt); [Sentry](https://docs.sentry.io/contributing/pages/llm-support)
- Vercel serves Markdown to agents and HTML to people from the same URL, by content negotiation. It reports a page shrinking from 500KB to 2KB (99.6%). — [Vercel, Markdown access](https://vercel.com/docs/agent-resources/markdown-access); [Vercel KB](https://vercel.com/kb/guide/make-your-documentation-readable-by-ai-agents)
- Checkly (Feb 2026) found that 3 of the 7 coding agents it tested send `Accept: text/markdown`: Claude Code, Cursor and OpenCode. Codex, Gemini CLI, Copilot and Windsurf did not. On Checkly's own docs, the HTML page was 615KB (about 180k tokens) and the Markdown version 2.3KB (478 tokens). Cloudflare reports about 80% fewer tokens. — [Checkly, state of content negotiation](https://www.checklyhq.com/blog/state-of-ai-agent-content-negotation/)
- One data point from Vercel: when agents specified a format, they asked for Markdown in 95.7% of fetches (2,259 of 2,361). This figure comes from a search summary of Vercel's page and was not independently verified. — [Vercel agent resources](https://vercel.com/docs/agent-resources)

**Information architecture**
- Diátaxis sorts docs into four types: Tutorials (learning), How-to guides (tasks), Reference (lookup) and Explanation (understanding). Cloudflare calls it its "north star for information architecture", and Gatsby and Vonage have also adopted it. — [Diátaxis](https://diataxis.fr/)

### Inferences
- For Flying Money, "time to first success" should mean two things. For an agent builder, a successful paid call against the demo oracle on testnet. For a seller, their Hono route returning 402, then accepting a slip. Each should have a copy-paste quickstart that works in under about 3 minutes, with testnet setup (faucet, budget issuance) either done for the reader or skipped.
- The current docs slugs (agents, client, server, mcp, protocol, contract, guarantees, faq, shops, story) map onto Diátaxis. Quickstarts (agents, client, server) are tutorials or how-to guides. Protocol and contract are reference. Guarantees and story are explanation. Labelling or grouping them that way in the sidebar would help.
- Since Claude Code and Cursor already request Markdown, `/docs/[slug].md`, `/llms.txt`, `/llms-full.txt` and a "Copy page / Open in Claude / Open in ChatGPT" menu are cheap and fit the product: the users are agents. Resend-style copyable "onboarding prompts" for the MCP server fit especially well.
- SDK errors could copy Stripe's shape: a stable `code`, a human `message`, the offending `param`, and a `docUrl` pointing at `/docs/...#error-code`. Budget-specific errors (cap exceeded, expired, wrong chain) should name the limit and the remaining balance in base units, formatted for display.
- In the demo and quickstarts, pre-fill the chain, contract address and testnet USDC from `@flying-money/chains`, the way Stripe pre-fills test keys, and never hard-code them in the docs.

### Gaps
- I found no independent (non-vendor) study that ties specific docs features (copy buttons, code tabs, sandboxes) to activation or conversion rates. The Postman TTFC data is vendor-run and from 2023.
- I did not verify Supabase's or Clerk's docs patterns first-hand in this pass.
- I found no data on how much llms.txt or "Open in Claude" is actually used. Adoption is clear; its effect on conversion is not measured anywhere I found.

## 2. Interactive demos and playgrounds: making a protocol tangible

### Takeaway
In agent payments, the standard demo is now "a real agent paying a real (testnet) endpoint in the browser, with a wallet created and funded for you." Cloudflare's x402 playground and several community x402 playgrounds do this. I found no public data showing these demos convert better. The case for them rests on the TTFC logic above: zero setup, and you see it work.

### Cited Findings
- Cloudflare's x402 playground creates a new wallet when you open it and funds it with testnet USDC on a Base testnet. An Agents SDK agent then calls an MCP server that has both free and paid tools. The paid tools answer `402 Payment Required`, and the agent can ask you before paying. Payments can be set to run with or without human confirmation. — [Cloudflare blog, x402](https://blog.cloudflare.com/x402)
- x402.org presents the protocol as an extension of HTTP 402: the server replies with payment instructions, and the client pays and retries automatically. — [x402.org](https://x402.org/); [Solana, what is x402](https://solana.com/x402/what-is-x402)
- Community demos: the Hathor "x402 Agent Playground" simulates an agent calling paid endpoints, and an open-source "pay-to-complete" demo tests agent payment flows without real money. — [x402 Agent Playground (Hathor)](https://x402.hathor.dev/); [GitHub up2itnow0822/x402-demo](https://github.com/up2itnow0822/x402-demo)
- thirdweb and Zuplo ship x402 support with examples of MCP and API payments. — [thirdweb changelog](https://portal.thirdweb.com/changelog/x402-support); [Zuplo blog](https://zuplo.com/blog/mcp-api-payments-with-x402)
- Evil Martians' study of 100+ devtool landing pages: products with a narrow scope embed the live product in the hero; SDK and infrastructure products show code snippets; "switchable multiple UIs" suit products with several use cases. — [Evil Martians, 100 devtool landing pages](https://evilmartians.com/chronicles/we-studied-100-devtool-landing-pages-here-is-what-actually-works-in-2025)

### Inferences
- The /demo (an agent paying an oracle with slips) is in the same category as the Cloudflare playground. Its difference, the **cap** and **prepaid budget**, should be visible: a budget meter that goes down with each slip, a clear "refused: over cap" moment, and a split view that labels which steps are off-chain (a slip signed and verified in milliseconds) and which are on-chain (the batch redemption, with an explorer link). A demo that shows the agent *failing safely* when it hits the cap tells the guarantee story better than any copy.
- Offer both modes, following Cloudflare: auto-pay under the cap, and ask a human above it. This maps directly onto the request inbox (§21.4).
- The step explorer is the "explanation" counterpart to the demo. Link each demo event to the matching explorer step so a curious viewer can go deeper without leaving the flow.

### Gaps
- I could not confirm current details of Stripe's interactive checkout demo, or any Tempo or MPP (Machine Payments Protocol) demo pages, in this pass. Search returned nothing primary.
- I found no conversion or activation data for interactive protocol demos, for x402 or anything else.

## 3. Landing pages for multi-audience products

### Takeaway
Devtool landing pages have settled on one pattern: a **centered hero with a specific headline, one visual (code, product UI or a live embed), and two CTAs** ("Start building" as primary, Docs or GitHub as secondary). They tell a problem-first story, use curated proof, and end with a strong final CTA. Research is clear that audiences should **not** become the primary navigation. Instead, route by task, and add lightweight "For developers / For sellers / For people" sections or secondary links, labelled with the word "for". Plain copy converts much better than professional-register copy.

### Cited Findings
**Hero and structure (Evil Martians, 100+ devtool pages, 2025)**
- The dominant pattern is a centered composition: headline, supporting visual, and two CTAs. The primary CTA uses specific wording ("Start building", not "Get started"). The secondary CTA (docs, GitHub, waitlist) is styled so it doesn't compete. — [Evil Martians](https://evilmartians.com/chronicles/we-studied-100-devtool-landing-pages-here-is-what-actually-works-in-2025)
- Feature storytelling ranked from most to least effective: problem-oriented (best for early-stage), then action or task-based, mission statement, bold statements, and bare function lists (weakest). — same
- Common layouts: chess (alternating image and text), bento grids, step-by-step, tabbed features, and full-width scrolling "belts". Two rules held across the set: "No salesy BS" and "Clever and simple wins". — same
- Social proof: B2B pages use logo carousels. Individual-oriented tools use GitHub stars and usage metrics. Almost all testimonials are curated by hand, and some sit next to the feature they mention. The study says early-stage teams benefit even from a single testimonial from a first user. — same
- Optional sections: FAQ accordions, comparison tables, a changelog preview (a sign of active development), integration logos, and a high-contrast full-width final CTA as a "safety net". — same

**Audience routing**
- NN/g lists 5 reasons to avoid audience-based navigation: users don't know which group they're in, it's unclear whether a section is *about* or *for* a group, self-identification adds cognitive load, users worry other groups get a better deal, and content gets duplicated and forces pogo-sticking. It is acceptable when the content really is unique to each group, the groups are mutually exclusive and jargon-free, and it serves as **secondary** navigation. Use "For X" labels, make it easy to switch, and keep task or topic navigation primary. (Article from 2015 but still cited.) — [NN/g, audience-based navigation](https://www.nngroup.com/articles/audience-based-navigation/)

**Copy and conversion benchmarks**
- Unbounce Conversion Benchmark Report (2024, 57M+ conversions): median SaaS landing page conversion is 3.8%, against 6.6% across all industries. Copy at a 5th–7th grade reading level converted at 12.9%, against 2.1% for professional-level copy. The best range was 250–725 words. 79% of visits came from mobile, and mobile conversion (6.4%) roughly matched desktop (6.2%). — [Unbounce SaaS benchmark](https://unbounce.com/conversion-benchmark-report/saas-conversion-rate/); [Unbounce overall](https://unbounce.com/conversion-benchmark-report/)

### Inferences
- Hero: use one plain-language sentence that "everyday people" can follow (e.g., "Give your AI agent a prepaid card with a hard limit"), with the mechanism in the subhead (USDC, capped, open source). Pair "Try the demo" (primary, zero setup) with "Read the docs" / GitHub (secondary). The visual could be a live mini-demo or a short code snippet with tabs (client / server / MCP), following Evil Martians' "switchable UIs" pattern.
- Audience routing: keep primary navigation task-based (Demo, Docs, Guarantees, Chains). Below the hero, add a three-card "For agent builders / For API sellers / For people" band, each with its own single CTA (quickstart / server middleware and shops / app). Don't make audiences the top navigation, per NN/g.
- Aim the copy at a 5th–7th grade reading level for the hero and "how it works"; move the jargon (EIP-712, redemption batches, invariants) into the docs. Keep the landing page within about 250–725 words.
- With no customers or logos yet, use proof the product can honestly claim: open-source repo and stars, the invariant list (I1–I7, S1–S4, C1) with a count of fuzz and invariant runs, a verified contract address and explorer link per testnet, a changelog, and a "testnet, unaudited" badge stated plainly. A single real quote from a first builder would still help.
- Use a problem-first story: "agents with a hot wallet or a card can overspend; you can't cap them; here's a hard cap enforced on-chain."

### Gaps
- I found no published five-second-test benchmark data specific to fintech or devtool heroes. NN/g and UsabilityHub (Lyssna) describe the method, but I retrieved no numbers.
- I retrieved no 2025–2026 A/B data specifically about audience-routing cards on a homepage.

## 4. Displaying risk and guarantees (security pages, limitations, status)

### Takeaway
Mature crypto protocols publish a dedicated, plain-language **risks page** listing each risk and how it is mitigated (Aave), a **security page** with audits and a bug bounty (Aave, Safe, MetaMask), and a responsible-disclosure contact. Being honest about limits is the norm, not a weakness.

### Cited Findings
- Aave's "Risks" docs page lists each risk category (smart contract, oracle, collateral, and more) with a mitigation beside it: open-source code, several external audits, formal verification, governance review, and a continuous bug bounty. — [Aave docs, Risks](https://aave.com/docs/resources/risks); [Aave Security](https://aave.com/security)
- Safe runs a smart-contract bug bounty of up to $1M, scoped to Safe Smart Accounts and official modules, with separate contacts for wallet issues and contract issues. It publishes an Audits page and a responsible-disclosure policy. — [Safe bug bounty](https://docs.safefoundation.org/security/bug-bounty); [Safe docs bounty](https://docs.safe.global/advanced/smart-account-bug-bounty)
- MetaMask has a dedicated consumer-facing security page. — [MetaMask security](https://metamask.io/security)
- A GitHub `SECURITY.md` policy is the standard disclosure route for open-source projects (e.g., Trust Wallet core). — [trustwallet/wallet-core security policy](https://github.com/trustwallet/wallet-core/security/policy)

### Inferences
- Flying Money's /guarantees page could follow Aave's layout: for each guarantee (I1–I7, S1–S4, C1), give a plain-English promise, **how it's enforced** (contract check or off-chain check), **how it's tested** (a link to the forge invariant or test file), and **what it does NOT protect against** (for example: unaudited code, a compromised spender key, stablecoin issuer risk, chain reorgs). A "Known limitations" block near the top (testnet only, unaudited, ECDSA-only spenders, no admin means no recovery) makes it more credible.
- Add `SECURITY.md` with a disclosure contact, and link it from the footer and the guarantees page. There is no bounty yet, so say so rather than leaving it out.
- The "testnet, unaudited" warning should be persistent and consistent (header or footer badge, plus inline where users fund budgets), not buried in the FAQ.
- A lightweight status or deployments page (per-chain contract address, verified source link, last-seen block from the oracle or redemption worker) works as a status page for a protocol with no hosted API SLA.

### Gaps
- I did not retrieve Stripe's security page or Uniswap's risk or security pages in this pass. I found no data on how a risk page affects conversion or trust.
- I found no research on status-page design for protocol (non-SaaS) products.

## 5. Performance, accessibility, dark mode and motion

### Takeaway
The baseline is Core Web Vitals at "good" (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 at the 75th percentile) and WCAG 2.1/2.2 AA. The European Accessibility Act has applied since 28 June 2025. Dark mode and restrained motion are the norm on devtool pages ("clever and simple wins"), though I found no quantitative source for dark-mode expectations.

### Cited Findings
- Core Web Vitals "good" thresholds are LCP within 2.5s, INP of 200ms or less, and CLS of 0.1 or less, judged at the 75th percentile of page views. — [web.dev, Web Vitals](https://web.dev/articles/vitals); [web.dev, defining thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds); [Google Search Central](https://developers.google.com/search/docs/appearance/core-web-vitals)
- The EAA has applied since 28 June 2025. Sources say it is based on WCAG 2.1. Vendor sources say EN 301 549 uses WCAG 2.2 as its baseline and recommend WCAG 2.2 AA; these vendor claims conflict with the others on 2.1 vs 2.2. — [Kinsta](https://kinsta.com/blog/european-accessibility-act/); [OneTrust](https://www.onetrust.com/blog/understanding-the-european-accessibility-act-and-wcag-22/); [Level Access](https://www.levelaccess.com/compliance-overview/european-accessibility-act-eaa/)
- Evil Martians found most devtool pages avoid flashy interactions in favour of clean type, clear layout and breathing room, using a centered max-width container. — [Evil Martians](https://evilmartians.com/chronicles/we-studied-100-devtool-landing-pages-here-is-what-actually-works-in-2025)
- 79% of landing-page visits in Unbounce's dataset came from mobile. — [Unbounce](https://unbounce.com/conversion-benchmark-report/saas-conversion-rate/)

### Inferences
- The /demo and step explorer are the parts of the site most likely to fail INP and CLS, because of live animation and streaming events. Reserve space for the event log and meters, and respect `prefers-reduced-motion` by swapping animated slip "flights" for instant state changes.
- Target WCAG 2.2 AA, a superset of 2.1 that covers either reading of the EAA. Key items: focus visible and not obscured, target size of at least 24px, sufficient contrast in both themes, and budget meters that don't rely on color alone.
- Mobile-first matters even for a devtool, given the 79% mobile share (a general, not devtool-specific, figure). Code blocks need horizontal scroll inside the block, never page-level horizontal scroll.

### Gaps
- I found no quantitative 2025–26 source on developers' dark-mode preference or its effect on devtool sites.
- I found no primary source on `prefers-reduced-motion` usage rates.
