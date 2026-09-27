# Wallet and Stablecoin Onboarding UX (as of Sept 2026)

Scope: what measurably reduces drop-off and errors when onboarding people to a USDC product: wallets, keys, funding, transactions, recovery, address/amount display, testnet disclosure. Context: Flying Money (Next.js, Arbitrum, USDC certificates, connect-wallet or in-browser ECDSA wallet, passphrase-sealed backup, testnet, unaudited).

Source-quality warning for the report writer: a lot of the "hard numbers" in this space come from vendor blogs and SEO aggregators (Spark, Eco support articles, Openfort, johal.in) that do not link to primary data. I flag these inline. Peer-reviewed sources (USENIX Security 2025, CHI 2025, SOUPS 2020, CHI 2021) are more reliable but I could not fetch the ACM full texts (HTTP 403), so some CHI 2025 numbers are relayed via secondary summaries.

## 1. Embedded wallets vs connect-wallet, passkeys, social login, account abstraction, gas sponsorship

### Takeaway
By 2026 the default for consumer-facing apps is "sign in with email/social/passkey, a wallet is created for you, gas is sponsored", with connect-wallet kept as a secondary option for crypto-native users. Hard, independently verified conversion numbers are scarce; most public figures are vendor claims.

### Cited Findings
- Dynamic reports that more than 50% of users opt for an embedded wallet rather than connecting an existing one (vendor data, no methodology given). Social login in web2 is said to lift onboarding conversion 20–60%, and embedded wallets cut setup "from 5–10 minutes to 5–10 seconds" (vendor claim). — [Search summary of Dynamic/Alchemy content](https://www.dynamic.xyz/blog/embedded-wallets-with-social-login-the-standard-for-web3-onboarding); [Alchemy guide](https://www.alchemy.com/overviews/the-ultimate-guide-to-embedded-wallets-with-social-login)
- The Dynamic post now redirects to Fireblocks (Dynamic was acquired by Fireblocks); the Oct 20, 2025 version contains no quantified embedded-vs-connected statistics, only "Every extra step adds friction and user drop-off." — [Fireblocks blog](https://www.fireblocks.com/blog/embedded-wallets-with-social-login-the-standard-for-web3-onboarding)
- Scale indicators (aggregated, vendor-sourced): Privy 75M+ wallets (acquired by Stripe, June 2025); Web3Auth ~50M users; Dynamic 50M+ accounts (acquired by Fireblocks, ~$90M); Coinbase Smart Wallet 1M accounts by Aug 2025; 200M+ smart accounts on EVM, 87% using gas sponsorship; Safe 61M accounts. — [Spark research (aggregator)](https://www.spark.money/research/self-custodial-wallet-ux-barriers)
- Same aggregator claims crypto first-week activation of 32% vs 76% for traditional fintech, and "gasless onboarding retention 94% vs 67% with gas-required flows" — no primary source given; treat as unverified. — [Spark](https://www.spark.money/research/self-custodial-wallet-ux-barriers)
- A widely repeated claim that Privy embedded wallets "cut onboarding drop-off by 65%" and a case study going from 210s to 28s onboarding with +52% conversion appears on a low-quality blog without a named customer; do not rely on it. — [johal.in](https://www.johal.in/privy-python-auth-embedded-wallets-user-onboarding-2025/)
- Privy creates wallets automatically on sign-up with email, social login or passkeys; passkeys can also be used to authorize wallet actions. — [Privy wallets](https://www.privy.io/wallets); [Privy docs: passkeys](https://docs.privy.io/recipes/passkey-server-wallets)
- Coinbase Smart Wallet: create a self-custodial wallet in one biometric (passkey) prompt, no app install, keys sync via Apple/Google; no recovery phrase. Caveat noted: many users don't realise the key now lives in their device's passkey settings. — [Coinbase Help](https://help.coinbase.com/en/wallet/getting-started/smart-wallet); [Splits: Passkeys in practice](https://splits.org/help/coinbase-smart-wallet-passkeys/); [Eco: passkey wallets](https://eco.com/support/en/articles/15039720-passkey-wallets-explained)
- A 2026 teardown notes Coinbase "pivoted to Smart Wallet (passkey-based) after recognizing the original approach wasn't working"; Payy creates the wallet locally with no login/email/password; Cash App uses "one action per screen." — [Masterly teardown, Apr 2026](https://www.themasterly.com/blog/crypto-wallet-ux-teardown)
- FIDO Alliance: passkeys available to 1B+ people by mid-2025; 53% of surveyed people had enabled passkeys on at least one account (relayed). — [Spark citing FIDO](https://www.spark.money/research/self-custodial-wallet-ux-barriers); [FIDO Alliance](https://fidoalliance.org/passkeys/)
- EIP-7702 went live on Ethereum mainnet May 7, 2025 (Pectra). It lets an existing EOA delegate to smart-account code, enabling batching, gas sponsorship, session keys, recovery and passkey-friendly UX without changing address. MetaMask Smart Account uses 7702 as its upgrade path; Ambire, Trust Wallet and Safe (7702-compatible implementation) adopted it; embedded wallets were fastest adopters. — [Eco 7702 deep dive 2026](https://eco.com/support/en/articles/15254037-erc-7702-deep-dive-2026-eoa-becomes-smart-wallet); [Turnkey: ERC-4337 to EIP-7702](https://www.turnkey.com/blog/account-abstraction-erc-4337-eip-7702); [ethereum.org: Building on Ethereum in 2026](https://ethereum.org/latest/building-on-ethereum-in-2026/)
- Passkey signing on-chain relies on P-256 verification (RIP-7212 precompile on L2s). — [Alchemy: RIP-7212](https://www.alchemy.com/blog/what-is-rip-7212)
- Traditional self-custodial wallet onboarding is described as 7–9 steps and 10–15 minutes vs fintech parity of 4–6 steps and 2–5 minutes (aggregator estimate). — [Spark](https://www.spark.money/research/self-custodial-wallet-ux-barriers)

### Inferences
- For Flying Money, ECDSA-only EOAs are compatible with EIP-7702: an in-browser EOA (or MetaMask EOA) can later be upgraded to batch approve+fund and have gas sponsored on Arbitrum, without changing the owner address or the contract's "spenders are ECDSA-only" rule (the spender key remains an EOA signer). This is a path to "no ETH needed" without adopting ERC-1271.
- The in-browser wallet is effectively an embedded wallet without an auth layer; the biggest UX gap relative to 2026 norms is (a) the owner needs ETH for gas and (b) recovery depends on a user-managed passphrase file rather than a passkey/cloud-synced credential.
- Ordering: put "Create a wallet in this browser" (or email/passkey if added) first and "Connect an existing wallet" second is consistent with the >50% embedded-choice figure; keep connect-wallet visible for crypto-native owners.

### Gaps
- No independent (non-vendor) A/B data comparing embedded vs connect-wallet conversion found. Coinbase has not published Smart Wallet funnel conversion numbers that I could find.
- No verified data on 7702 adoption counts on Arbitrum specifically.

## 2. Funding and on-ramp UX: USDC on a specific chain, bridging, fiat on-ramps, approve-then-deposit vs permit

### Takeaway
Fiat on-ramps with Apple Pay/guest checkout and zero-fee USDC have made "buy USDC directly on the target chain" the standard; the approve+deposit double transaction is widely regarded as a known friction point, and USDC natively supports EIP-2612 permit (one signature, no separate approve transaction).

### Cited Findings
- Coinbase Onramp offers guest checkout for eligible purchases, Apple Pay, and zero-fee USDC on/off-ramping for developers integrating CDP Onramp/Offramp; there is also a headless onramp API to embed the flow in your own UI. — [Coinbase: Zero-fee USDC](https://www.coinbase.com/developer-platform/discover/launches/zero-fee-usdc); [Coinbase Onramp](https://www.coinbase.com/developer-platform/products/onramp); [Headless onramps](https://www.coinbase.com/developer-platform/discover/launches/headless-onramps); [Apple Pay blog](https://www.coinbase.com/blog/Fiat-to-crypto-in-seconds-with-Apple-Pay)
- Dec 2025: Bitget Wallet + Alchemy Pay launched 0% fee USDC purchases via Apple Pay/Google Pay, subsidised with Coinbase. — [GlobeNewswire](https://www.globenewswire.com/news-release/2025/12/22/3209028/0/en/Bitget-Wallet-and-Alchemy-Pay-Launch-Zero-Fee-USDC-On-Ramp-Backed-by-Coinbase.html)
- USDC implements ERC-2612 permit, enabling one-step signature-based approvals; ERC-2612 is gasless for the approval step but only works for tokens that implement it; Permit2 wraps any ERC-20 but requires one initial on-chain approval to the Permit2 contract. — [ERC-2612 spec](https://eips.ethereum.org/EIPS/eip-2612); [Eco: ERC-2612 explained](https://eco.com/support/en/articles/12005190-erc-2612-permit-explained-gasless-token-approvals-on-ethereum); [Eco: Permit2 guide](https://eco.com/support/en/articles/12005545-what-is-permit2-the-complete-guide-to-next-generation-token-approvals)
- Permit2 was designed to fix "the endless 'Approve' then 'Swap' double-transaction flow" and dangerous unlimited approvals; unlimited approvals mean a compromised spender contract can drain approved tokens; residual risk with permits is signature phishing via malicious EIP-712 requests. — [Eco: Permit2](https://eco.com/support/en/articles/12005545-what-is-permit2-the-complete-guide-to-next-generation-token-approvals); [Gate Learn: Permit/Permit2 risks](https://www.gate.com/learn/articles/a-deep-dive-into-the-erc-20-authorization-model-how-permit-and-permit2-work-their-risks-and-key-differences/8707)
- Circle documents multiple ways to authorize USDC contract interactions (approve, permit, and authorization-based transfers). — [Circle blog](https://www.circle.com/blog/four-ways-to-authorize-usdc-smart-contract-interactions-with-circle-sdk) (could not fetch: TLS error; contents not verified)
- EIP-7702 enables batching (e.g., approve + action in one user operation) for existing EOAs. — [Turnkey](https://www.turnkey.com/blog/account-abstraction-erc-4337-eip-7702)

### Inferences
- Best-to-worst options for Flying Money's "approve then fund": (1) contract function that accepts an ERC-2612 permit signature and funds in one transaction (one signature + one tx; no lingering allowance); (2) EIP-7702 batched approve+fund; (3) exact-amount approve then fund, shown as a numbered two-step with explanation ("Step 1 of 2: allow the certificate contract to move exactly 50.00 USDC. Step 2 of 2: lock it"). Avoid unlimited approvals. Recent commit "an approve that went through is never asked for again" matches pattern (3); a permit path would remove the step entirely. Adding a permit entrypoint touches §7 (contract), so check against BUILD_SPEC before proposing.
- Funding copy should name the chain explicitly ("USDC on Arbitrum") and show "Buy with card" (onramp preset to Arbitrum + USDC + destination address) and "Send from an exchange" with a warning about choosing the Arbitrum network; wrong-network deposits from exchanges are a known loss vector (not quantified in sources found).
- Testnet: an on-ramp is irrelevant on testnet; a faucet link (Circle testnet faucet) serves the same role.

### Gaps
- No quantified data found on drop-off at approve-then-deposit vs permit flows.
- No data found on wrong-chain deposit loss rates.
- Could not verify Coinbase Onramp's current support/fee terms for Arbitrum specifically.

## 3. Transaction states, error messages, network switching

### Takeaway
Map standard wallet error codes to plain-language, non-alarming messages with a single next action; treat every state (connecting, awaiting signature, submitted, confirming, confirmed, failed) as explicit and predictable. Evidence here is mostly standards and practitioner guidance rather than measured studies.

### Cited Findings
- EIP-1193 code 4001 = "User rejected the request" (user clicked Cancel). Code 4902 = chain not added to the wallet; the pattern is to catch 4902 and call `wallet_addEthereumChain`, then switch. `wallet_switchEthereumChain` shows a confirmation to the user. — [MetaMask troubleshooting](https://docs.metamask.io/metamask-connect/troubleshooting/); [LogRocket: MetaMask error codes](https://blog.logrocket.com/understanding-resolving-metamask-error-codes/)
- WalletConnect v2 has its own spec'd error codes for sessions/requests. — [WalletConnect error codes spec](https://specs.walletconnect.com/2.0/specs/clients/sign/error-codes)
- Practitioner guidance: "From the first connection to network switching, transaction signing, confirmation, errors, and disconnection, every state should be clear and predictable." Common WalletConnect failure modes: stale/ghost sessions, silent sign requests not appearing on the phone due to network mismatch, QR scan failures, session timeouts. — [Khalil Ahmed: Wallet UX best practices](https://www.khalilahmed.dev/articles/wallet-ux-best-practices-web3-apps); [Bitget Academy troubleshooting](https://www.bitget.com/academy/walletconnect-fix)
- WalletConnect Foundation and Reown launched "WalletConnect Certified", a UX standards framework for wallets. — [Cointelegraph](https://cointelegraph.com/news/wallet-connect-foundation-reown-establish-onchain-ux-standards-framework)
- Users hold misconceptions that transactions are free, reversible and cancellable anytime; CHI 2021 study flagged complex metaphors, technical terminology and lack of guidance. — [CHI 2021 "The U in Crypto Stands for Usable"](https://dl.acm.org/doi/fullHtml/10.1145/3411764.3445407) (relayed via search summary; full text 403)
- Phantom's zero-balance "$0.00 with no guidance" is criticised as an activation dead-end; Cash App treats empty states as onboarding content. — [Masterly teardown](https://www.themasterly.com/blog/crypto-wallet-ux-teardown)

### Inferences
- Concrete message map for Flying Money:
  - 4001 rejected: neutral, not an error colour: "You cancelled in your wallet. Nothing was sent." + "Try again".
  - 4902 / wrong chain: auto-prompt switch, fall back to add-chain; copy: "Your wallet is on Ethereum. This app uses Arbitrum. [Switch to Arbitrum]".
  - Insufficient ETH for gas: say how much is needed and how to get it (faucet on testnet); avoid "gas" jargon on first mention ("network fee, paid in ETH").
  - Insufficient USDC: show balance vs required in USDC.
  - Pending in wallet: "Check your wallet to confirm" with a hint that mobile wallets may need to be opened manually (WalletConnect silent-request issue).
  - Submitted: show tx link to Arbiscan immediately; "Confirming…" then "Done"; never allow double-submit (the recent F5 commit on "lock twice" aligns).
  - Because transactions are irreversible, the confirm screen should state it explicitly before signing ("Once locked, only the spender can use it until [end date]; you get the rest back after").
- Optimistic UI is fine for display (show the certificate as "Locking…") but do not show a redeemable QR or "funded" state until the receipt is confirmed.

### Gaps
- No measured studies found comparing error-copy variants or optimistic vs confirmed-state UI for crypto transactions.
- Could not retrieve WalletConnect Certified criteria text.

## 4. Key backup and recovery

### Takeaway
Seed phrases are poorly understood and frequently lost or mis-stored; peer-reviewed work (CHI 2025) shows many users think a seed phrase can be reset like a password. Industry has moved to passkeys (cloud-synced), MPC with cloud share, and guardian/timelocked social recovery. A passphrase-encrypted file backup is closer to a seed phrase in risk profile than to a passkey, and needs explicit verification and redundancy.

### Cited Findings
- CHI 2025, "Of Secrets and Seedphrases: Conceptual Misunderstandings and Security Challenges for Seed Phrase Management among Cryptocurrency Users" (CMU): survey of 643 crypto users + 20 interviews. Relayed findings: only ~43% (43.4%) correctly identified an image of a seed phrase; 58% believed they could choose/reset one like a password; 52% said username+password was enough to recover a wallet; users stored phrases in plaintext notes, screenshots or online docs, and shared them with partners; inheritance planning was incoherent. — [ACM DL](https://dl.acm.org/doi/full/10.1145/3706598.3713209) (full text 403; numbers via [Spark](https://www.spark.money/research/self-custodial-wallet-ux-barriers) and [Masterly](https://www.themasterly.com/blog/crypto-wallet-ux-teardown); verify against the PDF before quoting)
- One secondary summary says the CHI 2025 study found single-method (paper-only) backups were more likely to lose access than redundant strategies; this could not be verified and may be an aggregator embellishment. — search summary (unverified)
- SOUPS 2020 (N=29, grounded theory): users frequently fail to manage private keys securely and wrongly assume anonymity. — [USENIX/ACM: User mental models of cryptocurrency systems](https://dl.acm.org/doi/10.5555/3488905.3488924); [CISPA PDF](https://publications.cispa.saarland/3124/1/Soups_Bitcoin_MM.pdf)
- CCS 2023: mental models affect adoption of multi-device (distributed-key) wallets. — [ACM CCS 2023](https://dl.acm.org/doi/abs/10.1145/3576915.3623218); [ePrint](https://eprint.iacr.org/2022/075.pdf)
- Early key-management usability study. — [arXiv: A first look at the usability of bitcoin key management](https://arxiv.org/pdf/1802.04351)
- Oobit survey (2026, 1,000 US holders, industry survey): 35% had lost wallet/account access; 31% never recovered funds; only 15% had tested their recovery; causes: forgotten passwords 33%, lost recovery phrases 21%, lost 2FA 20%. — [Spark citing Oobit](https://www.spark.money/research/self-custodial-wallet-ux-barriers) (industry survey, not peer-reviewed)
- Lost BTC estimates: Chainalysis 2.3–3.7M BTC (11–18% of supply); River ~1.6M BTC lost to self-custody mismanagement. — [Ledger Academy](https://www.ledger.com/academy/topics/economics-and-regulation/how-many-bitcoin-are-lost-ledger); [CryptoSlate on River](https://cryptoslate.com/insights/river-study-suggests-over-1-5-billion-in-bitcoin-lost-to-self-custody/)
- Recovery patterns in 2026: social recovery (Argent Guardians), multisig signers (Safe), passkey backup (Coinbase Smart Wallet + iCloud Keychain/YubiKey), timelocked recovery, MPC+smart-wallet hybrids. Argent enforces a 36-hour delay during which the original signer can cancel. — [Eco: Smart wallet recovery 2026](https://eco.com/support/en/articles/15254048-smart-wallet-recovery-2026-social-multisig-passkey-options)
- Zengo: MPC key shares split between device and cloud; biometric recovery; open-source recovery kit to reconstruct from device share + encrypted backup share; ~2M users, "zero hacks" claimed. — [Zengo Help: Recovery Kit](https://help.zengo.com/en/articles/2603673-what-is-zengo-s-recovery-kit); [Coin Bureau review](https://coinbureau.com/review/zengo)
- Vitalik's social recovery essay (design rationale for guardians). — [vitalik.eth.limo](https://vitalik.eth.limo/general/2021/01/11/recovery.html)
- Teardown: Coinbase Wallet put the seed phrase behind an easy-to-skip optional step; Trust Wallet presented backup as a checkbox without explaining consequences. — [Masterly](https://www.themasterly.com/blog/crypto-wallet-ux-teardown)

### Inferences
- For Flying Money's passphrase-sealed backup: (a) name it for what it is ("Backup file, locked with a passphrase you choose. We can't reset it."), directly countering the 58% "resettable" misconception; (b) require a restore test (decrypt the downloaded file in-app) before marking backup done, since only ~15% ever test; (c) suggest two locations (e.g., password manager + offline copy); (d) gate: don't allow funding more than a small amount until a verified backup exists; (e) enforce passphrase strength with a meter and don't let people paste the passphrase next to the file.
- Spender in-browser keys: since certificates are bounded (one seller, end date, refund to owner), key loss for a spender is recoverable economically (owner reclaims after end date). Say so in the UI: "If you lose this phone, the owner gets the unspent money back on [date]." This is a strong, honest trust message unavailable to general wallets.
- Longer-term: passkey-protected encryption of the in-browser key (WebAuthn PRF extension) would give cloud-synced recovery while keeping the on-chain signer ECDSA. (Inference; PRF not researched in this pass.)

### Gaps
- Could not access the CHI 2025 full text to confirm exact percentages and design recommendations.
- No published loss-rate data for passkey-based wallets (e.g., users losing passkeys when switching ecosystems) found.
- No research found specifically on passphrase-encrypted file backups (the Flying Money model).

## 5. Displaying addresses, amounts, USD vs USDC

### Takeaway
Truncated addresses (first/last few chars) are actively exploited by address poisoning; the best-evidenced defences are showing more of the address, address books, flagging lookalikes and hiding dust/zero-value transfers. For amounts, consumer apps lead with one large balance and plain dollar framing; I found no authoritative guideline on "USD" vs "USDC" labelling.

### Cited Findings
- USENIX Security 2025 "Blockchain Address Poisoning" (Tsuchiya et al.): 270M poisoning attempts against 17M victims on Ethereum and BSC over two years; 6,633 successful incidents, ~$83.8M losses (~$79.3M on Ethereum). Detection used lookalikes matching ≥3 prefix and ≥4 suffix hex chars; one group achieved up to 20-digit matches (GPU generation). Techniques: tiny transfers, zero-value transfers, counterfeit tokens. Recommendations: display longer address segments, hide/flag suspected poisoning transfers, require confirmation when sending to lookalikes of recent contacts, allow-lists. — [arXiv 2501.16681](https://arxiv.org/html/2501.16681v3); [USENIX](https://www.usenix.org/conference/usenixsecurity25/presentation/tsuchiya)
- May 2024: single victim lost $68M in WBTC to a poisoned address; attack cost ~$0.65 in gas. — [Spark: address poisoning](https://www.spark.money/research/bitcoin-address-poisoning-attack-defense); [Blockaid](https://blockaid.io/blog/address-poisoning-the-growing-threat-draining-millions-from-crypto-users)
- Guidance: never present truncated addresses as the primary identifier; make address books first-class; prefer payment-request protocols over copy-paste. — [Spark](https://www.spark.money/research/bitcoin-address-poisoning-attack-defense)
- ERC-8117 proposes an anti-poisoning compact EVM address display format (visual only, EIP-55 compatible). Draft status. — [ERC-8117](https://eips.ethereum.org/EIPS/eip-8117)
- Identity patterns: Phantom uses @username + avatar; Cash App $Cashtag; Coinbase Wallet shows "Address 1"/hex (criticised as for protocol-literate users). Balance-first home screens (Phantom, Cash App, Payy) are praised. — [Masterly teardown](https://www.themasterly.com/blog/crypto-wallet-ux-teardown)
- Circle's own framing is "digital dollar", redeemable 1:1 for USD. — [Circle USDC](https://www.circle.com/usdc); [usdc.com](https://www.usdc.com/learn/what-is-usdc)

### Inferences
- Flying Money has a structural advantage: holders pay by showing a QR (payment-request pattern) rather than typing addresses, which the poisoning literature recommends. Keep it that way; where addresses must be shown (seller, spender), show a name/label the owner assigned plus a longer segment (e.g., 6+6 chars, or full address with middle chunked on expand), a copy button that copies the full checksummed address, and an explorer link.
- Amounts: display "50.00 USDC" with "≈ $50.00" secondary is the honest compromise; avoid showing only "$" which implies bank dollars, and avoid showing base units (50000000) anywhere except developer views. Always format from bigint with 6 decimals; use fixed 2 decimals for display unless the value has sub-cent precision.
- Never render incoming zero-value/dust transfers in any history the app shows (poisoning vector).

### Gaps
- No user research found on "USD" vs "USDC" label comprehension or trust.
- ENS/name-resolution UX data on L2s (Arbitrum) not researched in this pass.

## 6. Testnet / risk disclosure UX

### Takeaway
I found no rigorous research on testnet or "unaudited" disclosure design. Guidance must be inferred from general principles and from the misconceptions literature (users believe transactions are reversible and wallets resettable).

### Cited Findings
- Users believe transactions are free, reversible and cancellable; wallets use technical terminology without guidance. — [CHI 2021](https://dl.acm.org/doi/fullHtml/10.1145/3411764.3445407)
- Onboarding in consumer-grade apps explains the custody model up front (Phantom: "Controlled by you") before setup. — [Masterly teardown](https://www.themasterly.com/blog/crypto-wallet-ux-teardown)

### Inferences
- A persistent, calm, non-dismissable-per-session strip ("Test network: this is practice money with no value") plus labelling amounts as "test USDC" in the balance and on the QR/redemption screen reduces confusion without alarmist red banners.
- "Unaudited" belongs at the funding confirmation step (where risk is taken), with a cap tied to `packages/chains` caps, rather than as a scare banner on the landing page.
- When a mainnet mode exists, visually differentiate networks (e.g., a network pill that changes colour) so testnet screenshots are never mistaken for real funds.

### Gaps
- No studies or published A/B tests on testnet or beta-risk banners in crypto apps found.

## 7. Academic usability studies of crypto wallets (summary)

### Takeaway
The academic record is consistent: users' mental models of keys are wrong in predictable ways (password-like, resettable, custodial), backup practices are unsafe, and terminology/metaphors cause errors. Design should remove the need for understanding keys, not teach it.

### Cited Findings
- SOUPS 2020 mental models (N=29). — [ACM](https://dl.acm.org/doi/10.5555/3488905.3488924)
- CHI 2021 mobile wallet UX study. — [ACM](https://dl.acm.org/doi/fullHtml/10.1145/3411764.3445407)
- CCS 2023 multi-device wallet mental models. — [ACM](https://dl.acm.org/doi/abs/10.1145/3576915.3623218)
- USEC 2022 CoinJoin wallet usability. — [NDSS](https://www.ndss-symposium.org/wp-content/uploads/usec2022_23037_paper.pdf)
- CHI 2025 seed phrases (N=643 + 20). — [ACM](https://dl.acm.org/doi/full/10.1145/3706598.3713209)
- USENIX Security 2025 address poisoning. — [arXiv](https://arxiv.org/html/2501.16681v3)

### Inferences
- Avoid the words "private key", "seed", "sign", "gas" in the primary owner and holder paths; use "backup file", "confirm in your wallet", "network fee".

### Gaps
- Could not read ACM full texts (403) for CHI 2021/CHI 2025 to extract design recommendations verbatim.
- No 2025–2026 academic study on embedded-wallet or passkey-wallet usability found in this pass.
