---
title: Protocol
description: EIP-712 notes, HTTP headers, the seller's verification algorithm and the buyer's durable outbox.
---

# Protocol

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

## Seller algorithm

The seller keeps, per certificate: `accepted` (the best total it holds), `consumed` (value served), `reserved` (in flight), and one outcome per `requestId`.

1. Parse the note. Unknown chain or contract → `402` offer.
2. Read the certificate (cached; payee and spender never change).
3. A known `requestId` returns its stored outcome, after an ECDSA check (replays are free).
4. Check payee, `closed`, remaining lifetime ≥ `minRemainingLifetime`, signature, `cumulative ≤ faceValue`.
5. Atomically: `consumed + reserved + price ≤ max(accepted, cumulative)`, then `reserved += price` and `accepted = max(accepted, cumulative)` (no overspend under concurrency).
6. Serve. Success → `consumed += price`; failure → the price becomes **credit**.
7. Return a receipt.

The redeemer only ever redeems served value, before `expiresAt − 30 min`.

## Buyer algorithm

Per certificate, the buyer durably stores `accepted`, `consumed` and at most one pending note.

1. On a `402`, pick a certificate for that payee and chain with enough left and enough lifetime.
2. **If a note is pending, resend exactly that note** until a final receipt.
3. Sign `next = max(accepted, consumed + price)` with a fresh `requestId`. Refuse if `next > faceValue`.
4. **Save the pending note, then send it.**
5. On a timeout, resend the same note. Never sign a new one.
6. On a receipt, update `accepted` and `consumed` and clear the pending note.

**No growth on failure:** a network failure, timeout or crash never makes the spender sign a higher total.

## At a counter

The same objects travel as QR codes: the till shows a price QR (an offer with `memoHint` = order id), and the customer's phone shows a payment-slip QR (the signed note) with `memo = keccak256(orderId)`. Tills report **GUARANTEED** (shown as "Accepted: covered by a checked budget"; certificate verified on-chain by this till, note passes the seller algorithm), **UNVERIFIED** (shown as "Accepted at your own risk: not checked yet"; offline, never-seen certificate, capped by a first-visit limit) or **REJECTED**. See [People & shops](/docs/shops).

## Carriers

A slip doesn't care how it travels. Every carrier ends in the same seller checks above, so a new carrier is only an
adapter that moves a few hundred bytes. `@flying-money/core` implements everything in this section
(`encodeNoteCompact`, `decodeNoteCompact`, `encodeOfferCompact`, `decodeOfferCompact`, `toFrames`, `frameCollector`).

### Compact forms

For carriers with little room, a slip and a price code have compact text forms. They decode to exactly the same
signed objects as the `fm1.` forms; the contract address and the token are not carried, because both sides look them
up by chain id in the registry (`carryContext` in `@flying-money/chains`).

| Form | Bytes (before base64url) |
|---|---|
| `fm2n.` slip | `flags(1)` `chainId(4)` `certificateId(32)` `cumulative(8)` `[memo(32)]` `sig(64)` |
| `fm2o.` price code | `flags(1)` `chainId(4)` `payee(20)` `price(8)` `minRemainingLifetime(4)` `hintLen(1)` `hint(utf8, ≤ 64)` |

- Integers are big-endian. `sig` is the EIP-2098 compact form of the same signature.
- Slip `flags` bit 0 says the memo is present. A till's slip may leave it out: the till derives it from its own order
  (`memo = keccak256(orderId)`), and no one else can read that slip.
- A sender uses the compact form only when it carries the object exactly (the registry's contract, an amount below
  2⁶⁴, a single accepted network); otherwise it sends the `fm1.` form. Receivers accept both.
- A slip is about 190 characters with its memo and about 150 without; a price code about 80.

### Frames

Carriers that take less at a time (a sound chirp, a Bluetooth write, a LoRa packet, a ROS 2 or MQTT message with a
size limit) send numbered frames: `<i>/<n>:<part>`, with 1 ≤ i ≤ n ≤ 99. Receivers collect frames in any order,
ignore repeats, and join the parts in order of `i` once all `n` have arrived. A receiver never acts on a partial
payload.

### Links

A link carries a payload after `#` (`https://<site>/carry#fm2n.…`), so it is never sent to a server. Links, shares
and NFC URL records open the payload in Flying Money on any device.

### Carrier mapping

| Carrier | Status | How the payload travels |
|---|---|---|
| HTTP | Live | `Flying-Money-Offer` / `Flying-Money-Note` headers (`fm1.`), or x402 V2 (`PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE`) |
| MCP | Live | The MCP server pays HTTP sellers with slips by itself |
| QR code | Live | A link, or the bare compact form |
| Sound and ultrasound | Live | ggwave chirps, one frame each (at most 140 characters) |
| Share sheet, link, file, text | Live | A link (`/carry#…`), or the bare form |
| Local network discovery | Next | Sellers advertise on mDNS / DNS-SD (`_agent._tcp`, per the IETF agent-discovery draft); paying is HTTP |
| Bluetooth LE | Next | Frames written to one GATT characteristic; the reply (price code or receipt) as notifications |
| NFC | Next | An NDEF URL record holding the link |
| MQTT | Next | `fm/<payee>/offer`, `fm/<payee>/slip`, `fm/<payee>/receipt`; one frame per message where the broker limits size |
| ROS 2 | Next | A payer node and a seller node exchanging the compact forms; spending keys stay inside the node |
| LoRa and mesh radio | Next | Frames, one per packet |

On every carrier, a slip can be replayed by whoever holds it, but only to the seller it names, and only once: the
seller's records (S1–S4) refuse a second use. Treat a slip like a ticket for that one seller.
