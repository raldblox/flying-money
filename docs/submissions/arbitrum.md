# Flying Money — Arbitrum submission review

Submission material only (BUILD_SPEC §21.2): not served by the app or included in its llms files.

**Give a budget. Not your wallet.** Funded spending for people and agents, with local payment checks and on-chain collection.

## Review the product

- [Website](https://useflyingmoney.vercel.app/)
- [Demo](https://useflyingmoney.vercel.app/demo): illustration first; the real-run control starts the testnet flow.
- [Dashboard](https://useflyingmoney.vercel.app/app): budget requests, owner approvals and funded budgets.
- [Developer documentation](https://useflyingmoney.vercel.app/docs)
- [Pitch deck, revision 5](flying-money-pitch.pdf)
- [Current review evidence and limitations](REVIEW_READINESS_2026-10-03.md)
- [Security model](../SECURITY.md), [build specification](../BUILD_SPEC.md), [implementation decisions](../DECISIONS.md)

The buyer in the demo is scripted. The SDK and MCP integration are separate developer entry points, not evidence of autonomous-agent adoption. Commercial plans in the deck are proposals, not revenue or pilot commitments.

## Contract

Arbitrum Sepolia: 0xb9ae3158f9cA841d9Da3C3725014D8352ca967F2 — FlyingMoney USDC Escrow

[Contract and verified-source record](https://arbitrum-sepolia.blockscout.com/address/0xb9ae3158f9cA841d9Da3C3725014D8352ca967F2?tab=contract)

The address is recorded in `packages/chains/src/deployments.json`; deployment evidence is recorded in `docs/STATUS.md`. This review did not perform a new live-chain verification. Only the testnet deployment is claimed. There is no factory, pool or project-issued token. USDC is the external settlement asset, not a Flying Money token.

## What to inspect

1. Owner locks funds for one seller, one spending key and an expiry.
2. Spender signs cumulative payment notes; the seller verifies funding, signatures and its authoritative acceptance state.
3. Seller collects accrued increments before expiry, optionally batching notes with `redeemMany`.
4. Owner can reclaim the remainder after expiry by submitting an on-chain transaction.

Funds cannot be redirected to another seller. A stolen spending key can still consume its remaining authorized budget at the named seller. Payment does not guarantee service delivery.

Offline checks require previously verified funding and authoritative local records. Buyer-to-seller communication must still work; collection needs blockchain connectivity before expiry. The HTTP 402 scheme is Flying Money-specific: this is not a claim of completed x402 or MPP compatibility.

## Reproduce and assess

Follow the root README for submodules, dependencies and local builds. Run `pnpm verify`; use `pnpm verify --e2e` for browser coverage. Read the dated review evidence before treating a passing cached run as fresh test evidence.

Contract invariants I1–I7, client C1 and seller S1–S4 are not substitutes for an independent security audit. The project remains unaudited and testnet-only.

## Submission completion is separate

The deck is prepared. Final video links, form values, eligibility and submission confirmation must be checked in the organizer portal. This repository document is not proof of submission, awards, approval or mainnet readiness.
