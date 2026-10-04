# Compatibility: Flying Money, x402 batch settlement, MPP sessions (research only)

**28 Sep 2026 · design note · no implementation, no "compatible" badge.** Sources were read on 28 Sep 2026: [x402 batch settlement](https://docs.x402.org/schemes/batch-settlement) and [Tempo session intent (MPP)](https://paymentauth.org/draft-tempo-session-00.html). Documentation describes a design, not every deployment. Flying Money's column is the implemented protocol ([protocol](../site/protocol.md), [contract](../site/contract.md)).

## The matrix

| Boundary | Flying Money (certificate + note) | x402 batch settlement | MPP / Tempo session |
|---|---|---|---|
| **Identity** | Funder, one **immutable payee**, one spender key (ECDSA EOA only), fixed at `issue` | Payer, receiver, optional delegated `voucherSigner` committed as `payerAuthorizer`; a `receiverAuthorizer` signs claims and refunds; a facilitator submits | Payer, `recipient`/payee, optional authorized signer (defaults to the payer); `channelId` derived from payer, payee, token, salt, chain |
| **Signature** | EIP-712 `Note(certificateId, cumulative, memo)`, domain `FlyingMoney` (chainId, contract), low-s ECDSA | ECDSA on EVM (recoverable), Ed25519 on Solana | EIP-712, domain "Tempo Stream Channel" (chainId, escrow), low-s secp256k1 |
| **Funding** | Funder deposits the face value on `issue`; `topUp` adds; ERC-20 approve + issue | Deposit into escrow via EIP-3009 or Permit2, submitted by the facilitator; default ~5× the per-request maximum | `open()` with a deposit; `topUp` |
| **Voucher** | **Cumulative** total per certificate, plus a request memo (requestId) | **Cumulative** claimable total | **Cumulative** `cumulativeAmount` |
| **Per-request idempotency** | Yes: memo = requestId, stored outcome, replay tombstone (S1) | Not specified in the scheme page read | Not specified beyond monotonic cumulative |
| **Early close by the payer** | **None.** Funder can only reclaim after the known `expiresAt` | Payer can withdraw unilaterally after `withdrawDelay`, unless claimed first | Payer `requestClose()` then `withdraw()` after a **15-minute** grace period |
| **Lifetime** | Known end date (1 h to 365 d); `extend` only lengthens it | Open until withdrawal | No expiry |
| **Collection** | Anyone may `redeem`/`redeemMany`; money only to the payee; seller must collect before `expiresAt` | Channel manager claims batches (`claimIntervalSecs`, `maxClaimsPerBatch`), then settles to the receiver | Server `settle()` any time or `close()` |
| **Offline acceptance** | GUARANTEED against a previously verified certificate and authoritative state; first-seen is UNVERIFIED merchant risk | Server verifies off-chain and serves at once; must watch for the payer's timed withdrawal | Server must watch for `requestClose` within 15 minutes |
| **Transport** | HTTP 402 with `Flying-Money-Offer`; request header `Flying-Money-Note`; receipt `Flying-Money-Receipt` | HTTP middleware (Express, FastAPI, net/http); x402 scheme negotiation | 402 with `WWW-Authenticate: Payment` (base64url request: `amount`, `currency`, `recipient`, `methodDetails`); client `Authorization: Payment` |
| **Networks** | EVM (Arbitrum Sepolia deployed; registry lists others) | EVM (Base Sepolia tested) and Solana | Tempo (TIP-20 tokens) |

## What the comparison shows

**Facts:**
- All three use the same core mechanism: an escrow, cumulative signed vouchers verified off-chain, and later batched collection.
- All three bind a payee and allow a delegated signing key.

**Inference (not a proven moat):** Flying Money's real difference is **no early close by the payer**. The seller can rely on a verified certificate until a known date without watching the chain for a withdrawal. The other two need the server to react within `withdrawDelay` or a 15-minute grace period. The same property costs the owner liquidity: money stays locked until the end date.

**Not equivalent:**
- A Flying Money note is **not** an x402 batch voucher or an MPP voucher. The signature domains, fields, contracts and close rights differ.
- Relabelling one as the other would be false.

## Options and go/no-go

| Option | What it would take | Recommendation |
|---|---|---|
| **A. Native x402 scheme** "flying-money" advertised in x402 payment requirements, next to our own headers | A transport envelope only: the certificate, note and contract stay unchanged. It needs client and server libraries that negotiate the scheme; facilitators aren't needed (anyone can redeem). | **Go for a design note and a prototype behind a flag**, later. It changes no economic rights, but needs its own design review before code. |
| **B. MPP method** carried in `WWW-Authenticate: Payment` | A second transport mapping of the same offer and note. MPP clients would need our method. | **Not now.** It has a smaller EVM reach today. Revisit if an MPP client asks. |
| **C. Gateway seller** (a budget pays a gateway that buys upstream with x402/MPP) | A new operated service holding liquidity. It needs quote binding, SSRF controls, idempotency, upstream failure handling and a legal review ("operating a service"). | **No-go for v1.6.** It adds custody-like and legal responsibility. |
| **D. Adopt another channel contract** | A different contract and different rights (early close) | **No-go.** It changes the sealed protocol and removes the property that defines the product. |

**Measure before any of these:** integration hours for one seller that already runs x402, and whether that seller values the no-early-close commitment enough to add a scheme.
