---
title: FAQ
description: x402, payment channels, chains, bridges, tokens, freezing, privacy and offline payments.
---

# FAQ

**Is this x402?**
It works with x402 in two ways. Sellers can list Flying Money as an x402 scheme (`x402: true`), and an agent can pay *any* ordinary x402 site from a capped budget through a bridge you run yourself. A Flying Money note is not an x402 batch voucher, and we don't claim to be one; it is a prefunded budget that can't be cancelled early. Both paths are prototypes on test networks. See [x402](/docs/x402).

**Can my agent pay normal x402 sites?**
Yes, through your own bridge: set `FM_BRIDGE_URL`, and `fm_paid_fetch` pays the site from a budget made for the bridge. The agent holds no money and pays no gas, and the budget is the cap. See [Pay any x402 site](/docs/bridge).

**Is the x402 bridge a cross-chain bridge?**
No. It bridges *protocols*, not chains: it pays an x402 site on the network the site names, from its own float on that network.

**Why not payment channels?**
It is a one-way channel in spirit. The differences: anyone can redeem, the spending key is separate from the funder, there is no close negotiation, and it comes as an HTTP-native SDK for agents.

**Which chain?**
Any EVM chain. Today the same contract runs on the Arbitrum, Base, Ethereum, Monad and Tempo test networks, and on Arc mainnet under immutable caps (100 USDC per budget, 1,000 USDC in total), with that chain's USDC (OUSD on Tempo testnet). On Tempo and Arc, even gas is paid in stablecoins. Adding a chain is one registry entry. See [Deployments](/chains).

**Do certificates move between chains?**
No, and no funds are bridged between chains. A seller can accept notes on several chains; each chain settles independently. No cross-chain bridge risk. (The [x402 bridge](/docs/bridge) is a different thing: a payer-side service for paying ordinary x402 sites.)

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
No. It is invariant-tested and runs on test networks, plus Arc mainnet under immutable caps (100 USDC per budget, 1,000 USDC in total), so a bug can only ever touch a small amount. An independent audit comes before any real-money launch.
