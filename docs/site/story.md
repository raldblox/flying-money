---
title: The story of flying money
description: How Tang-dynasty merchants stopped carrying coins in 804 CE, and why AI agents need the same idea.
---

# Flying money, 804 CE

## Chang'an, 804

In the early ninth century the Tang dynasty ran short of copper coin: a tax reform that accepted part of the taxes in money raised demand for cash, and coin was scarce from 805 to 820. Carrying strings of coin between the regions and the capital was a burden for merchants.

By 804, merchants were using a better way. They entrusted their money to the representative offices of their local governments (and to armies, commissioners and wealthy families) and carried a certificate instead. When the tallies were matched at an office, they could withdraw their money; at the capital the exchange fee was 100 *wén* per 1,000. Tea merchants, trading between the capital and the regions, benefited most.

People called it **飛錢**, *feiqian*: "flying money". The value travelled; the coins stayed put. The government was wary at first, but in 812 flying cash was officially accepted as a means of exchange.

## What made it work

- **Deposit before travel** (prefunded): the money existed before anyone spent it.
- **A certificate tied to one place of redemption** (scoped): it paid out in one place, and nowhere else.
- **Tallies that must match** (verifiable): a certificate paid out only when it matched its counterpart.
- **Value moved, coins stayed** (deferred settlement): many journeys, one settlement.

## Twelve centuries later

AI agents are the new merchants, and APIs are the new cities. Agents buy data, compute and API calls thousands of times a day, for fractions of a cent. Giving them a card is reckless, paying on-chain per request is too slow and too costly, and sellers can't trust an anonymous agent's promise to pay later.

## Flying Money today

| 804 CE | Flying Money |
|---|---|
| Coin deposited at an office | USDC locked in the contract |
| The certificate | The certificate (one payee, one spending key, an end date) |
| Matching tallies | The spender's signature, checked against the record on the blockchain |
| The redemption office | The contract, which pays only the named payee |
| Many trips, one payout | Many signed notes, one transaction |

Sources: [Wikipedia, "Flying cash"](https://en.wikipedia.org/wiki/Flying_cash) · [Britannica, "Feiqian"](https://www.britannica.com/topic/feiqian)
