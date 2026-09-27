# Marketing to machines: how developer tools and payment rails get discovered, chosen and recommended by AI agents and LLMs (as of 2026-09-27)

Scope note: about 20 search and fetch calls. Sources are labelled as peer-reviewed or preprint, primary vendor docs, or SEO-industry and vendor marketing. Industry numbers from vendors that sell GEO tooling are flagged as such.

## 1. GEO / AI-search optimization: what measurably drives citation and recommendation?

### Takeaway
The academic evidence is much weaker than the industry hype. Content tweaks such as adding stats, quotes and citations can change how often a source is cited *once it has already been retrieved*. But a July 2026 survey of 45 studies found no technique with a stable, cross-platform causal effect on organic discoverability. The strongest correlational signal for being *recommended* is how often the brand is mentioned off-site (YouTube, forums, third-party articles). On-page formatting is a much weaker signal.

### Cited Findings
- The founding GEO paper (Aggarwal et al., Princeton and others, 2023/KDD 2024) used 10k queries with the top-5 Google results fed to GPT-3.5. On sources that were already retrieved, "Quotation Addition" gave +41% relative visibility, "Statistics Addition" +31% and "Cite Sources" +27%. Keyword stuffing gave −8%. Limitation: the context was fixed at 5 documents, so the paper does not measure organic discoverability. This is **2023 data**, summarised in the 2026 survey. — [Critical Survey of GEO 2023–2026, arXiv 2607.14035](https://arxiv.org/html/2607.14035v1)
- The same survey reports that Vishwakarma et al. (2026) ran 252,000 trials across 6 LLMs and 18 factors. **Relevance and position in the context** were the main determinants of the first citation. Explicit prices and recent dates had measurable effects. Formatting alone had weak effects. — [arXiv 2607.14035](https://arxiv.org/html/2607.14035v1)
- Replication failure: Puerto et al. 2025 (C-SEO Bench, ~1,900 queries, 16,360 docs) found only 3 of 54 method–domain combinations significantly positive, and none positive in question answering. Gains shrink as more publishers adopt the same tactics (a "congestion" effect). In E-GEO (e-commerce), 10 of 15 heuristics were neutral or negative. — [arXiv 2607.14035](https://arxiv.org/html/2607.14035v1)
- SAGEO Arena: optimising only the body text reduced top-20 retrieval presence by about 9% and final citations by about 6%. A rewrite that helps in the generation step can lose in the retrieval step. — [arXiv 2607.14035](https://arxiv.org/html/2607.14035v1)
- The gap between name recognition and discovery is large (Sharma 2026, cited in the survey). ChatGPT recognises 99.4% of products when they are named, but surfaces them in only 3.32% of organic discovery queries. The figures for Perplexity are 94.3% and 8.29%. — [arXiv 2607.14035](https://arxiv.org/html/2607.14035v1)
- The survey's overall conclusion: "no reviewed technique shows a stable, longitudinal, cross-platform causal effect on organic discoverability or downstream behavior." Traffic-lift studies are the weakest evidence. One example is Watanabe & Nakayashiki 2026, with a 1.82× estimate whose placebo test gave p=0.16. — [arXiv 2607.14035](https://arxiv.org/html/2607.14035v1)
- Ahrefs (industry, correlational) studied 75k brands in Aug 2025 for AI Overviews, then extended the study in Dec 2025 to ChatGPT and AI Mode. Branded web mentions correlated at ~0.664 with AI visibility and backlinks at ~0.218. ChatGPT showed the weakest correlation with traditional authority signals. — [Ahrefs AI Overview brand correlation](https://ahrefs.com/blog/ai-overview-brand-correlation/); [Ahrefs: Google more biased toward big brands than ChatGPT/Perplexity](https://ahrefs.com/blog/branded-web-mentions-visibility-ai-search/)
- An Ahrefs report from May 2026 (press release) found that **YouTube mentions** were the strongest single correlate of AI brand visibility across 75k brands (~0.737). — [BusinessWire, 2026-05-26](https://www.businesswire.com/news/home/20260526119691/en/Across-75000-Brands-YouTube-Mentions-Are-the-Strongest-Signal-of-AI-Visibility-New-Ahrefs-Report-Reveals)
- A vendor case study (Track360, which sells GEO services) claims Claude's citation rate on 500+ blog posts rose from 60% to 78% in 90 days. This is a single vendor claim with no control group. — [Track360](https://track360.io/blog/generative-engine-optimization-saas-operator-guide-2026)

### Inferences
- Flying Money is a new, small brand. The 3.32% figure for organic discovery suggests an assistant will almost never recommend it unprompted for "how do I give my agent a budget". Mentions on third-party sites are the lever. That means comparison posts, YouTube demos, forum threads, GitHub READMEs of other projects and "awesome" lists. On-page GEO tweaks matter far less.
- The tactics that have evidence behind them also suit a dev tool. Put explicit prices ("0 protocol fees", gas costs), concrete dates ("mainnet caps as of 2026-xx"), extractable statistics (such as "verifies in N ms") and direct question-answer phrasing in the docs.

### Gaps
- There is no controlled study specific to developer tools or crypto-payment rails.
- I found no public data on how Claude or ChatGPT choose among competing payment SDKs.

## 2. llms.txt, AGENTS.md, docs-for-LLMs, agent cards and .well-known files: adoption and impact

### Takeaway
llms.txt is common among dev-tool sites but has **no measurable effect on AI search citation**, and frontier crawlers essentially never fetch it. Its real consumers are coding agents, IDEs, doc platforms and MCP/RAG pipelines at build time. A2A agent cards are rare and mostly non-conformant. Treat these files as cheap hygiene for agents that are already using your docs, not as a discovery channel.

### Cited Findings
- Adoption varies widely by sample:
  - 10.13% of ~300k domains (Nov 2025).
  - 8.7% of the Tranco top 1,000 (June 2026).
  - 51.8% of a developer-weighted panel of 219 hosts (Aug 2026): 68.9% of developer-tool sites and 66.7% of SaaS sites, versus 0% of media sites.
  - Source: [Digital Applied, llms.txt in practice 2026](https://www.digitalapplied.com/blog/llms-txt-in-practice-adoption-evidence-2026)
- Server-log study of ~900 domains (Sep 2025–Apr 2026): 1,227 requests for llms.txt in total, and **zero** from GPTBot, ClaudeBot, PerplexityBot or Google-Extended. 88% of sites received no requests at all. — [Digital Applied](https://www.digitalapplied.com/blog/llms-txt-in-practice-adoption-evidence-2026)
- SE Ranking studied ~300k domains and found no correlation between having llms.txt and AI citations. Their gradient-boosted model got *better* when the llms.txt feature was dropped. — [SE Ranking](https://seranking.com/blog/llms-txt/); [Digital Applied](https://www.digitalapplied.com/blog/llms-txt-in-practice-adoption-evidence-2026)
- OtterlyAI found the llms.txt entrypoint was used in 0.1% of ~60k AI bot visits. — [OtterlyAI llms.txt experiment](https://otterly.ai/blog/the-llms-txt-experiment/)
- Google has said it does not use llms.txt, and no major lab has confirmed that it fetches the file. The documented consumers are coding agents and IDE assistants fetching on demand, Mintlify (Nov 2024), and RAG/MCP build-time ingestion. — [Digital Applied](https://www.digitalapplied.com/blog/llms-txt-in-practice-adoption-evidence-2026)
- Anthropic's and MCP's own docs pages begin with a "Documentation Index … fetch https://…/llms.txt" banner inside the page markdown. This is observed directly on [modelcontextprotocol.io](https://modelcontextprotocol.io/registry/about) and [claude.com/docs](https://claude.com/docs/connectors/building/submission). Agent-facing doc sites now put the pointer *inside* each page rather than relying on crawlers to find the file.
- A2A agent cards: APIs.io/API Evangelist probed 22,341 hosts (20,185 responded) at `/.well-known/agent-card.json` and the legacy `agent.json`. Only **65 had a card (0.29%)**. Of those, 10 were fully conformant and 41 failed hard structural checks, and 15 were still at the legacy path, which A2A 1.0 clients do not read. The author observes that the card format is "decoupling from A2A" and being used as a general capability descriptor. — [API Evangelist, 2026-07-29](https://apievangelist.com/2026/07/29/most-published-agent-cards-are-not-actually-a2a/)
  - Conflict: a search-result snippet paraphrased this as "65 of 22,341 conformant". The article itself says 65 *found* and 10 conformant.
- A2A is at 1.0.0 under the Linux Foundation. Under AP2 v0.1, a merchant declares AP2 support as an extension entry *inside* the A2A agent card. — [turva.dev agent commerce discovery](https://turva.dev/guides/agent-commerce-discovery)

### Inferences
- For Flying Money: ship `llms.txt` and `llms-full.txt`, per-page markdown or "copy as markdown", and an `AGENTS.md` in the repo. These cost almost nothing and help coding agents that are *already* integrating the SDK. Don't expect them to generate recommendations.
- A conformant `/.well-known/agent-card.json` on the demo seller would put it among the ~10 conformant publishers found. That is a cheap way to stand out, but the discovery traffic is unproven.

### Gaps
- There is no causal data on whether llms.txt improves how often coding agents *write correct code*, which is the plausible benefit.
- I did not measure AGENTS.md adoption or impact. There is no study, only anecdote.

## 3. MCP registries and directories: how listings get ranked and what drives installs

### Takeaway
The official MCP Registry is a deliberately unopinionated metadata source, still in preview, that downstream marketplaces pull from. Ranking happens in the aggregators, which weight automated quality signals: installability, tools that introspect cleanly, maintenance activity and licence.

**Critical for Flying Money:** Anthropic's Software Directory Policy **prohibits** software that transfers money or crypto, or executes financial transactions, on behalf of users. An MCP server whose tools sign payment slips is likely ineligible for Claude's Connectors Directory.

### Cited Findings
- Official MCP Registry:
  - It is "currently in preview", and breaking changes or data resets are possible. It is backed by Anthropic, GitHub, PulseMCP and Microsoft. — [modelcontextprotocol.io/registry/about](https://modelcontextprotocol.io/registry/about)
  - It uses the `server.json` format and reverse-DNS names (`io.github.user/server` or `com.example/server`). Namespaces are verified by GitHub OAuth/OIDC, a DNS TXT record or an HTTP challenge. Publishing uses the `mcp-publisher` CLI. — [modelcontextprotocol.io/registry/about](https://modelcontextprotocol.io/registry/about); [official registry requirements](https://raw.githubusercontent.com/modelcontextprotocol/registry/refs/heads/main/docs/reference/server-json/official-registry-requirements.md)
  - It is "intended to be consumed primarily by downstream aggregators", which pull hourly. It is **not** meant to be read directly by hosts. Its metadata is "deliberately unopinionated". Curation and ratings are left to the aggregators, and security scanning is delegated to npm and the aggregators. — [modelcontextprotocol.io/registry/about](https://modelcontextprotocol.io/registry/about)
  - The official registry also verifies package ownership, meaning the publisher must control the npm package it references. — [official registry requirements](https://raw.githubusercontent.com/modelcontextprotocol/registry/refs/heads/main/docs/reference/server-json/official-registry-requirements.md)
- Smithery ranks results by a quality score, and a server scoring 60 sits below servers at 85+ for the same query. It checks installability and manifest validity but does not do a deep security review. This comes from a practitioner blog, not Smithery's own docs. — [DEV: Smithery score](https://dev.to/francofuji/your-mcp-server-scores-60100-on-smithery-what-it-means-and-how-to-hit-100-1h2b)
- Glama clones and rebuilds the repo, then grades **License, Quality and Maintenance** from A to F. Quality means whether introspection actually returned tools; Maintenance means commit activity. Smithery proxies HTTP, and mcp.so takes a markdown line. — [DEV: Glama vs Smithery vs mcp.so](https://dev.to/kfuras/glama-clones-your-repo-smithery-proxies-your-http-mcpso-wants-a-markdown-line-18f5); [Glama](https://glama.ai/)
- Claude Connectors Directory (primary docs):
  - What can be submitted: remote HTTPS MCP servers and MCP Apps, through claude.ai/directory/manage, from any paid plan. Local MCPB desktop-extension listings are **deprecated**. Local servers must be shipped inside a plugin, and skills are also bundled in plugins.
  - Requirements: every tool needs a `title` plus `readOnlyHint` or `destructiveHint`. You also need OAuth 2.0 for authenticated services, a test account for reviewers, docs and a privacy policy.
  - Compliance step: seven acknowledgments, including one on "financial transactions".
  - Review: submissions are scanned automatically and listed as **Community** by default. Anthropic may later promote a listing to **Verified**.
  - Source: [claude.com/docs connectors submission](https://claude.com/docs/connectors/building/submission)
- The Anthropic Software Directory Policy lists as prohibited: "Software that transfers money, cryptocurrency, or other financial assets, or executes financial transactions on behalf of users." Tool descriptions must match what the tool actually does, and must not be "written in a way that intentionally leads to other Software extraneously calling them". — [Anthropic Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)

### Inferences
- Flying Money should publish `@flying-money/mcp` to the official registry under a DNS-verified namespace (for example `com.<domain>/flying-money`) and add `mcpName` or ownership metadata to the npm package. That makes it flow into PulseMCP, Glama and other aggregators automatically.
- To score well on Glama and Smithery: a clean MIT licence, tools that introspect without secrets (a read-only/testnet mode), recent commits, and titles and annotations on every tool.
- The Claude Directory is probably closed to the payment-signing tools. Possible routes are a read-only connector (verify slips, check a budget's balance or state) or distribution as a plugin. Whether the policy also covers plugins is unverified; check with mcp-review@anthropic.com before investing. Do not word tool descriptions to steer Claude toward calling them.

### Gaps
- I found no install-count data showing how much a registry listing drives adoption.
- I did not verify PulseMCP's, mcp.so's or Cursor/VS Code MCP gallery ranking, or OpenAI's Apps/connector directory policy on payments.

## 4. Discovery in agent payment and commerce protocols (x402 Bazaar, AP2, ACP, Visa/Mastercard)

### Takeaway
x402 Bazaar is the only live, machine-queryable, self-serve seller index built for agents. Listing happens automatically when a service uses the CDP facilitator with the bazaar extension, and results carry usage-based quality signals. ACP product feeds and Instant Checkout are for merchants selling goods, gated by application and charged a fee. Visa and Mastercard run registries of *agents* and merchants aimed at card rails. None of them lists "budget rails" as such.

### Cited Findings
- x402 Bazaar:
  - It is "a search engine for agents". The `/list` endpoint returns x402 services registered with the CDP facilitator. Services are **automatically opted in** when they use the CDP facilitator and enable the bazaar extension. — [Coinbase x402 Bazaar launch](https://www.coinbase.com/developer-platform/discover/launches/x402-bazaar); [CDP Bazaar docs](https://docs.cdp.coinbase.com/x402/bazaar)
  - Each result includes a quality field: call count and unique payers over 30 days, plus when it was last called. This means ranking signals come from actual paid usage. — from a search snippet of the [CDP Bazaar docs](https://docs.cdp.coinbase.com/x402/bazaar); the full page could not be fetched because of a TLS error
  - Hosting is currently Coinbase's, with a stated plan to move to a federated model. — [Coinbase launch](https://www.coinbase.com/developer-platform/discover/launches/x402-bazaar)
  - There is also a permissionless mirror that is wire-compatible with the Bazaar API and needs no KYC to list. — [open-x402-bazaar GitHub](https://github.com/SaylorInnovations/open-x402-bazaar)
- ACP (OpenAI + Stripe):
  - It is Apache-2.0 and was released 2025-09-29.
  - The product feed can be TSV, CSV, XML or JSON, refreshed as often as every 15 minutes.
  - Instant Checkout is for approved partners only, via an application form.
  - A 4% merchant fee is reported by a secondary source.
  - Sources: [ACP feed spec](https://agentic-commerce-protocol.com/docs/commerce/specs/feed); [OpenAI commerce key concepts](https://developers.openai.com/commerce/guides/key-concepts); [Ekamoira](https://www.ekamoira.com/blog/chatgpt-instant-checkout-agentic-commerce-protocol-2026)
- Visa TAP (Oct 2025): agents get signed identities checked against a **Visa-operated directory of agent keys**. A federated directory is planned, and an "Agentic Directory" of verified agents and merchants was reported in June 2026. Mastercard Agent Pay (2025) works with Coinbase, Stripe, Cloudflare and others. These details come mostly from Eco support articles (a vendor aggregator) and should be treated as secondary. — [visa/trusted-agent-protocol GitHub](https://github.com/visa/trusted-agent-protocol); [Eco: Visa TAP](https://eco.com/support/en/articles/14845482-visa-trusted-agent-protocol-tap-explained); [Digital Commerce 360, 2026-06-12](https://www.digitalcommerce360.com/2026/06/12/visa-openai-agent-led-payments/)
- AP2 merchants advertise support inside the A2A agent card (see section 2). — [turva.dev](https://turva.dev/guides/agent-commerce-discovery)

### Inferences
- Flying Money's seller side (Hono middleware) is not x402. It could still gain Bazaar exposure in two ways: offer an x402 fallback or bridge endpoint on the demo seller, or list its demo oracle as an x402-payable resource. Bazaar rankings are driven by *paid usage*, which a testnet-only product cannot yet produce.
- The strongest positioning is to complement these protocols ("the capped prepaid budget an agent pays x402/ACP sellers from") rather than compete for listings.

### Gaps
- I could not confirm current Bazaar filtering and search endpoints, or whether non-CDP facilitators can list.
- AP2 has no public merchant registry that I could verify.

## 5. Training data, code-completion defaults and becoming "the default" an agent writes

### Takeaway
LLMs strongly favour libraries that are already widely adopted. A 2025/ACL 2026 study found unnecessary use of dominant libraries in up to 48% of cases. Agents working in real repos draw on a wider range of libraries, which suggests retrieval and docs at runtime can partly overcome training priors.

### Cited Findings
- Twist et al. (ACL 2026) studied 8 LLMs. They overuse popular libraries such as NumPy, unnecessarily in up to 48% of cases. Python was chosen in 58% of high-performance project-initialisation tasks where it was not optimal, and Rust was never chosen. — [arXiv 2503.17181](https://arxiv.org/html/2503.17181v3); [GitHub llm-code-bias](https://github.com/itsluketwist/llm-code-bias)
- In agent-authored pull requests, agents imported 3,988 unique external libraries, far more varied than non-agentic generation. — [arXiv 2512.11589](https://arxiv.org/html/2512.11589)
- Distribution through AI app builders: Lovable connects Supabase as the backend, designing the schema and wiring auth from chat, although Lovable Cloud is now the default. — [Lovable docs](https://docs.lovable.dev/integrations/supabase)

### Inferences
- Flying Money is too new to be in model training data, so its path to "default" runs through runtime retrieval:
  - An npm name that says what it does (`@flying-money/client` is fine; consider an alias or keywords such as "agent budget", "spending cap", "x402", "MCP").
  - Copy-pasteable, typed examples in the README.
  - Presence in popular templates and agent frameworks' example repos.
  - Answers on GitHub Discussions and Stack Overflow, for future training cutoffs.
- Being the integration an AI builder ships by default is the Supabase-style lever, but it depends on partnerships.

### Gaps
- There is no data on how much time it takes for a new npm package to appear in model completions.
- There is no study on how package naming affects agent selection. I did not research slopsquatting or hallucinated package names.

## 6. Case studies: growth from AI-assistant referrals

### Takeaway
Vercel is the best-documented case: ChatGPT went from under 1% to 10% of new signups between Oct 2024 and Apr 2025, per the CEO. This is **2025 data**. I could not find primary figures for Supabase, Clerk or Resend.

### Cited Findings
- Guillermo Rauch (Vercel CEO), April 2025: "ChatGPT now refers 10% of new @vercel signups". — [X/@rauchg](https://x.com/rauchg/status/1910093634445422639)
- Secondary write-ups give a trajectory of <1% (Oct 2024), 4.8% (Mar 2025) and 10% (Apr 2025), with ChatGPT at about 80% of Vercel's AI referrals. These are aggregators, not primary sources. — [aiseotracker case study](https://aiseotracker.com/case-study/vercel); [Medium analysis](https://medium.com/@gargchirag2020/how-vercel-captured-80-of-ai-search-referrals-real-data-from-the-trenches-dfc555b3fd95)

### Inferences
- Vercel's result came from being the incumbent default for a very common question ("how do I deploy my site"). A niche product such as a capped agent budget gets far less query volume. It should aim at being cited for specific long-tail questions, for example "how do I cap what my AI agent can spend in USDC" or "x402 spending limit", and track them with prompt-monitoring.

### Gaps
- There were no primary 2026 figures for Supabase, Clerk, Resend or any payments or crypto developer tool.
- Search returned no reliable source for Supabase referral numbers.
