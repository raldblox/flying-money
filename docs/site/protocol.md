---
title: Protocol
description: EIP-712 notes, HTTP headers, the seller's verification algorithm and the buyer's durable outbox.
---

# Protocol (v1.4.1)

## Objects

A **certificate** lives on one chain in the FlyingMoney contract:

| Field | Meaning |
|---|---|
| `funder` | Locked the money; gets the remainder back after expiry |
| `payee` | The only address that can ever receive the money |
| `spender` | A secp256k1 key that signs notes. It holds nothing and sends no transactions |
| `faceValue` | The budget, in USDC base units (6 decimals) |
| `redeemed` | How much has been paid out so far |
| `expiresAt` | Unix seconds |

`id = keccak256(abi.encode(chainId, contract, funder, funderNonce))`.

A **note** is an EIP-712 signature by the spender over a *running total*:

```
domain = { name: "FlyingMoney", version: "1", chainId, verifyingContract }
Note(bytes32 certificateId, uint256 cumulative, bytes32 memo)
```

`cumulative` only ever grows. Redeeming a note pays `cumulative − redeemed` to the payee. `memo` is the request id, so one note maps to one request.

## Wire format

Every object on the wire is `fm1.` + base64url(JSON), with integers as decimal strings. Headers:

| Header | Direction | Content |
|---|---|---|
| `Flying-Money-Offer` | seller → buyer, with `402` | `{ scheme: "flying-money", v: 1, price, minRemainingLifetime, accepts: [{ chainId, contract, token, payee }], memoHint? }` |
| `Flying-Money-Note` | buyer → seller | `{ v: 1, chainId, contract, certificateId, cumulative, memo, sig }` |
| `Flying-Money-Receipt` | seller → buyer | `{ certificateId, requestId, status, accepted, consumed, reserved, credit, remaining, expiresAt }` |
| `Flying-Money-Reason` | seller → buyer, with `402` | why the note was refused: `insufficient`, `wrong-payee`, `expiring`… |

Headers are at most 2,048 bytes. A signed note (the “payment slip” in the app) is about 544 characters, small enough for one QR code at error-correction level M.

## Seller algorithm (§6.5)

The seller keeps, per certificate: `accepted` (the best total it holds), `consumed` (value served), `reserved` (in flight), and one outcome per `requestId`.

1. Parse the note. Unknown chain or contract → `402` offer.
2. Read the certificate (cached; payee and spender never change).
3. A known `requestId` returns its stored outcome, after an ECDSA check (replays are free, S1).
4. Check payee, `closed`, remaining lifetime ≥ `minRemainingLifetime`, signature, `cumulative ≤ faceValue`.
5. Atomically: `consumed + reserved + price ≤ max(accepted, cumulative)`, then `reserved += price` and `accepted = max(accepted, cumulative)` (no overspend under concurrency, S4).
6. Serve. Success → `consumed += price`; failure → the price becomes **credit** (S3).
7. Return a receipt.

The redeemer only ever redeems served value, before `expiresAt − 30 min`.

## Buyer algorithm (§6.6)

Per certificate, the buyer durably stores `accepted`, `consumed` and at most one pending note.

1. On a `402`, pick a certificate for that payee and chain with enough left and enough lifetime.
2. **If a note is pending, resend exactly that note** until a final receipt.
3. Sign `next = max(accepted, consumed + price)` with a fresh `requestId`. Refuse if `next > faceValue`.
4. **Save the pending note, then send it.**
5. On a timeout, resend the same note. Never sign a new one.
6. On a receipt, update `accepted` and `consumed` and clear the pending note.

**Invariant C1:** a network failure, timeout or crash never makes the spender sign a higher total.

## At a counter (§6.8)

The same objects travel as QR codes: the till shows a price QR (an offer with `memoHint` = order id), and the customer's phone shows a payment-slip QR (the signed note) with `memo = keccak256(orderId)`. Tills report **GUARANTEED** (certificate verified on-chain by this till, note passes the seller algorithm), **UNVERIFIED · merchant risk** (offline, never-seen certificate, capped by a first-visit limit) or **REJECTED**. See [People & shops](/docs/shops).
