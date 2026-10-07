---
title: Contract
description: FlyingMoney.sol functions, events, errors, caps and deployments.
---

# Contract (`FlyingMoney.sol`)

Solidity 0.8.24 with OpenZeppelin 5.1.0. **No owner, no admin, no pause, no upgrade, no fee.** One settlement token per deployment (the chain's Circle USDC), fixed in the constructor. Addresses for every chain: [Deployments](/chains) and [`/.well-known/flying-money.json`](/.well-known/flying-money.json).

## Functions

| Function | Who | What |
|---|---|---|
| `issue(payee, spender, faceValue, expiresAt) → id` | anyone (the funder) | Pulls `faceValue` USDC and opens a certificate. Lifetime 1 hour to 365 days. `spender` must differ from the funder and the payee |
| `topUp(id, amount)` | funder | Adds to the face value |
| `extend(id, newExpiresAt)` | funder | Moves expiry later (never earlier) |
| `redeem(id, cumulative, memo, signature) → paid` | anyone | Pays `cumulative − redeemed` to the payee |
| `redeemMany(SignedNote[]) → totalPaid` | anyone | Batch redeem; bad notes are skipped with `NoteSkipped`, not reverted |
| `reclaim(id) → refunded` | funder, after expiry | Returns the unredeemed remainder and closes the certificate |
| `getCertificate(id)` | view | The certificate struct |
| `noteDigest(id, cumulative, memo)` | view | The EIP-712 digest a spender signs |
| `totalOutstanding()` | view | Σ (faceValue − redeemed) over open certificates |

Spenders are verified with **ECDSA only** (`ECDSA.tryRecover`, low-s). There is no ERC-1271: contract signatures can be revoked, so a note accepted offline could stop being valid.

## Events

`CertificateIssued(id, funder, payee, spender, faceValue, expiresAt)` · `CertificateToppedUp(id, amount, newFaceValue)` · `CertificateExtended(id, newExpiresAt)` · `NoteRedeemed(id, cumulative, paid, memo, redeemer)` · `NoteSkipped(id, cumulative, reason)` · `CertificateReclaimed(id, refunded)`

`NoteSkipped` reasons: 1 unknown, 2 closed, 3 expired, 4 exceeds face value, 5 nothing to redeem, 6 bad signature.

## Errors

`InvalidParams` · `UnknownCertificate` · `NotFunder` · `Expired` · `NotExpired` · `Closed` · `ExceedsFaceValue` · `ExceedsCap` · `InvalidSignature` · `NothingToRedeem` · `UnsupportedToken`

## Optional caps

Two immutable caps can be set at deployment (0 = unlimited):

- `maxFaceValue`: per-certificate cap.
- `maxTotalOutstanding`: deployment-wide cap.

There is no admin, so caps can never be raised, only superseded by a new deployment. The test-network deployments are uncapped. The Arc mainnet deployment is capped at 100 USDC per certificate and 1,000 USDC in total.

## Invariants (tested with Foundry, 256 runs × depth 50)

- **I1** `redeemed ≤ faceValue` for every certificate.
- **I2** Solvency: the contract's USDC balance equals `totalOutstanding`, the sum of `faceValue − redeemed` over open certificates. **I2b** `totalOutstanding ≤ maxTotalOutstanding` when the cap is set.
- **I3** A payee receives exactly the highest valid total redeemed for its certificates.
- **I4** A funder never pays out more than the face value it issued.
- **I5** No certificate pays anyone other than its payee (redeem) or its funder (reclaim).
- **I6** After reclaim, no further transfers happen for that certificate.
- **I7** `redeemed` never decreases.

Unit tests also cover ECDSA-only permanence (a spender address that later gains contract code changes nothing), high-s rejection, domain separation and key isolation. Details and gas numbers: [SECURITY.md](https://github.com/raldblox/flying-money/blob/main/docs/SECURITY.md).
