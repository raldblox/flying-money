# Everyday consumer money UX (allowances, gifts, prepaid tabs) and in-person QR payments at the counter (buyer + merchant), as of Sept 2026

Scope note: ~16 search/fetch calls. Coverage is strongest on counter QR (UPI/Paytm Soundbox, Alipay, Pix), allowance controls (Greenlight, Monzo U16, Apple Cash Family), gifting (Venmo gift wrap), gift-card breakage stats, QR sizing, and low-literacy / accessibility research. Weak or missing: Mobbin/Page Flows teardowns, GoHenry/Step/BusyKid/Revolut <18 specifics, Starbucks 2025 scan-to-pay share, Square POS layout guidance, GCash, Solana Pay pilots, NN/g / Baymard payment articles. These are flagged in Gaps.

## 1. Allowance / family money app UX (Greenlight, GoHenry, Step, BusyKid, Revolut <18, Monzo pots, Apple Cash Family)

### Takeaway
The market leaders converge on four patterns that map almost 1:1 onto Flying Money's "budget for one seller, one holder, one end date": (a) money earmarked by *place* (Greenlight's store-level Spend Controls; Monzo's parent-lockable pots), (b) a "spend anywhere" remainder vs. earmarked buckets, (c) an in-app *request* loop from child to parent with approve/decline, and (d) real-time spend notifications to the parent, opt-in. Flying Money's per-seller budget is effectively Greenlight's store-specific Spend Control made on-chain and self-enforcing.

