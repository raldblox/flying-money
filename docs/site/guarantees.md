---
title: Guarantees
description: Exactly what Flying Money guarantees, to whom, under which conditions, and what it doesn't.
---

# Guarantees

We make three claims, and no stronger ones:

1. **Every redeemable note is backed by funds reserved exclusively for its payee until the certificate expires.**
2. **The spender cannot authorize more than the certificate's face value.**
3. **Anyone can redeem a redeemable note, but its value can only be delivered to the certificate's payee.**

## Per party

| Party | Guarantee | Conditions |
|---|---|---|
| Payee (seller, shop) | Every redeemable note is backed by funds reserved for it; redeeming pays exactly `cumulative − redeemed` | Redeems before expiry; USDC not frozen; chain live; its acceptance ledger is authoritative |
| Funder | Never loses more than the face value; gets the remainder back after expiry | — |
| Funder, if the spending key is stolen | Loss ≤ the remaining face value of certificates bound to that key, at those payees only | — |
| Spender (agent or person) | Can't be charged more than the highest total it signed; retries never add charges; network failures never raise what it owes | Durable outbox; request-id idempotency |
| Everyone | Funds go only to the payee named at issuance | — |

## Not guaranteed

- That the seller delivers what you paid for.
- That a note reaches the seller (if it doesn't, the seller simply doesn't serve).
- That the seller collects before the end date (its SDK does this automatically).
- That the USDC issuer never freezes funds.
- That the code is bug-free: it is **unaudited** software, invariant-tested, running on test networks only.

## At a shop counter

- **Accepted (GUARANTEED):** the till read this certificate on the blockchain earlier, and the note passes the seller checks against the till's own ledger. This holds if the till's ledger is authoritative (one till, or synced devices within per-device floats), its clock is roughly right, and the shop collects before the end date.
- **Accepted at your own risk: not checked yet:** offline, a budget (certificate) the till has never checked. **Not a Flying Money guarantee.** Someone could present a made-up certificate. It is the shop's own credit decision, capped by its first-visit limit, and re-checked when the till reconnects.

## Control: what a funder can and can't do

| The funder can | The funder can't |
|---|---|
| Choose exactly where money can be spent | Freeze or cancel a certificate before expiry |
| Choose how much, and top up | Lower a limit after issuing |
| Choose how long, and extend | Block one purchase at an allowed place |
| Not renew | See purchases before the shop collects |

There is no freeze button on purpose: a shop can accept a note instantly, even offline, only because the money can't be pulled back.

## Privacy

Payments are public on the blockchain but not linked to names. The spending address is random and holds nothing; names and labels never leave your device. We don't claim anonymity: flows between addresses are public.

## What we left out, and why

Some features sound useful but can’t be made safe with software alone. Paying strangers offline is one: without a connection, nothing stops the same money being shown to two people at once, short of an online authority, trusted hardware or an identity system. So Flying Money doesn’t offer it, and it doesn’t offer shared spending pools, passing a budget along, or bundled settlement either. It only offers what the math guarantees.
