# Seller-side cold start (A) and compliance and trust constraints on marketing (B): Flying Money, as of 2026-09-27

Scope note: these are research notes, not legal advice. Sources are cited inline. Where a source is a secondary aggregator or a weak blog, that is flagged. Dates matter: several rules below are proposed, pending, or have future effective dates.

## A1. How payment networks and API marketplaces bootstrapped supply

### Takeaway
Every successful network below won its supply side with a mix of (1) a tiny integration cost (Stripe's "seven lines"), (2) founder-led hand-holding (the "Collison installation"), (3) riding an existing marketplace where buyers already were (PayPal on eBay), and (4) paying or subsidising the early side (PayPal's $10 bonuses, Lugano's free terminals). Agent-payment protocols (x402, Stripe MPP) show that sellers will sign up fast when the integration is small and a big brand vouches for it, but real paid demand has lagged far behind headline numbers.

### Cited Findings
**Stripe**
- Paul Graham named the "Collison installation" in "Do Things That Don't Scale": when someone agreed to try Stripe, the founders took their laptop and set them up on the spot. [Win With Flynn](https://winwithflynn.com/2026/04/13/collison-installation/); [Alexander Jarvis](https://www.alexanderjarvis.com/stripe-doing-things-that-dont-scale/)
- The first integration was pitched as about seven lines of code, replacing weeks of merchant-account setup. The first 20 to 30 users came through YC connections: technical founders who gave real feedback. [Stacksync](https://www.stacksync.com/blog/seven-lines-of-code-from-rural-ireland-the-origin-story-of-stripe) (secondary)

**PayPal on eBay**
- In late 1999 and 2000, PayPal paid a $5 to $10 sign-up bonus and a $5 to $10 referral bonus, which works out to about $20 per new customer. [PayPal S-1/A (SEC, 2001)](https://www.sec.gov/Archives/edgar/data/0001103415/000091205701544857/a2060419zs-1a.htm); [Aakash Gupta](https://www.aakashg.com/paypal-the-original-product-growth-company/)
- PayPal built for an existing marketplace, eBay. Its button soon carried more volume than eBay's own in-house payment product. [Aakash Gupta](https://www.aakashg.com/paypal-the-original-product-growth-company/)
- I could not source the often-told story that PayPal ran bots that bought items on eBay and insisted on paying with PayPal. See Gaps.

**RapidAPI (a warning)**
- Founded in 2015. At its peak it had about 4 million developers and about 40,000 APIs, and reached a $1B valuation with a 2022 Series D led by SoftBank. [TechCrunch](https://techcrunch.com/2024/11/13/nokia-acquires-rapid-the-api-company-once-valued-at-1b/)
- In 2023 it laid off 82% of staff. In November 2024 Nokia bought its technology and R&D unit, reportedly for about $106M. [TechCrunch](https://techcrunch.com/2024/11/13/nokia-acquires-rapid-the-api-company-once-valued-at-1b/); [Ctech](https://www.calcalistech.com/ctechnews/article/rkq00numzyg). The ~$106M figure comes from secondary sources; TechCrunch does not confirm the price.

**Apify Store (a creator-economy model for tools)**
- Developers publish "Actors" (scrapers and automations) and, since late 2025, MCP servers. They are paid monthly and commonly keep 80% of revenue, minus platform compute costs. [Apify docs](https://docs.apify.com/actors/publishing/monetize); [Apify partners page](https://apify.com/partners/actor-developers)
- A secondary blog reports that Apify pays about $1.4M a month to about 3,000 developers, roughly $470 average with a long tail at zero. Apify says top creators pass $10k MRR. [AgentByline](https://agentbyline.com/articles/apify-actor-passive-income-what-really-earns-in-2026-67lcfr) (weak source; the $1.4M figure is unverified); [Apify help](https://help.apify.com/en/articles/8684010-make-money-publishing-your-actors-on-apify-store)
- Apify is retiring flat monthly rentals in favour of pay-per-event. New rental listings stopped on 2026-04-01 and the rental model closes on 2026-10-01. [AgentByline](https://agentbyline.com/articles/apify-actor-passive-income-what-really-earns-in-2026-67lcfr) (verify on Apify's site)

**x402 (Coinbase, now the x402 Foundation)**
- Coinbase and Cloudflare announced the x402 Foundation in September 2025. It later moved to the Linux Foundation. Cloudflare added a deferred-payment scheme to its pay-per-crawl beta, plus x402 tools in its Agents SDK and MCP integrations. [Cloudflare blog](https://blog.cloudflare.com/x402/); [Linux Foundation](https://www.linuxfoundation.org/press/linux-foundation-is-launching-the-x402-foundation-and-welcoming-the-contribution-of-the-x402-protocol)
- On Base, x402 went from near zero in mid-2025 to over 100M cumulative transactions through Q1 2026. Much of the growth came from memecoin farming (for example the "PING" pay-to-mint token). Chainalysis also reports that tester-to-payer conversion rose about 4x in six months. [Chainalysis](https://www.chainalysis.com/blog/x402-agentic-payments-adoption/)
- As of March 2026, real volume was about $28k a day, with about 131k transactions a day and an average of about $0.20. Artemis classed about 50% of transactions as self-dealing or wash trading. CoinDesk: "the merchants that x402 is designed to serve are still rare." [CoinDesk](https://www.coindesk.com/markets/2026/03/11/coinbase-backed-ai-payments-protocol-wants-to-fix-micropayment-but-demand-is-just-not-there-yet)
- Visa and Artemis ("Agentic Payments from the Ground Up", 2026-07-14, data as of 2026-04-21) reportedly cut 178.3M raw transactions and about $135.7M raw volume down to about $15.0M adjusted. They classed about 39% of transactions and 89% of dollar volume as wash, test or internal. [Bitget News summary](https://www.bitget.com/news/detail/12560605260663) (secondary; the primary report was not fetched)
- An aggregator reports sellers up 23% and buyers up 37% over 30 days as of May 2026. [Nevermined](https://nevermined.ai/blog/stablecoin-payments-ai-agents-statistics) (vendor blog, weak)

**Stripe Machine Payments Protocol (MPP) and Tempo**
- MPP launched on 2026-03-18, co-authored by Stripe and Tempo. It accepts stablecoins on Tempo plus cards and BNPL through Shared Payment Tokens. [Stripe blog](https://stripe.com/blog/machine-payments-protocol)
- Launch sellers were Browserbase (headless browsers, pay per session), Parallel Web Systems (web API, pay per call), PostalForm (physical mail), Prospect Butcher Co. (sandwiches ordered by agents in NYC) and Stripe Climate. Parallel's founder said the integration took "a few lines of code." [Stripe blog](https://stripe.com/blog/machine-payments-protocol)
- A secondary source claims MPP reached about 2.3k sellers in 5 days, against about 5 months for x402. [search snippet via getaibook/ChainCatcher](https://getaibook.com/news/stripe-launches-machine-payments-protocol) (unverified)

**Cloudflare pay per crawl / pay per use**
- Pay per crawl lets a site owner choose Allow, Charge (one flat price per request across the domain) or Block for each AI crawler, enforced at the edge with HTTP 402. [Cloudflare blog](https://blog.cloudflare.com/introducing-pay-per-crawl/); [adigitalboom summary](https://adigitalboom.com/tech/cloudflare-pay-per-crawl/)
- On 2026-07-01 Cloudflare added "Pay Per Use", which pays publishers when their content appears in an AI answer. The launch partners are Ceramic.ai and You.com. From 2026-09-15, "mixed-use" crawlers are blocked by default on ad-hosting pages for new customers, new sites and all free-tier users. [TechCrunch](https://techcrunch.com/2026/07/01/cloudflares-new-policy-pushes-ai-companies-to-pay-for-publishers-content/)
- Stack Overflow publicly partnered with Cloudflare on pay-per-crawl (February 2026). [Stack Overflow blog](https://stackoverflow.blog/2026/02/19/stack-overflow-cloudflare-pay-per-crawl/) (not fetched; title only)

**Marketplace cold-start theory**
- Andrew Chen: build an "atomic network", the smallest stable network that is useful on its own. Win and keep the "hard side", usually the sellers. Start small: one city, one campus, or invite-only. [Lenny's Newsletter](https://www.lennysnewsletter.com/p/atomic-network); [Sachin Rekhi summary](https://www.sachinrekhi.com/p/andrew-chen-the-cold-start-problem)

### Inferences
- For Flying Money, the "hard side" is sellers, and the cleanest atomic network is **one seller plus its existing customers**. Because a certificate names one seller, the seller can bring its own buyers (as eBay sellers brought PayPal users). The pitch to a seller is "give your existing API customers or regulars a prepaid, capped tab", not "join a network".
- Chainalysis and CoinDesk suggest seller counts are cheap and real demand is scarce. Report paid redemptions by independent buyers, not seller or transaction counts. Wash-trading critiques of x402 are well known, so honest metrics set a project apart.
- Stripe MPP and x402 launch lists show which sellers agents pay today: browsers and sessions, web search and scrape APIs, data, and physical fulfilment. Flying Money's own demo seller (the Hono oracle) is a form of seeding supply. Label it clearly as a demo so it is not mistaken for traction.

### Gaps
- There was no primary source for the "PayPal eBay bots" story, and no primary data on OpenRouter's supply bootstrapping (provider count, how it recruited inference providers), Square's early merchant tactics, or Shopify App Store developer payouts. None were researched to the source standard.
- I found no authoritative counts of x402-accepting services by category. The x402 counter at x402.org is reportedly stale ([Daniel McGlynn](https://www.danielmcglynn.com/the-x402-counter-has-shown-the-same-four-numbers-since-march/), unverified).
- There is no reliable data on paid MCP-tool marketplaces other than Apify.

## A2. Which seller segments most want to charge agents per request (2025 to 2026)

### Takeaway
There is clear appetite among content publishers fighting AI crawlers (Cloudflare's default-block move and Stack Overflow), browser, scraping and search API vendors (Browserbase, Parallel, Apify creators) and MCP authors. Paid volume is still small: most MCP servers earn nothing, and real x402 commerce was tens of thousands of dollars a day in H1 2026.

### Cited Findings
- **Publishers.** Cloudflare says that, after hundreds of conversations, publishers want AI access but want to be paid. Most site owners "want protections against having their intellectual property given away for free." [Cloudflare blog](https://blog.cloudflare.com/introducing-pay-per-crawl/); [TechCrunch](https://techcrunch.com/2026/07/01/cloudflares-new-policy-pushes-ai-companies-to-pay-for-publishers-content/)
- **Browser and web-access infrastructure** was among MPP's launch sellers (Browserbase, Parallel). [Stripe blog](https://stripe.com/blog/machine-payments-protocol)
- **Scraping and automation.** Apify moved from rentals to pay-per-event pricing and added MCP hosting, which suggests that per-use billing fits agent callers. [Apify docs](https://docs.apify.com/actors/publishing/monetize)
- **MCP authors.** Community posts claim over 20,000 MCP servers exist, fewer than 5% earn anything, and global agent-to-tool payment volume is under $50k a day. [DEV Community](https://dev.to/kirothebot/the-state-of-mcp-monetization-in-2026-where-builders-actually-get-paid-34k9) (weak, uncited stats; direction only)
- Chainalysis found x402 payments of $1 or more rose from 49% to 95% of volume (early 2025 to early 2026). This means fewer true micropayments and more dollar-scale purchases. [Chainalysis](https://www.chainalysis.com/blog/x402-agentic-payments-adoption/)

### Inferences
- The best early Flying Money sellers are **MCP and API authors who already have a few paying users and hate subscriptions and chargebacks**. Next come **data oracles and feeds**, where a prepaid, capped budget matches "N calls a month". Publishers are well served by Cloudflare and are the weakest fit, because they need many buyers and a one-seller certificate does not suit crawlers.
- Chainalysis shows that dollar-scale payments now dominate. That fits Flying Money's model better than sub-cent micropayments: a 100 USDC cap per certificate suits prepaid bundles.

### Gaps
- There is no rigorous survey of seller willingness to accept per-request stablecoin payments. The evidence is mostly anecdotal and vendor-published.

## A3. Tactics: single-player value, seeding, subsidies, one-line integration, revenue share, directories

### Takeaway
The proven tactics are: make the seller tool useful on its own; do setup by hand; cut integration to a few lines; subsidise the first buyers; list sellers in a directory or marketplace; and offer revenue share where there is a platform take. Flying Money has no fee, so it cannot pay revenue share and has to compete on cost and ownership.

### Cited Findings
- **One-line or minimal integration** is the lead message for Stripe ("seven lines"), MPP ("a few lines of code") and x402 middleware. [Stacksync](https://www.stacksync.com/blog/seven-lines-of-code-from-rural-ireland-the-origin-story-of-stripe); [Stripe blog](https://stripe.com/blog/machine-payments-protocol)
- **Manual onboarding** ("Collison installation"). [Win With Flynn](https://winwithflynn.com/2026/04/13/collison-installation/)
- **Subsidising the demand side**: PayPal's $10 plus $10 bonuses. [PayPal S-1/A](https://www.sec.gov/Archives/edgar/data/0001103415/000091205701544857/a2060419zs-1a.htm)
- **Subsidising the supply side**: Lugano gives Bitcoin/USDT payment terminals to local merchants for free. [GoCrypto](https://www.gocrypto.com/blog/luganos-plan-building-the-next-bitcoin-city); [Digital Watch](https://dig.watch/updates/swiss-city-deepens-crypto-adoption-as-350-businesses-now-accept-bitcoin)
- **Revenue share and directories**: Apify's 80% creator share plus a store directory. [Apify docs](https://docs.apify.com/actors/publishing/monetize)
- **Invite-only and small geography**: Chen's atomic-network tactics. [Lenny's Newsletter](https://www.lennysnewsletter.com/p/atomic-network)

### Inferences
- **Single-player value for a Flying Money seller:** (a) a capped, prepaid budget with zero chargeback exposure and local verification; (b) one-transaction redemption; (c) a "shop mode" till that works for one café with its regulars. Market these as reasons to integrate even if the seller has no other Flying Money buyers.
- **Subsidy without a token:** founders could fund small testnet-to-mainnet starter certificates for the first buyers of each onboarded seller. Keep them within the 100 USDC cap, and be careful in how they are presented (see B: a "free money" framing may create promotion issues).
- **Directory:** a public list of sellers with verifiable redemption history is the analogue of Apify's store. Put no event branding on it (AGENTS.md §21.2).

### Gaps
- There is no data on how well stablecoin-specific seller subsidies convert. None of the sources measured it.

## A4. Physical shops: lessons from local QR and crypto merchant programmes

### Takeaway
Merchant adoption lasts when paying is cheaper, faster and irreversible for the merchant, and when consumers already hold the instrument (Pix). It fades when it depends on evangelism, device upkeep and a volatile asset (Bitcoin Beach and Chivo). Lugano shows that subsidised terminals and city backing can sign up about 350 to 400 merchants, but sign-ups say little about actual use.

### Cited Findings
- **El Salvador and Bitcoin Beach.** Chivo terminals were often uncharged or out of date, and staff lacked know-how. [Rest of World (2022)](https://restofworld.org/2022/el-salvador-bitcoin/)
- A UCA survey found 8.1% of Salvadorans used bitcoin to pay for something in 2024. Central Bank data show 161 of 181 registered bitcoin businesses were non-operational as of April 2025. [Wikipedia summary](https://en.wikipedia.org/wiki/Bitcoin_in_El_Salvador); [Cryptonomist, 2026-08-26](https://en.cryptonomist.ch/2026/08/26/bitcoin-payments-el-salvador-decline/)
- One El Zonte restaurant reportedly logged a single bitcoin payment in August 2026. Customers now mostly use cards or cash. [crypto.news](https://crypto.news/bitcoin-payments-fade-at-el-salvadors-bitcoin-beach/) (anecdotal)
- **Lugano Plan ₿.** Between about 350 and about 400 merchants accept BTC, USDT or LVGA (the counts vary by source), including McDonald's. The city accepts taxes and fines with instant CHF conversion, and terminals are free, backed by Tether. [Plan ₿](https://planb.lugano.ch/); [Digital Watch](https://dig.watch/updates/swiss-city-deepens-crypto-adoption-as-350-businesses-now-accept-bitcoin); [crypto.news](https://crypto.news/bitcoin-bulls-face-make-or-break-test-in-luganos-real-world-payments-push/) ("make-or-break test", which questions real usage)
- **Pix (Brazil).** QR codes were a first-class, central-bank-specified format from day one. Merchant fees averaged about 0.33% against 2 to 5% for cards. Settlement is instant, 24/7, with no chargebacks. Pull from consumers drove merchants to adopt. [Payment Expert (2026-08-13)](https://paymentexpert.com/2026/08/13/how-brazil-central-bank-built-pix/); [Rebill](https://www.rebill.com/en/blog/pix-your-ticket-to-the-brazilian-market) (fee figure is secondary)
- **Solana Pay and Shopify (August 2023).** USDC was chosen because merchants and consumers "think in dollars." About 200 Shopify stores adopted the Helio plugin within three months. [CoinDesk](https://www.coindesk.com/tech/2023/08/23/shopify-customers-can-now-pay-in-usdc-via-solana-pay); [Solana case study](https://solana.com/news/case-study-helio)

### Inferences
- Flying Money's shop mode sidesteps volatility (USDC) and chargebacks, the two things merchants liked about Pix and hated about bitcoin. It lacks Pix's instant consumer reach, though: a buyer must first lock a budget for that shop. The best fit is **regulars and pre-paid tabs** (a café's regulars, a coworking space, an event vendor), not walk-in strangers. That also matches the spec's exclusion of offline cash between strangers.
- Report actual redemptions per merchant rather than "merchants onboarded", to avoid the Lugano and El Salvador sign-up-versus-usage trap.

### Gaps
- GCash and QR Ph merchant-adoption data were not researched. The Philippines is relevant to the founder but I found no sourced material.

## B1. Laws and regulator rules on marketing a stablecoin payments product (US, EU, UK, Singapore, Philippines)

### Takeaway
Across jurisdictions the constant is: never suggest government backing, deposit insurance, "safe" or "guaranteed", or regulated status you do not have. The US GENIUS Act is law but not yet in force: proposed rules are out, and it takes effect by 2027-01-18 at the latest. The EU (MiCA) and UK (FCA) promotion rules mainly bind issuers and service providers, not neutral software, but their perimeter rules decide whether you are one. Singapore bars regulated DPT providers from general-public advertising. The Philippines is actively enforcing against unregistered crypto platforms.

### Cited Findings
**US: GENIUS Act (enacted 2025-07-18)**
- The Act takes effect on the earlier of 18 months after enactment (**2027-01-18**) or 120 days after final regulations. Most rules were due by 2026-07-18. [Chapman tracker](https://www.chapman.com/publication-genius-act-rulemaking-tracker); [Stinson](https://www.stinson.com/newsroom-publications-occ-and-treasury-department-issue-requests-for-comments-on-genius-act-proposed-implementation-rulemakings)
- **Rulemaking status:**
  - OCC NPRM on 2026-02-25 (comments closed 2026-05-01). [OCC Bulletin 2026-3](https://www.occ.gov/news-issuances/bulletins/2026/bulletin-2026-3.html)
  - Treasury NPRM on state "substantially similar" regimes on 2026-04-03 (comments closed 2026-06-02). [Federal Register](https://www.federalregister.gov/documents/2026/04/03/2026-06489/genius-act-broad-based-principles-for-determining-whether-a-state-level-regulatory-regime-is)
  - FinCEN/OFAC AML/sanctions NPRM on 2026-04-08. [Treasury](https://home.treasury.gov/news/press-releases/sb0435)
  - FDIC NPRM in April 2026. [Federal Register](https://www.federalregister.gov/documents/2026/04/10/2026-06974/genius-act-requirements-and-standards-for-fdic-supervised-permitted-payment-stablecoin-issuers-and-insured-depository-institutions)
  - I did not confirm whether any final rules were issued by 2026-09-27. Treat this as a gap.
- **Marketing bans on issuers:** no deceptive names, and no suggestion that a stablecoin is legal tender, issued by the US, or guaranteed or approved by the US government. "USD"-type abbreviations are allowed. Civil penalties apply. [Latham](https://www.lw.com/en/insights/the-genius-act-of-2025-stablecoin-legislation-adopted-in-the-us); [Arnold & Porter](https://www.arnoldporter.com/en/perspectives/advisories/2026/04/implementing-the-genius-act)
- The proposed FDIC rule says reserve deposits backing a stablecoin are **not** pass-through insured to holders. [Arnold & Porter](https://www.arnoldporter.com/en/perspectives/advisories/2026/04/implementing-the-genius-act)
- **Yield:** issuers may not pay interest or yield. Third-party arrangements are not expressly barred. [Latham](https://www.lw.com/en/insights/the-genius-act-of-2025-stablecoin-legislation-adopted-in-the-us)
- **Carve-out for self-custody software:** the Act excludes persons "providing hardware or software to facilitate a customer's own custody or safekeeping" of stablecoins or keys. [Latham](https://www.lw.com/en/insights/the-genius-act-of-2025-stablecoin-legislation-adopted-in-the-us)
- **Digital asset service providers** may not offer or sell non-permitted payment stablecoins to US persons from **three years after enactment** (about July 2028). [Latham](https://www.lw.com/en/insights/the-genius-act-of-2025-stablecoin-legislation-adopted-in-the-us)

**US: FTC**
- The FTC sued Voyager's ex-CEO for claiming deposits were FDIC-insured and "safe". The company settled with a permanent ban on handling consumer assets. The FTC consumer alert warns about crypto firms touting FDIC insurance. [FTC press release](https://www.ftc.gov/news-events/news/press-releases/2023/10/ftc-reaches-settlement-crypto-company-voyager-digital-charges-former-executive-falsely-claiming); [FTC consumer alert](https://consumer.ftc.gov/consumer-alerts/2023/10/crypto-companies-touting-fdic-insurance-not-so-fast)

**EU: MiCA**
- Marketing communications must be fair, clear and not misleading, and identified as marketing (Art. 66 for CASPs). Arts. 7 and 9 apply to marketing communications about offers or admissions published after 2024-12-30. [Norton Rose Fulbright](https://www.nortonrosefulbright.com/en/knowledge/publications/2cec201e/regulating-crypto-assets-in-europe-practical-guide-to-mica); [ESMA MiCA page](https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica)
- ESMA's reverse-solicitation guidelines treat almost any marketing by non-EU firms that reaches EU clients as solicitation. [Maples Group](https://maples.com/regulatory-round-up/esma-reverse-solicitation-guidance-mica)

**UK: FCA**
- The cryptoasset financial promotions regime (PS23/6, in force since October 2023) still applies. Until the new regime starts, FCA crypto oversight is limited to promotions and AML. [Skadden](https://www.skadden.com/insights/publications/2026/07/fca-finalises-core-rules-for-the-uk-cryptoasset-regime); [Latham tracker](https://www.lw.com/en/uk-cryptoasset-regulatory-tracker)
- Key 2026 dates:
  - Final policy statements on 2026-06-30.
  - Perimeter guidance on 2026-09-16.
  - Authorisation window from 2026-09-30 to 2027-02-28.
  - New regime starts on **2027-10-25**.
  - [FCA overview](https://www.fca.org.uk/publications/policy-statements/cryptoasset-regime); [search summary of Skadden](https://www.skadden.com/insights/publications/2026/07/fca-finalises-core-rules-for-the-uk-cryptoasset-regime)
- Transactions in UK qualifying stablecoins are reportedly **outside** the promotions regime, except for lending and borrowing. Issuing a qualifying stablecoin becomes a new Financial Promotions Order activity. [search summary; verify against FCA/HMT text](https://www.gov.uk/government/publications/policy-note-draft-statutory-instrument-amending-the-cryptoasset-regulations/draft-statutory-instrument-amending-the-financial-services-and-markets-act-2000-cryptoassets-regulations-2026-policy-note). This applies to *UK* qualifying stablecoins; USDC's status under it is unconfirmed.

**Singapore: MAS**
- Under PS-G02, DPT service providers must not promote DPT services to the general public: no ads on public transport, third-party websites or social media, and no public events or roadshows. [MAS PS-G02](https://www.mas.gov.sg/regulation/guidelines/ps-g02-guidelines-on-provision-of-digital-payment-token-services-to-the-public); [Sidley](https://www.sidley.com/en/insights/newsupdates/2022/01/monetary-authority-of-singapore-issues-guidelines-on-digital-payment-token-services-to-the-public)
- The PS-G03 consumer-protection guidelines have been in force since 2025-06-19. [MAS PS-G03](https://www.mas.gov.sg/-/media/mas-media-library/regulation/guidelines/pso/ps-g03-guidelines-on-consumer-protection-measures-by-digital-payment-token-service-providers/ps-g03_guidelines-on-consumer-protection-safeguards-by-dpt-service-providers_vf.pdf)

**Philippines**
- The SEC CASP Rules (MC No. 4, s. 2025) took effect on 2025-07-05. They require a ₱100M minimum paid-up capital. The SEC then named ten unregistered offshore exchanges, and the NTC ordered ISPs to block 50 platforms. The BSP separately licenses VASPs. [Baker McKenzie](https://insightplus.bakermckenzie.com/bm/technology-media-telecommunications_1/philippines-sec-issues-rules-and-guidelines-on-crypto-asset-service-providers-casp); [startup.ph](https://www.startup.ph/the-philippines-is-actually-enforcing-its-crypto-exchange-rules-now-and-bybit-just-found-out/); [BitPinas](https://bitpinas.com/regulation/bsp-reminds-vasp/)

### Inferences
- **Words to avoid in Flying Money copy:** "bank", "account" (as in a deposit account), "FDIC", "insured", "safe", "guaranteed", "risk-free", "government-backed", "legal tender", "interest", "yield", "earn", and "regulated/approved" (it is not). Also avoid "escrow" if it implies a licensed escrow agent. Prefer "prepaid, capped budget held by a public smart contract", "you can reclaim unspent USDC after the end date", and "USDC is issued by Circle, not by us".
- MiCA and FCA promotion rules bind issuers, CASPs and authorised persons. Whether Flying Money's operators or website fall in scope depends on whether they "arrange" or "deal". An MIT-licensed software project with no fee, no custody and no admin keys has a stronger case for being neutral software. A hosted web app that helps users lock funds needs a jurisdiction-specific legal review before it is marketed in the UK, EU, SG or PH. Don't geo-target ads to Singapore.
- USDC's GENIUS status will depend on Circle becoming a permitted issuer. Copy should not promise regulatory status on Circle's behalf.

### Gaps
- Whether final OCC, FDIC or Treasury GENIUS rules were issued between July and September 2026 was not confirmed.
- The CFPB's 2026 posture on crypto marketing and Regulation E coverage of stablecoin payments was not researched. SEC 2026 guidance on marketing tokens that are not securities (such as stablecoins) was not fetched.
- The exact FCA treatment of promotions for *non-UK* stablecoins (USDC) after 2027 is unverified.
- Philippine rules specific to *advertising* by software projects (as opposed to CASPs) were not found.

## B2. Money transmission and how non-custodial open-source projects describe themselves

### Takeaway
US federal guidance since 2019 (FinCEN FIN-2019-G001) says non-custodial software providers without "total independent control" over value are not money transmitters. The GENIUS Act adds a carve-out for self-custody software. The Blockchain Regulatory Certainty Act, which would put the non-controlling-developer principle into statute, is pending legislation, not law.

### Cited Findings
- FinCEN's 2019 guidance: unhosted wallets and certain non-custodial models are not money transmitters, and money transmission requires "total independent control" over value. Developers of software are distinct from the people who use it to transmit. [Jones Day](https://www.jonesday.com/en/insights/2019/06/fincen-consolidates-guidance); [Covington](https://www.cov.com/-/media/files/corporate/publications/2019/11/fincen-issues-guidance-to-synthesize-regulatory-framework-for-virtual-currency.pdf)
- The Blockchain Regulatory Certainty Act of 2026 would exempt non-controlling developers and infrastructure providers (those without the legal right or unilateral ability to move user funds) from BSA money-transmitter obligations. It is **advocacy material and pending**. [DeFi Education Fund](https://www.defieducationfund.org/myths-vs-facts-the-blockchain-regulatory-certainty-act/)
- The GENIUS Act excludes providers of self-custody hardware and software. [Latham](https://www.lw.com/en/insights/the-genius-act-of-2025-stablecoin-legislation-adopted-in-the-us)

### Inferences
- Flying Money's design facts map directly onto these tests and should be stated plainly: no owner or admin keys, no ability to move user funds, no protocol fee, open-source MIT, and the buyer's own key or wallet locks and reclaims funds. Useful self-descriptions:
  - "open-source software"
  - "a public smart contract you interact with from your own wallet"
  - "we never hold your funds or keys"
- Avoid "we process payments", "our payment network", "your balance with us" and "we'll refund you".
- Risks to flag for counsel: a hosted relayer, inbox or request service (the repo has new `api/inbox` and `api/requests` routes) or a hosted demo seller could look like operating a service rather than publishing software. State law and non-US regimes may differ from FinCEN's view.

### Gaps
- State money-transmitter views on non-custodial software (for example NYDFS) were not researched.
- The Senate or House status of BRCA or a market-structure bill as of 2026-09-27 was not confirmed.

## B3. Communicating the risk of an unaudited, testnet project, and security as marketing

### Takeaway
Regulators punish "safe" claims (the Voyager case). The honest pattern is to state the risks, name what has not been done (no audit yet), and present verifiable limits (immutable caps, no admin keys, invariant tests, a bug bounty) as constraints, not guarantees.

### Cited Findings
- The FTC's Voyager case shows that "safe" plus insurance-style claims about crypto funds bring personal liability for executives. [FTC](https://www.ftc.gov/news-events/news/press-releases/2023/10/ftc-reaches-settlement-crypto-company-voyager-digital-charges-former-executive-falsely-claiming)
- MiCA requires marketing to be fair, clear, not misleading and labelled as marketing. [Norton Rose Fulbright](https://www.nortonrosefulbright.com/en/knowledge/publications/2cec201e/regulating-crypto-assets-in-europe-practical-guide-to-mica)
- Reddit requires risk disclaimers and compliant landing pages for crypto ads. [Reddit Ads Help](https://business.reddithelp.com/s/article/financial-cryptocurrency-products-and-services-policy)

### Inferences
- Suggested honest copy patterns:
  - "Testnet. Unaudited. Don't use real funds."
  - "When mainnet launches, each certificate is capped at 100 USDC and each deployment at 1,000 USDC. The caps are in immutable code and nobody can raise them."
  - "Invariants I1 to I7 are tested with fuzzing (256 runs × depth 50)."
  - "Found a bug? [bounty terms]."
- Present caps as a way to limit the blast radius ("the most you can lose to a bug is what you locked, and at most 100 USDC"), not as proof of safety.
- Say "audited" only after an audit, and name the auditor, scope and commit hash. Never say "secure", "hack-proof" or "formally verified" unless those are true and narrowly scoped.

### Gaps
- I found no sourced case studies in this pass on security posture as marketing (for example Uniswap or Liquity immutability messaging, Immunefi bounty-size marketing, or Certora/formal-verification messaging). This needs a follow-up search if the report writer wants examples.

## B4. Platform advertising policies for crypto (Google, Meta, X, Reddit) as of 2026

### Takeaway
Paid ads for anything that lets users swap, trade or hold crypto need certification or written permission and usually a licence. Educational content and "businesses accepting crypto payment" are allowed on Google without certification. Flying Money should favour organic and developer channels, and frame any ads around developer tools and sellers accepting payment, not around consumers holding or moving USDC.

### Cited Findings
**Google**
- Google prohibits ads for ICOs, DeFi trading protocols, and buying, selling or trading crypto. Hardware and software wallets, exchanges and US coin trusts are restricted: they need certification, and US exchanges need FinCEN MSB registration plus a state money-transmitter licence or a bank charter. [Google Ads policy](https://support.google.com/adspolicy/answer/14009787?hl=en)
- Google **allows** ads from "businesses accepting cryptocurrency payment" and for "cryptocurrency educational materials" that do not offer investment advice. [Google Ads policy](https://support.google.com/adspolicy/answer/14009787?hl=en)
- From June 2026, certification applications move into the Google Ads account. An August 2026 update covers the EEA: exchange and wallet ads there require a MiCA CASP licence. [Google update, Aug 2026](https://support.google.com/adspolicy/answer/17264747?hl=en); [ALM Corp](https://almcorp.com/blog/google-ads-cryptocurrency-certification-2026-guide/)

**Meta**
- Meta requires written permission and a recognised licence or registration to advertise crypto trading platforms and software or services that enable monetising, swapping or staking crypto. [Meta Transparency Center](https://transparency.meta.com/policies/ad-standards/restricted-goods-services/cryptocurrency-products-and-services/)
- A secondary source reports that a tiered authorisation system arrived in March 2026. [Stackmatix](https://www.stackmatix.com/blog/meta-ads-policy) (unverified)

**X**
- From 2026-03-01, crypto is banned from X's Paid Partnerships (influencer) programme but still allowed through formal X Ads, with a clear paid-promotion disclosure. [Cryptonomist](https://en.cryptonomist.ch/2026/03/02/x-crypto-ads-policy-shifts/); [X ads policy log](https://business.x.com/en/help/ads-policies/ads-policy-update-log)

**Reddit**
- Crypto is a restricted category. It must be managed by a Reddit sales representative, may need pre-approval and documentation, and requires risk disclaimers. [Reddit Ads Help](https://business.reddithelp.com/s/article/financial-cryptocurrency-products-and-services-policy)

### Inferences
- A consumer-facing ad along the lines of "lock USDC for your agent" would likely be read as a software wallet or a swap/monetisation service and need certification or a licence that Flying Money does not have. Developer-facing content ("accept agent payments in your API with Hono middleware"), education and organic GitHub, docs and community channels are the low-friction route.
- X paid-influencer deals for crypto are banned as of March 2026. Any sponsored developer-relations content should go through formal X Ads with disclosure, or not be used.

### Gaps
- I did not fetch the primary Meta and X policy text for 2026 changes. The tiered Meta system and the details of the X changes come from secondary sources.
- LinkedIn and GitHub sponsorship policies for crypto developer tools were not researched.
