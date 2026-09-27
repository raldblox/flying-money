# Consumer marketing for a budget / allowance / prepaid-spending product in the agentic era (as of Sept 2026)

Scope note: Flying Money = owner sets aside USDC for one seller, one spender, one end date; holder pays by QR at the counter; leftovers return to owner; also "hand over a budget, not your wallet" for personal AI agents. Research done 2026-09-27 with about 20 search/fetch calls. Where a stat came only from a secondary or aggregator site, it is flagged.

## 1. Consumer trust and fear around AI agents spending money (2025–2026 surveys)

### Takeaway
Most people already use AI to shop, but only about a quarter or fewer trust it to pay on its own. Across several 2026 surveys the top things people ask for are **spending caps, instant revocation/cancellation, and the ability to review or override**. That is almost word for word the Flying Money pitch: a hard cap, one merchant, an end date, and leftovers come back. Trust goes to brands people already know (Visa, PayPal), not to "the AI".

### Cited Findings
- **Visa Trust Index (Harris Poll, May 26–28 2026, n=2,065 US adults; released Sept 9 2026):** 72% have used an AI assistant; only **23%** trust GenAI to handle payment transactions on its own; **61%** would trust Visa to handle agent-initiated payments; trust in Visa is 68% among 18–34s and 71% among frequent AI users. — [Visa IR press release](https://investor.visa.com/news/news-details/2026/New-Visa-Research-Finds-Consumer-Trust-is-Accelerating-the-Path-to-Agentic-Commerce/default.aspx)
- Brand trust tiers in Visa's agentic research (US/AU/NZ, 2025): PayPal came second at 28%, then Apple, Google and Mastercard (about 15%), then Microsoft, Meta and Amex. — [Visa, Earning consumer trust in agentic commerce (PDF)](https://corporate.visa.com/content/dam/VCOM/corporate/products/documents/earning-consumer-trust-in-the-age-of-agentic-commerce.pdf) (numbers from a search summary; the PDF itself was not opened)
- **39%** would trust AI-initiated payments if they kept the ability to override transactions. Visa names "spending limits and merchant restrictions" as the path to wider adoption. — [Fintech Garden summary of Visa Trust Index](https://fintech.garden/news/2026-09-10-visa-survey-finds-most-americans-use-ai-for-shopping-but-few-trust-it-to-make-pa/) (secondary source; the 39% did not appear in the Visa IR page I fetched)
- About 9 in 10 want transparency into how agents make decisions, and about half would stop using them if that control disappeared. — [Crowdfund Insider on Visa research](https://www.crowdfundinsider.com/2026/09/308695-visa-research-consumer-trust-is-enabling-path-to-agentic-commerce/) (secondary)
- Visa's own agent credential is described as a "scoped credential that carries spending limits, merchant restrictions, and category controls set by the human account holder". The incumbents are building the same scoped-budget idea Flying Money uses. — [Visa Intelligent Commerce](https://www.visa.com/en-us/solutions/intelligent-commerce) (via search summary)
- **Checkout.com, "Agentic Commerce 2026" (June 9 2026, six markets):** the top non-negotiables for agent shopping are **spending caps (30%)**, **instant revocation (29%)** and **easy cancellation (28%)**. On average consumers would let an agent spend **£177 per purchase** without approval; merchants assumed £200. By category, 41% would delegate groceries, 31% household supplies and 15% financial services. 27% trust *no* organisation to run shopping agents and 24% will never delegate. 75% of merchants say real-time permission revocation is critical. 33% expect at least 10% of their purchases to be AI-driven within a year. — [Checkout.com newsroom](https://www.checkout.com/newsroom/consumer-demand-for-ai-shopping-is-forming-fast-but-trust-for-agentic-commerce-is-still-catching-up)
- **NMI (Aug 26 2026, n=1,000 US adults):** only 11% have completed a transaction with AI. 10% would give AI complete purchasing control and 45% wouldn't trust AI to buy at all. **70%** need to review or override before purchase. **60% worry AI could spend beyond intended amounts.** 69% distrust the security of AI payment processing and 84% have never uploaded payment details to an AI tool. 76% are uncomfortable with AI completing purchases alone. **Parents** adopt more: 48% used AI for shopping vs 25% of non-parents, and 19% completed transactions vs 7%. Among Millennials and Gen Z, 48% are excited about agentic commerce, but only 13–14% would give full control. — [NMI research via Yahoo Finance](https://finance.yahoo.com/technology/ai/articles/nmi-research-consumers-want-ai-130000894.html)
- One 2026 compilation reports that the **mode** amount consumers would let AI spend on its own is **$0**, with 31.21% unwilling to allow any autonomous spend. — [Digital Applied survey roundup](https://www.digitalapplied.com/blog/ai-agent-access-permissions-consumer-survey-statistics-2026) (aggregator; underlying survey not verified). Search Engine Land reports similar headline data: "77% use AI to shop. Nearly 1 in 3 won't let it spend." — [Search Engine Land](https://searchengineland.com/new-data-77-use-ai-to-shop-nearly-1-in-3-wont-let-it-spend-475614) (page returned 403; headline only)
- 51% of US consumers used at least one AI shopping tool in the prior month (Sept 2026 report, via search summary). — [PartnerCentric](https://partnercentric.com/blog/ai-shopping-statistics-trends/) (aggregator)

### Inferences
- The fear is concrete: "it will spend more than I meant". A pre-funded, capped, single-merchant, time-boxed budget answers it by design. Copy should lead with the *ceiling* ("it can't spend more than $X, at one place, until Friday"), not with autonomy.
- "Instant revocation" and "leftovers come back" should be shown in the UI and in ads (a one-tap "take it back" button). They rank as high as caps.
- Consumers are fine delegating low-stakes, routine categories (groceries, supplies) and around £177 per purchase. Early agent use cases should be small, recurring and in those categories (coffee, groceries, a subscription), not travel or finance.
- Parents are the heaviest early adopters of AI shopping *and* the natural buyers of allowances. There is an overlap segment: "parents who already use AI assistants".
- Trust goes to familiar payment brands. A no-brand open-source protocol has to borrow trust through open source/audit claims, well-known wallets or cards, and plain-language guarantees ("no one, including us, can move this money").

### Gaps
- I did not find McKinsey, Salesforce, Adobe, Morning Consult (agent-specific), Mastercard or Pew 2026 consumer data on agent payments in this pass. Those remain to be checked.
- Per-market breakdown of Checkout.com's £177 figure not retrieved.
- The underlying source of the "$0 mode / 31.21%" stat is unverified.

## 2. How allowance, family money, prepaid and envelope-budgeting products marketed themselves

### Takeaway
The winners ran **parent-first funnels** (paid social to parents; the kid is the invited user), **education as marketing** (YNAB, Greenlight classroom), **distribution partnerships** (banks, schools), and **built-in virality**: the conspicuous card (Monzo coral), the public feed (Venmo), invite-gated waitlists (Monzo Golden Ticket), and cash referral bonuses (Greenlight up to $600/yr). Each transaction becomes an ad.

### Cited Findings
- Greenlight mainly targets **parents first through paid social**. It adds partner distribution through bank partnerships and **Greenlight Classroom** (K-12 teachers and students). — [Contrary Research: Greenlight](https://research.contrary.com/company/greenlight); [Tearsheet CMO Corner, Greenlight CMO](https://tearsheet.co/cmo-corner/cmo-corner-how-greenlights-sushil-sharma-balances-partnership-engagement-and-reach-in-the-path-to-profitability/)
- Greenlight's referral program pays **up to $600/yr** in referral bonuses. — [Contrary Research](https://research.contrary.com/company/greenlight) (via search summary)
- GoHenry uses a parent-first funnel with an estimated **~$20 CAC for invited child accounts**, about 6-year average retention, about $5/month per child, and roughly 3:1 LTV:CAC. — [Aika substack, "Banking on Young People"](https://aika.substack.com/p/banking-on-young-people-gohenry-current) (analyst estimate, not company-disclosed)
- **YNAB:** growth is led by education, not ads. The company says it has "more teachers than marketers" and hosts about 100 live workshops a week plus a weekly podcast. The product is sold as a *method* (the Four Rules: give every dollar a job; embrace your true expenses; roll with the punches; age your money). — [Anti-Marketing Manifesto interview with YNAB](https://www.antimarketingmanifesto.com/ynab-interview/); [YNAB method guide](https://www.ynab.com/guide/foundations-the-ynab-method)
- **Monzo:** the "Golden Ticket" let waitlisted customers invite a friend to skip the queue, reaching about 600k beta customers by end of 2017/18. The hot coral card started conversations at the till: "walking advertisements". — [Tom Blomfield (Monzo co-founder), "Monzo Growth"](https://tomblomfield.com/post/691384431502557184/monzo-growth); [Scaleup Collective on Monzo brand](https://www.thescaleupcollective.com/blog/monzos-brand-strategy-how-the-neobank-championed-community)
- Challenger-bank playbook summary: virality, community, education, design. — [Airtree (Jackie Vullinghs)](https://medium.com/airtree-venture/the-challenger-bank-marketing-playbook-virality-community-education-design-7c790d5a0577)
- **Venmo:** the social feed shows who paid whom and what for (emoji/memo), with amounts hidden, so every payment is a micro-ad. Academic study of the feed: "Friends Don't Need Receipts". — [ResearchGate paper](https://www.researchgate.net/publication/321637185_Friends_Don't_Need_Receipts_The_Curious_Case_of_Social_Awareness_Streams_in_the_Mobile_Payment_App_Venmo); [MarketerGems (aggregator)](https://www.marketergems.com/p/venmo-growth-marketing-strategies-campaigns)
- **Gift-card pain point, useful for the "leftovers come back" message:** Bankrate (Aug 2024) found 43% of US adults hold at least one unused gift card or store credit, about **$27B total, averaging $244 per person** (up from $116 in 2021). 34% have lost money to a gift-card misstep: expiry 20%, lost card 17%, store closed 12%. The main reasons are forgetting, and cards for stores people don't use. — [Bankrate gift card survey](https://www.bankrate.com/credit-cards/news/gift-cards-survey/)

### Inferences
- Flying Money's gift and allowance flows are inherently two-sided: the owner funds, the holder receives. Each budget sent is an invite, like GoHenry's cheap invited-child accounts. The holder's first experience (open link, show QR, coffee paid) is the acquisition moment and should end with "make one for someone else".
- The QR shown at the counter is Flying Money's "coral card" moment. A distinctive, branded payment screen that baristas and bystanders notice is free marketing.
- A YNAB-style method (for example "Give every dollar a job, and a deadline") could turn a protocol into a practice people evangelise.
- "Unlike a gift card, what's left comes back to you" compares against a known, measured pain ($27B unused, 34% lost money).
- A Venmo-style social signal (opt-in "Maya's café tab from Dad") fits allowances and gifts, but must be private by default for kids.

### Gaps
- The claim that Greenlight's "I'm a Grown Up" 2025 campaign drove a "40% surge in Gen Z sign-ups" appeared only on a low-quality aggregator (businessmodelcanvastemplate.com) and is **not reliable**. Excluded.
- Step, Revolut (Junior/pockets), Cash App (Cash Card, $cashtag virality, borrowed-trust campaigns) and Monzo Pots specific marketing data were not retrieved in this pass.

## 3. Marketing stablecoin products to people who don't care about crypto ("invisible crypto")

### Takeaway
The evidence says **hide the mechanism and sell the outcome**, and borrow familiar protections and providers. Mainstream US awareness of stablecoins is low (56% have never heard of them), and actual crypto *payment* use is about 2% of adults. Willingness jumps when stablecoins come with bank-level protections or through a known provider. MoneyGram explicitly avoids the word "stablecoin" with customers. PYUSD shows that a big brand plus a stablecoin does not by itself create consumer pull.

### Cited Findings
- **Visa "Money Travels 2026" (Morning Consult, Feb 24–Mar 2 2026, US n=2,192; global n=45,445 across 20 markets):** **56% of Americans have never heard of stablecoins.** Intent to use stablecoins rises from **36% to 56%** with bank-level fraud protection and deposit insurance, and from 36% to **45%** when offered by an *existing financial provider*. 61% trust traditional banks and 60% trust global payment networks. 44% worry about AI deepfakes of family members, 36% have met international money-transfer scams, and about 20% of remitters cut personal spending to support family abroad. (Caveat: the protection scenarios were hypothetical; stablecoins aren't FDIC-insured.) — [Visa press release](https://usa.visa.com/about-visa/newsroom/press-releases.releaseId.22771.html)
- **Fed SHED 2025 (published 2026):** 10% of US adults used or held crypto in 2025 (7% in 2024; 12% peak in 2021). Only **2% used crypto to buy something** and 1% to send money to friends or family. 6% of *unbanked* adults used crypto for transactions vs 2% of banked. Users skew aged 30–44, high income and male. — [crypto.news on SHED](https://crypto.news/fed-survey-10-of-u-s-adults-used-or-held-crypto-in-2025/); [PYMNTS, "crypto as money hasn't happened yet"](https://www.pymnts.com/cryptocurrency/2026/the-federal-reserve-confirms-crypto-as-money-hasnt-happened-yet/); [KC Fed briefing](https://www.kansascityfed.org/research/payments-system-research-briefings/us-consumers-use-of-cryptocurrency-for-payments/)
- **MoneyGram (MGUSD, 2026):** tells customers funds are "pegged" rather than calling them stablecoins. The tech runs behind the scenes, so customers "don't necessarily know" stablecoins are involved (CEO Anthony Soohoo). It is positioned for people moving money across borders or lacking local financial services, not crypto natives. — [Payments Dive](https://www.paymentsdive.com/news/moneygram-floats-stablecoins/808244/); [MoneyGram PR](https://www.prnewswire.com/news-releases/moneygram-launches-mgusd-a-stablecoin-to-power-its-own-global-network-302787799.html)
- Payment-company stablecoins such as **PayPal's PYUSD "have not drawn a large market of consumer users."** — [American Banker](https://www.americanbanker.com/payments/news/stablecoins-draw-attention-but-are-still-a-tiny-market)
- **Coinbase/BVNK Stablecoin Utility Report 2026 (YouGov, n=4,658 crypto-active people):** strong preference for stablecoins *inside traditional banking apps*. Respondents prioritise convenience, efficiency and trust over decentralisation ideology. (A secondary source says 77% of crypto users want stablecoins in their bank apps.) — [BVNK Utility Report](https://www.bvnk.com/utility); [The Paypers summary](https://thepaypers.com/crypto-web3-and-cbdc/expert-views/how-consumers-use-stablecoins-2026-bvnk-report-highlights); [ETHNews (secondary, 77%)](https://www.ethnews.com/77-of-crypto-users-want-stablecoins-inside-their-bank-apps-survey-shows/)

### Inferences
- **Language to use:** "dollars", "digital dollars", "set aside", "tab", "allowance", "budget", "it comes back to you", "only works at [shop]", "ends on [date]", "no fees". Talk about outcomes (the café is paid; the kid can't overspend), not rails.
- **Language to avoid on consumer surfaces:** "crypto", "token", "wallet address", "on-chain", "gas", "smart contract", "USDC" in headlines (fine in an FAQ or "how it works" page for the curious), "Web3", "decentralized". MoneyGram's "pegged" shows even "stablecoin" is kept out of the hero.
- The two levers that measurably move intent are **protections** and **familiar providers**. Flying Money can't offer deposit insurance. Its honest equivalents: "the money sits in a contract nobody can take it from, not even us", "open source, audited", "leftovers automatically return", and later distribution through well-known wallets or apps.
- Scam and deepfake anxiety (36% and 44%) is a positioning opening. A budget locked to one recipient and one shop limits scam losses by design.
- Only 2% of US adults pay with crypto, so the US mainstream message cannot rely on existing crypto habits. The unbanked (6%) and emerging markets are the easier early segments.

### Gaps
- No first-party data found on Revolut's, Stripe's (stablecoin financial accounts), World App's or Coinbase's consumer messaging tests or conversion results.
- No A/B-tested evidence of "digital dollars" vs "stablecoin" vs "USD" wording; the inference rests on the Visa protection framing plus MoneyGram practice.

## 4. Emerging-market angle: dollar access via stablecoins

### Takeaway
In emerging markets demand is real and driven by **dollar access, savings and remittances**, not speculation. A 2024 five-country survey found "access to dollars" nearly tied with trading as the top use. LatAm and Sub-Saharan Africa led 2025 growth. USDT dominates EM retail, while USDC is stronger in advanced economies. That matters for a USDC-only product.

### Cited Findings
- **Castle Island Ventures / Brevan Howard Digital / Artemis / Visa survey (May 29–Jun 13 2024; n=2,500 in Brazil, Nigeria, Turkey, Indonesia, India):** top uses were crypto trading 50%, **access to dollars 47%** and yield 39%. **69%** had converted local currency to stablecoins. **39%** had paid for goods or services or sent or received cross-border family money with stablecoins. 30% used stablecoins in business and 23% paid or received a salary. Nigerians prioritised **saving in USD**; Turks prioritised yield. — [The Block](https://www.theblock.co/post/316048/survey-visa-brevan-howard-castle-island-ventures-stablecoins-real-world-application); [Castle Island Ventures](https://castleisland.vc/writing/stablecoins-the-emerging-market-story/); [CoinDesk](https://www.coindesk.com/business/2024/09/12/stablecoins-increasingly-used-for-savings-payments-in-emerging-countries-but-crypto-trading-still-leads-report)
- **Chainalysis 2025 Geography of Crypto:** on-chain value received grew **63% in Latin America** and **52% in Sub-Saharan Africa**. The Philippines ranks **8th** in the Global Adoption Index. **USDT is more popular in emerging-economy regions and USDC in advanced economies.** In SSA, >8% of volume was sub-$10k (retail use). LatAm demand is driven by inflation, currency volatility and capital controls. — [Chainalysis 2025 Geography report](https://www.chainalysis.com/reports/2025-geo-crypto-report/); [Chainalysis LatAm 2025](https://www.chainalysis.com/blog/latin-america-crypto-adoption-2025/); [Chainalysis APAC 2025](https://www.chainalysis.com/blog/asia-pacific-crypto-adoption-2025/)
- Secondary or aggregator claims (treat with caution): Argentina stablecoins make up >85% of peso-denominated exchange purchases, and Argentine holdings grew 220% in 2025. Nigeria had about $59B of crypto inflows in 12 months, >65% stablecoin, about 60% of SSA stablecoin inflows. Over 35% of Nigerian crypto-remittance recipients hold for 6+ months. The Philippines received a record **$39.6B** of remittances in 2025, and stablecoin rails can cut fees from about 6% to about 1%. — [Spark research](https://www.spark.money/research/stablecoin-emerging-market-adoption); [bex.co](https://bex.co/blog/2026/04/22/stablecoin-cross-border-payments-2026-two-games-argentina-latam-g7-divergence); [CoinLaw](https://coinlaw.io/cryptocurrency-based-remittance-statistics/) (none verified against primary data)
- Stablecoin gains in Nigeria and Turkey are framed as "nothing to do with speculation". — [DL News](https://www.dlnews.com/articles/snapshot/why-stablecoins-are-gaining-ground-nigeria-turkey/)
- Visa: about 20% of US senders cut their own spending to support family abroad, and 36% have met transfer scams. — [Visa Money Travels 2026](https://usa.visa.com/about-visa/newsroom/press-releases.releaseId.22771.html)

### Inferences
- The strongest EM pitch is a **cross-border allowance tied to a local merchant**: "Send Mom a grocery budget at her sari-sari store / the pharmacy, in dollars, that only she can spend there; what's left comes back." It answers the remitter's fear of scams and misuse, and gives the recipient dollar-denominated value.
- In EMs the dollar itself is a selling point, so "dollars" can be said loudly there. In the US, "dollars" is just assumed.
- A USDC-only product faces USDT's dominance in EM retail. That is a distribution and liquidity risk for EM launch.
- Merchant cash-out to local currency is the real bottleneck in EMs. Merchants will need an off-ramp story.

### Gaps
- No primary data found on stablecoin-funded *allowances or earmarked* cross-border transfers specifically, as opposed to general remittance.
- No up-to-date (2025–26) primary survey of EM stablecoin users; the Castle Island survey is from 2024.

## 5. Merchant and café adoption at the counter: QR payment lessons

### Takeaway
Small merchants were won by **zero or near-zero fees for micro-merchants**, **no new hardware** (a printed QR standee), **one national interoperable QR** (UPI, Pix, QR Ph), and above all **instant, unmistakable proof of payment**. India's soundbox, which announces "received ₹X" out loud, ended "the money left my account" disputes. It is the key merchant-trust device.

### Cited Findings
- **UPI:** micro-merchants (P2PM tier, up to ₹1 lakh/month via QR) keep **zero MDR** even as a 0.4% fee is introduced on select larger merchant transactions over ₹2,000 (Sept 2026). No GST registration needed. Existing QR standees and soundboxes keep working with no re-registration. — [SCC Online on NPCI MDR FAQs](https://www.scconline.com/blog/post/2026/09/16/npci-released-upi-mdr-faqs-explained/); [Business Today](https://www.businesstoday.in/personal-finance/news/story/small-merchants-will-not-come-under-upi-mdr-even-above-rs2000-if-they-meet-this-condition-check-details-555727-2026-09-15); [Govt of India MDR FAQ PDF](https://financialservices.gov.in/sites/default/files/2026-09/FAQs---Merchant-Discount-Rate--MDR--on-Select-UPI--P2M--Transactions_0.pdf)
- **Pix (Brazil):** the market sets merchant fees at about **0.22%** and Pix still grew rapidly. That is evidence that a small fee doesn't block adoption. — [Tribune India citing Pix comparison](https://www.tribuneindia.com/news/business/praveen-khandelwal-urges-centre-to-exempt-small-merchants-consumers-from-paying-merchant-discount-rate) (secondary)
- **Paytm Soundbox:** it announces payment amounts aloud (multilingual) and eliminated disputes where customers claimed a payment went through but merchants saw nothing. Paytm has **6.1M+ merchants paying subscriptions** for devices like the Soundbox. Vendor-cited results: +45% customer satisfaction and 30% less time verifying transactions (vendor blog; weak evidence). — [Paytm blog](https://paytm.com/blog/payments/merchants-trust-and-support-paytms-new-and-improved-soundboxes-praise-nfc-sound-quality-quick-settlement/); [Evolute (vendor)](https://www.evolute.in/blog/role-upi-payment-sound-box-enhancing-customer-trust-transparency/); [Paytm "Soundbox deployed every 6 seconds"](https://paytm.com/blog/investor-relations/paytm-soundbox-deployed-every-6-seconds/)
- **GCash (Philippines):** waived QR Ph MDR for micro-merchants (sari-sari stores, market vendors). It partners with Puregold, the wholesaler that supplies sari-sari stores, to bundle payment tools (SoundPay, PocketPay) into the channel stores already use. The QR Ph national standard made QR the fastest-growing method. Barriers were security, trust, customer knowledge, legal uncertainty and tech constraints. — [NoypiGeeks](https://www.noypigeeks.com/business/gcash-waives-fee-sari-sari-stores-market-vendors-qr-payments/); [Manila Bulletin](https://mb.com.ph/2026/05/29/puregold-price-club-and-gcash-for-business-bring-end-to-end-digital-financial-tools-to-more-filipino-sari-sari-store-owners); [ResearchGate: Sari-sari store readiness for GCash](https://www.researchgate.net/publication/389817295_Sari-Sari_Stores_Readiness_for_GCash_Adoption_as_Digital_Payment_System)

### Inferences
- Flying Money's merchant value proposition maps onto these lessons. **Prepaid, guaranteed funds** (no chargebacks, no card fees beyond gas) is the equivalent of zero MDR. **Works when the shop Wi-Fi is down** fits the fact that payment certainty at the counter is the merchant's main worry.
- Flying Money needs its own "soundbox moment": an unmistakable confirmation (sound, big green screen, amount spoken) that the barista trusts without checking a dashboard. Offline QR must feel *more* certain than online, or staff will refuse it.
- Win merchants through channels they already trust: wholesalers and suppliers (the GCash–Puregold model), POS partners, or the customers themselves. A regular who asks "can I set up a tab here?" is a warm lead, and the tab brings prepaid revenue.
- Pitch the café a **prepaid tab = cash up front + loyalty lock-in** (the budget can only be spent there). That is a revenue argument, not just a payments one.

### Gaps
- Square's small-merchant acquisition tactics (free reader, flat pricing) were not retrieved in this pass.
- No data found on café or merchant acceptance of stablecoin QR specifically, or on off-ramp friction for small merchants.

## 6. Behavioural-science framing for budgets

### Takeaway
Mental accounting research supports the product's core mechanic. **Earmarked, labelled pots** work as self-control devices, and spending from a category reduces further spending in it. **Prepayment** separates the "pain of paying" from consumption. The **planner/doer** model maps exactly onto an owner who pre-commits and a holder or agent who spends. There is a caveat: earmarking can cause bad choices when rigidity bites, so the end date and the auto-return of leftovers matter.

### Cited Findings
- Shefrin & Thaler (1988): self-control comes from a forward-looking "**planner**" and a myopic "**doer**". Budgeting rules let the planner constrain the doer. — [Wikipedia: Mental accounting](https://en.wikipedia.org/wiki/Mental_accounting); [Skwara 2023 systematic review, J. Consumer Behaviour](https://onlinelibrary.wiley.com/doi/full/10.1002/cb.2193)
- Transaction-specific (prepaid) accounts make consumers use a prepayment rather than waste it (Gourville & Soman 1998; Thaler 1985). Mental accounts "could serve as rigid self-control devices". — [Skwara 2023 review](https://onlinelibrary.wiley.com/doi/full/10.1002/cb.2193)
- **Heath & Soll (1996):** people set mental budgets by category, and spending in a category reduces later spending in it. Soman (2001) and Soman & Lam (2002) add related evidence. — [Heath & Soll, JCR 1996 (PDF)](https://bear.warrington.ufl.edu/brenner/mar7588/Papers/heath-soll-jcr1996.pdf)
- **Soman & Cheema (2011):** earmarking and partitioning cash increased saving among low-income households. — referenced in [Skwara 2023 review](https://onlinelibrary.wiley.com/doi/full/10.1002/cb.2193); also [ResearchGate: "Knowing When to Spend: Unintended Financial Consequences of Earmarking"](https://www.researchgate.net/publication/283867645_Knowing_When_to_Spend_Unintended_Financial_Consequences_of_Earmarking_to_Encourage_Savings), which documents a downside: rigid earmarks can lead people to borrow expensively rather than break an earmark.
- "Malleable mental accounting": how flexible an account is affects spending decisions. — [Rotman (Cheema & Soman)](https://www-2.rotman.utoronto.ca/facbios/file/mma.pdf)
- Fear of an agent overspending is the top concern: 60% worry AI will spend beyond intended amounts (NMI), which frames the problem as preventing a loss. — [NMI via Yahoo Finance](https://finance.yahoo.com/technology/ai/articles/nmi-research-consumers-want-ai-130000894.html)

### Inferences
- **Messages likely to resonate:**
  - Pre-commitment and the planner/doer idea: "Decide once. Then relax." / "Set the limit when you're thinking clearly."
  - Loss framing aimed at the agent fear: "Your agent can't spend a cent more than you set aside" / "Hand over a budget, not your wallet."
  - Labelled pots: name the budget ("Maya's lunch money", "Tuesday coffee with Sam"). Labels strengthen earmarks and make the gift feel personal.
  - Leftovers returning cancels the gift-card waste loss (Bankrate $27B): "Nothing expires into someone else's pocket."
  - Endowment and warm-glow for gifts: "a coffee a week at your favourite café, for a month".
- The end date plus auto-return counters the "rigid earmark" downside: money isn't trapped forever.
- Don't overclaim financial-education outcomes for kids without evidence. Greenlight and GoHenry lean on education, but I found no causal evidence in this pass.

### Gaps
- No experimental evidence found comparing specific budget-product message frames (loss vs gain) in 2024–26.
- No published data found on whether spending caps on AI agents, as opposed to stated preferences, actually increase delegation.
