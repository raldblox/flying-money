---
title: FAQ
description: x402, payment channels, chains, bridges, tokens, freezing, privacy and offline payments.
---

# FAQ

**Is this x402?**
It uses HTTP 402, but it's a *prefunded tab*: one settlement for many requests, instead of a payment per request. It could become a scheme alongside x402. We don't claim compatibility yet.

**Why not payment channels?**
It is a one-way channel in spirit. The differences: anyone can redeem, the spending key is separate from the funder, there is no close negotiation, and it comes as an HTTP-native SDK for agents.

**Which chain?**
All of them. The same contract and protocol run on Arbitrum, Monad, Arc and Base, each with that chain's Circle USDC and caps. Arc lets sellers operate with USDC only (it is also the gas token). Adding a chain is one registry entry. See [Deployments](/chains).

**Do certificates move between chains?**
No, and nothing is bridged. A seller can accept notes on several chains; each chain settles independently. No bridge risk.

**Where's the token?**
There isn't one, by design. Everything settles in USDC.

**Can a parent freeze a certificate?**
No, and that's deliberate. A shop's instant, offline guarantee depends on the money not being pulled back. Control happens through where, how much and how long, and by not renewing.

**Does the kid need a wallet?**
No. A link or QR code plus a PIN. The money goes from the parent into the contract and then to the shop. It never touches the kid.

**Is it private?**
Names never go on-chain, and people get fresh random spending addresses. But flows between addresses are public. We don't claim anonymity.

**Does it work offline?**
Notes can be signed and verified without a connection, and a shop's till keeps accepting certificates it has already checked. We don't offer offline payments between strangers, because that can't be guaranteed without an online authority, trusted hardware or an identity system. A budget the till has never seen, while offline, is shown as **Accepted at your own risk: not checked yet**.

**What are the fees?**
None from Flying Money. The seller pays gas when collecting (one transaction for many payments); on Arc, gas is paid in USDC.

**Is it audited?**
No. It is invariant-tested and runs on testnets and small, capped mainnet deployments. An audit comes before any caps are lifted.