### Cited Findings
- Greenlight markets "Spend Controls" that let parents restrict which stores a child can spend at and how much; it claims to be the only prepaid card letting you select each individual store — [Greenlight Help](https://help.greenlight.com/hc/en-us/articles/235833027-What-restrictions-can-I-put-on-spending)
- Greenlight examples: $15 only at Walmart, $10 only for video-game in-app purchases, $5 only at a local ice-cream shop; or a $20 cap at all restaurants in the area / $15 at the local Target — [Greenlight Help](https://help.greenlight.com/hc/en-us/articles/235833027-What-restrictions-can-I-put-on-spending); dedicated how-to for store-specific control — [Greenlight Help: Spend Control for a specific store](https://help.greenlight.com/hc/en-us/articles/4403837865627-How-do-I-set-up-a-Spend-Control-for-a-specific-store)
- Greenlight separates a "Spend Anywhere" bucket (usable wherever Mastercard is accepted) from store-locked buckets — [Greenlight Help](https://help.greenlight.com/hc/en-us/articles/235833027-What-restrictions-can-I-put-on-spending)
- If a child wants to buy at an unapproved store without enough Spend Anywhere money, they can send the parent a real-time request, which the parent approves or declines — [Greenlight Help](https://help.greenlight.com/hc/en-us/articles/235833027-What-restrictions-can-I-put-on-spending)
- Greenlight app positioning now includes "children and older adults" (i.e., the same controls used for elder caregiving) — [Greenlight Help](https://help.greenlight.com/hc/en-us/articles/235833027-What-restrictions-can-I-put-on-spending); [App Store listing "Greenlight: For Families"](https://apps.apple.com/us/app/greenlight-kids-teen-banking/id1049340702)
- Monzo Under 16s: both parent and child can put money into Pots and set goals; kids can name Pots and add a picture; parents can *lock* a child's Pot "if the money's for a specific purpose" — [Monzo Help: Pots for children](https://monzo.com/help/monzo-for-under-16s/under-16s-pots); [Monzo blog](https://monzo.com/blog/monzo-for-under-16s-the-future-of-bank-accounts-for-kids)
- Monzo parents see child spending in their own app and, if notifications are on, get instant notifications on each child spend; parents can set daily limits and toggle cash withdrawals / online payments — [Finder UK review of Monzo U16](https://www.finder.com/uk/banking/childrens-banking/monzo-under-16s); [Monzo Help: Understanding my U16 account](https://monzo.com/help/monzo-for-under-16s/under-16s-understanding-account-web)
- Monzo removed the U16 waitlist and in Aug 2025 announced interest on U16 savings — [The Paypers](https://thepaypers.com/fintech/news/monzo-eliminates-waitlist-for-under-16s-bank-accounts); [FF News](https://ffnews.com/newsarticle/fintech/monzo-removes-waitlist-for-under-16s-bank-account-and-adds-two-brand-new-features/)
- Apple Cash Family: parent can view child/teen balance and transactions, restrict who the child can send money to (Everyone / Contacts Only / Family Members Only), turn on "Notify Me When [name] Makes Any Transaction", and lock the account — [Apple Support: View and limit your child's Apple Cash activity](https://support.apple.com/en-us/102257); [Apple Support: Set up Apple Cash Family](https://support.apple.com/en-us/105010)
- Apple Cash Family does not offer merchant-level restriction (users asking for it in Apple's community forum) — [Apple Community thread](https://discussions.apple.com/thread/255540036) (user forum, not official; treat as indicative)

### Inferences
- Flying Money's core object ("£X for Café Y, for Holder Z, until date D") is the Greenlight store-locked Spend Control / Monzo locked Pot, minus the bank. Copy can lean on this familiar mental model: "money set aside for one place". A picture/emoji and a free-text name per budget (Monzo pattern) likely aids a kid or elderly holder in telling budgets apart.
- The request loop (Greenlight "request funds", Apple's lock) matches the repo's existing "Request inbox: agents ask in the app, owners approve there". Consistency: same request card for a kid, a helper, and an AI agent.
- Parent notification is opt-in in both Monzo and Apple; default-on-per-spend may be noisy for daily café budgets. Offer "each spend" vs "daily summary" vs "only when low / expiring".
- None of the incumbents surface "what happens to leftovers" because bank money doesn't expire; Flying Money's auto-return at end date is a novel trust point and must be shown at creation and on the holder's card ("Leftovers go back to Mum on 30 Oct").

### Gaps
- No primary 2025–26 sources retrieved for GoHenry, Step, BusyKid or Revolut <18 onboarding flows or kid-facing UI; no Mobbin/Page Flows teardown access. Age-appropriate design specifics (reading level, gamification) for these apps not verified.

## 2. Gifting UX (digital gift cards, Venmo/Cash App gifts, Apple Gift Card, Starbucks; reveal moments, claim without account, balance anxiety)

### Takeaway
The gifting pattern is "money + a wrapper + a moment": Venmo adds animated gift-wrap themes that play when the recipient opens the payment and asks them to "unwrap". The flip side is scale-level breakage: roughly half of US adults hold unspent gift cards worth ~$187–244 on average, and Starbucks alone carries ~$1.77B unredeemed — so a gift product that returns leftovers to the giver is a genuine differentiator but must also nudge spending before expiry.

### Cited Findings
- Venmo (Jan 2022) added eight animated gift-wrap designs attachable to a payment; when the recipient opens a gift payment they see a short animation in the chosen theme — [TechCrunch](https://techcrunch.com/2022/01/13/venmo-introduces-new-gift-wrapping-feature-with-eight-animated-designs/); [Venmo Help: Customize your payment](https://help.venmo.com/cs/articles/customize-your-payment-vhel147)
- Venmo also sells brand gift cards through a Gift button (15 top brands); the recipient gets a notification within ~15 minutes prompting them to "unwrap" — [Venmo: Gifting](https://venmo.com/about/gifting); [Venmo Help: Gift cards](https://help.venmo.com/cs/articles/gift-cards-vhel214)
- Bankrate (July 2023): 47% of US adults had at least one unspent gift card/voucher, average $187, ~$23B total — cited via [Gift Card Statistics 2026 (aggregator)](https://www.rewordin.com/blog/gift-card-statistics-2026) and [Center on Budget/state policy brief 2023](https://budgetandpolicy.org/resources-tools/2023/12/Gift-Card-Brief-2023-1.pdf). A different aggregator figure: 43% holding an unused card averaging $244 — [rewordin aggregator](https://www.rewordin.com/blog/gift-card-statistics-2026). (Bankrate's primary page could not be fetched — HTTP 405; figures conflict slightly by year.)
- Statista tracks "leading reasons for unused gift card balances in the U.S. 2024" (forgetting, small leftover balance, etc.) — [Statista](https://statista.com/statistics/1535498/unused-gift-card-balances) (paywalled; reasons not verified)
- Starbucks reported ~$1.77B in unredeemed card balances — [rewordin aggregator](https://www.rewordin.com/blog/gift-card-statistics-2026) (aggregator; verify against the Starbucks FY2025 10-K "stored value card liability" — [SEC 10-K FY2025](https://www.sec.gov/Archives/edgar/data/829224/000082922425000114/sbux-20250928.htm))
- In at least 19 US states unspent gift card funds must be escheated to state unclaimed-property programs; policy advocates argue unused balances should return to consumers — [Budget & Policy brief 2023](https://budgetandpolicy.org/resources-tools/2023/12/Gift-Card-Brief-2023-1.pdf)
- ~60% of gift card recipients spend beyond card value (avg $73 extra) — [rewordin aggregator](https://www.rewordin.com/blog/gift-card-statistics-2026) (aggregator, unverified primary)

### Inferences
- Reveal moment: a short themed "unwrap" when the holder first opens the hand-over link is an established, low-cost delight pattern (Venmo). It should be skippable and must end on the concrete facts: amount, shop, end date, what happens to leftovers.
- Balance anxiety is two-sided: recipients forget/lose small balances; givers never learn money went unused. Flying Money can turn breakage into a feature ("Unspent money comes back to you on 12 Dec") and add reminder notifications to the holder ("£4.20 left at Bean Café, 5 days to go").
- Claim without an account: Flying Money's link/QR hand-over is closer to a bearer voucher; the UX should make "save this to your phone" (home-screen / wallet page) the first action after the reveal so the link isn't lost in a chat thread.

### Gaps
- No primary sources gathered on Apple Gift Card or Starbucks eGift claim flows, Cash App gift claims for non-users, or share-sheet/message-preview (OG image) best practice. No research on gift reveal effect on redemption rates.

## 3. Prepaid tab / stored-value UX (Starbucks app, campus cards, café tab apps)

### Takeaway
Starbucks is the canonical stored-value app: one screen for balance + scan-to-pay barcode, reload (with rewards incentive for reloads ≥$30), and transaction history. Evidence gathered is thin on current usage shares.

### Cited Findings
- The Starbucks app lets users check balance, reload the card, view transactions and scan to pay in store; Mobile Order & Pay allows ordering ahead — [Starbucks: Mobile apps](https://www.starbucks.com/rewards/mobile-apps/); [Google Play listing](https://play.google.com/store/apps/details?id=com.starbucks.mobilecard&hl=en_US)
- Starbucks offers Bonus Stars for digital reloads (minimum $30) — [Starbucks: Mobile apps](https://www.starbucks.com/rewards/mobile-apps/)
- Historic (2015–16): ~1 in 4 Starbucks transactions originated on mobile — [Fortune 2016](https://fortune.com/2016/06/08/starbucks-mobile-app-digital-strategy) (dated; current figure not found)

### Inferences
- For a holder, the "wallet" page should follow Starbucks' layout: balance first, the pay code one tap away (or the default view when only one budget exists), history below. For multiple budgets, a card per shop with shop name/logo is the scannable unit.
- Stored-value apps profit from breakage and reload incentives; Flying Money's model (no reload by holder, leftovers return) is structurally more honest — copy can say so plainly.

### Gaps
- No 2023–26 data on Starbucks scan-to-pay share, campus card UX, or café tab apps (e.g., Toast/Square loyalty balances). FY2025 10-K located but not fetched.

## 4. QR payment at the counter (UPI, Pix, GCash, Alipay/WeChat, Square, Solana Pay) — CPQR vs MPQR, scan reliability, speed, confirmation feedback, offline, disputes, staff, POS layouts

### Takeaway
Two dominant models: merchant-presented QR (MPQR; UPI/Pix static stickers, customer scans) and customer-presented QR (CPQR; Alipay/WeChat "payment code", merchant scans). Flying Money's "holder shows QR, till scans and verifies locally" is CPQR, which is the model best suited to offline buyers (Alipay's rotating code). The single most important merchant-side lesson from India is that merchants cannot trust the customer's screen: fake payment screenshots drove the Paytm Soundbox, which speaks the amount aloud from the merchant's own verified source. Offline modes are now arriving in regulated rails (UPI Lite X via NFC, BCB's planned Pix offline) with low per-transaction caps and later sync — exactly Flying Money's "verify locally, collect later".

### Cited Findings
**CPQR vs MPQR**
- Alipay CPQR: the customer shows a personal payment code (rotating token); the merchant scans it with a scanner/POS/soundbox and gets an approval beep — [Alipay QR guide 2026 (third-party)](https://extentage.com/alipay-qr-codes/); official flows: [Antom Docs: Barcode payment](https://global.alipay.com/product-detail.htm?bizCode=OPEN_OFFLINE_PAYMENT-Barcode), [Alipay+ MPM product intro](https://docs.alipayplus.com/alipayplus/alipayplus/product_intro_acq/product_mpm_acq)
- One source reports Alipay+ payment codes refresh every 30 seconds — [BigPay support](https://bigpaysupport.zendesk.com/hc/en-us/articles/32575552605709--Alipay-How-To-Generate-QR-for-Payment-With-A-Merchant) (refresh interval varies by implementation; not confirmed in official docs)
- General overview of CPQR vs MPQR modes — [Wikipedia: QR code payment](https://en.wikipedia.org/wiki/QR_code_payment)

**Merchant confirmation feedback / dispute avoidance (India)**
- Paytm Soundbox gives "instant audio confirmation on every payment received", announcing the exact amount in the merchant's chosen language; connects via embedded SIM, no Wi-Fi needed — [Paytm Business: Soundbox](https://business.paytm.com/soundbox); [Paytm Business support](https://business.paytm.com/support/paytm-soundbox)
- Paytm's own merchant guidance: "Don't Rely Only on Screenshots: Verify in the app, as screenshots can be fake"; wait for Soundbox confirmation; cross-verify large transactions in the app; statuses are Successful / Pending / Failed — [Paytm Support: How merchants can verify payment receipts](https://paytm.com/support/paytm-soundbox/how-merchants-can-verify-payment-receipts)
- Merchants face fake payment screenshots and "network delay" excuses; soundbox vendors pitch "only trust payments when you hear the confirmation" — [LP Fintech soundbox page](https://lpfintech.com/soundbox/) (vendor marketing); [Paytm blog: UPI frauds](https://paytm.com/blog/payments/upi/upi-frauds/)
- Paytm extended the soundbox to cards ("Card Soundbox") — [Bhatkallys news](https://bhatkallys.com/news/read/paytm-launches-card-soundbox-for-upi/)

**Offline modes**
- UPI Lite: low-value payments without UPI PIN, not hitting the remitter bank's core banking in real time; UPI Lite X uses NFC and works without internet — [Paytm blog: UPI Lite vs UPI 123](https://paytm.com/blog/payments/upi/what-is-the-difference-between-upi-lite-and-upi-123/); [TechRadar](https://www.techradar.com/news/upi-lite-will-let-users-send-and-receive-money-offline-everything-you-need-to-know)
- RBI raised UPI Lite wallet limits and updated its offline payments framework in Dec 2024 — [Business Standard](https://www.business-standard.com/amp/finance/news/rbi-enhances-upi-lite-wallet-limits-updates-offline-payments-framework-124120401144_1.html) (the ₹500 per-transaction figure for UPI Lite X cited by [Outlook Money](https://www.outlookmoney.com/news/4-ways-to-do-offline-upi-transactions-making-digital-payments-without-internet-even-in-aeroplane) may be pre-update; verify)
- UPI 123PAY (2022, NPCI + RBI) serves feature phones via IVR, missed call, sound-based (proximity sound) payments and OEM apps, ₹10,000 per-transaction cap — [Razorpay blog](https://razorpay.com/blog/what-is-upi-123-pay/)
- Pix por Aproximação (NFC) launched 28 Feb 2025 — [gov.br Secom](https://www.gov.br/secom/pt-br/acompanhe-a-secom/noticias/2025/02/pix-por-aproximacao-comeca-a-funcionar-nesta-sexta-feira-28); launched with R$500 per-transaction ceiling, revoked by BCB Instruction 746 (June 2026) — [Tecnospeed blog](https://blog.tecnospeed.com.br/pix-por-aproximacao-pix-automatico/) (secondary)
- Pix Offline: BCB developing an offline NFC proximity mode where the transaction is recorded on-device and synced securely on reconnection; no launch date as of Aug 2026 reporting — [meutudo (Aug 2026)](https://meutudo.com.br/blog/noticias/2026/08/14/pix-sem-internet-relatorio-do-bc-revela-atualizacoes-incluindo-imposto-por-transacao/); [ISTOÉ Dinheiro](https://istoedinheiro.com.br/pix-offline-ia-antifraude-split-tributario-bc); motivating use cases: roads, stadiums, large events — [em.com.br Jan 2026](https://www.em.com.br/tecnologia/2026/01/7327097-pix-em-2026-pix-automatico-ja-e-realidade-e-novas-funcoes-sao-esperadas.html)

**Scan reliability / sizing**
- Rule of thumb: code side ≈ scanning distance ÷ 10; practical printed minimum ~2×2 cm excluding quiet zone — [QR Code Generator blog](https://www.qr-code-generator.com/blog/minimum-qr-code-size/); [Triton](https://tritonstore.com.au/qr-code-size/)
- Quiet zone = 4 modules; keep high luminance contrast (≥ ~40% / 4:1 cited) — [QR Code Generator blog](https://www.qr-code-generator.com/blog/minimum-qr-code-size/); [Delivr printing guidelines](https://delivr.com/faq/1289/qr-code-printing-guidelines-best-practices)
- On-screen: ~200×200 px floor; screen-to-screen scanning suffers from glare, refresh-rate interference and users zooming (pixelating the code) — [useqrkit size chart 2026](https://useqrkit.com/qr-code-size) (vendor guidance, not standards-body)
- Patents exist on customizing barcode rendering for particular displays (brightness/pixel alignment), showing this is a known engineering issue — [USPTO 8736615](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8736615)

### Inferences
- Buyer screen (holder "pay" view): full-width QR with 4-module quiet zone on pure white regardless of dark mode; auto-raise screen brightness where the platform allows (Wake Lock + max brightness is only possible in native wrappers; on web, instruct "turn brightness up"); disable pinch-zoom on the code; keep payload small (lower QR version → bigger modules → faster scans, especially on cheap webcams/tablets). Show amount-available, shop name and the holder's first name under the code so staff can eyeball it.
- If the QR is a signed voucher that verifies locally, consider a rotating/short-expiry element (Alipay CPQR style) to blunt screenshot replay — but the on-chain spend-once rule is the real guard; UI should tell staff "Verified ✓ — collect later" vs "Already used".
- Merchant screen (/pos): the Paytm lesson is that confirmation must come from the merchant's device, not the customer's screen. The till should give a big, unmistakable success state (full-screen green, amount in large numerals, spoken amount via Web Speech API / a chime) and a distinct failure state (red + different sound + one-line reason). Offer an optional "speak amounts" toggle in the shop's language.
- Offline copy for staff should mirror Pix Offline/UPI Lite framing: "Checked on this device. Money arrives when you collect." Show a queue count of un-collected slips and a clear "Collect now" when online.
- Low per-transaction caps are the regulators' offline risk control (UPI Lite X, Pix NFC at launch); Flying Money's budget cap per seller is the equivalent — worth stating in merchant-facing copy ("the most any code can ever be worth is its budget").

### Gaps
- No verified numeric speed targets (e.g., seconds per transaction) for UPI/Pix/Alipay counter flows. No primary GCash, WeChat Pay, Square POS layout, or Solana Pay pilot UX sources gathered. No staff-training material found. Alipay code refresh interval unverified in official docs.

## 5. Accessibility and low-end devices (WCAG for payments, screen readers with QR, low literacy, poor connectivity)

### Takeaway
QR is inherently visual; blind users find QR-based UPI slow and impractical, and most scanner apps don't speak their results. Low-literacy users are typically numerate, rely on intermediaries (shopkeepers, relatives, agents), and share devices/PINs — so interfaces should lean on numbers, icons and audio, and design for delegated use (which is literally Flying Money's "helper" holder).

### Cited Findings
- Section508.gov guidance on accessible QR: provide text alternatives (short URL, instructions) alongside codes; don't make the QR the only path — [Section508.gov Accessibility Bytes No. 8](https://www.section508.gov/blog/accessibility-bytes/qr-codes/)
- Blind/low-vision users may be unable to locate or aim at QR codes; reported claim that ~90% of QR scanning apps don't support screen readers — [BOIA](https://www.boia.org/blog/are-qr-codes-accessible-for-people-with-disabilities); [Medium: The invisible barrier](https://medium.com/@roberto_40218/the-invisible-barrier-qr-codes-and-accessibility-f1e4dba6653f) (90% figure is from a blog, unverified)
- An academic paper on assistive UPI for visually impaired users reports QR scanning is dominant in UPI but slow/impractical for blind users — [Semantic Scholar PDF: Secure and Assistive UPI Transaction System for Visually Impaired](https://pdfs.semanticscholar.org/4377/c094eb30dd889fc2cb1ad8fdea1a476d91e6.pdf)
- Medhi/Thies et al.: textual interfaces are largely unusable by first-time low-literacy users; research subjects are functionally illiterate but partially numerate and comfortable with numeric keypads; text-free designs (graphics, spoken dialog, live operators) outperform — [Medhi-Thies 2015, "User Interface Design for Low-literate and Novice Users"](https://courses.cs.washington.edu/courses/cse490c/18au/readings/medhi-thies-2015.pdf); [Designing mobile interfaces for novice and low-literacy users](https://www.researchgate.net/publication/234829313_Designing_mobile_interfaces_for_novice_and_low-literacy_users)
- Mobile financial apps studied required above 10th-grade reading level on average — [Chaudry, Mobile interface design for low-literacy populations](https://course.khoury.northeastern.edu/is4300f13/ssl/chaudry.pdf)
- 2026 ACM COMPASS paper: in low-literacy settings, device sharing, reliance on family or local agents, and delegating transactions to shopkeepers/relatives (including PIN sharing) shape mobile financial service use — [ACM DL, COMPASS 2026](https://dl.acm.org/doi/10.1145/3811242.3819111)
- UPI 123PAY's sound-based and IVR modes show regulators designing payments for feature phones and no data — [Razorpay blog](https://razorpay.com/blog/what-is-upi-123-pay/)

### Inferences
- The holder pay screen needs a non-visual fallback: a short human-readable code (e.g., 6–8 chars) the holder can read aloud or staff can type, plus an accessible label ("Payment code for Bean Café, up to £10"). The till must announce results audibly and via ARIA live regions.
- Delegation is a first-class use case (helpers, carers, agents): budgets scoped to one shop + one end date are a safer substitute for the PIN-sharing documented in the COMPASS paper — a strong framing for the "helper" persona.
- Keep amounts as large numerals with currency, minimal text; target plain-language copy well below the 10th-grade bar.
- Wallet page must render from cache offline (PWA/service worker) since the pay-at-counter promise depends on it.

### Gaps
- No WCAG 2.2 success-criteria mapping specific to payment flows retrieved (e.g., 2.2.1 Timing Adjustable for expiring codes, 3.3.4 Error Prevention for financial transactions — known from WCAG but not fetched this session). No low-end Android performance budgets gathered.

## 6. Receipts, history, "where did the money go", notification design

### Takeaway
Evidence here is mostly indirect: parents expect per-transaction or opt-in notifications (Monzo, Apple Cash Family), merchants reconcile via an in-app transaction list with status + ID + timestamp (Paytm), and givers are rarely told what happened to unspent gift money (breakage). A clear per-budget ledger that ends in "£X returned to you" closes that loop.

### Cited Findings
- Paytm merchant transaction record fields: amount, payment mode, customer identification, Transaction ID, timestamp; statuses Successful/Pending/Failed; daily settlement reports for reconciliation — [Paytm Support](https://paytm.com/support/paytm-soundbox/how-merchants-can-verify-payment-receipts)
- Apple Cash Family: parent sees child's balance and full transaction list; per-transaction notification toggle — [Apple Support 102257](https://support.apple.com/en-us/102257)
- Monzo: instant parent notification on each child spend when enabled — [Finder UK](https://www.finder.com/uk/banking/childrens-banking/monzo-under-16s)
- Starbucks app exposes transaction history alongside balance — [Starbucks mobile apps](https://www.starbucks.com/rewards/mobile-apps/)

### Inferences
- Three ledgers, same data: giver ("Bean Café budget for Sam: spent £6.40 on 3 visits, £3.60 back to you on 30 Oct"), holder ("£3.60 left, 4 days"), shop ("12 slips checked today, 9 collected, 3 waiting"). Mirror Paytm's three statuses as Checked (offline-verified) / Collected / Failed.
- Notifications: giver — spend (opt-in), low balance, expiring soon, leftovers returned; holder — received, expiring soon; shop — uncollected slips before a budget's end date (collection deadline risk).

### Gaps
- No NN/g or Baymard research on transaction history/receipt design retrieved; no data on notification fatigue thresholds for family money apps.
