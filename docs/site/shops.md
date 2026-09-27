---
title: People & shops
description: Tabs, allowances and gifts. The customer pays at the counter by showing a QR code; the till works offline.
---

# People & shops

Flying Money is for anyone who spends on your behalf, not only agents. A parent, an employer or a friend locks a budget **for one place**; the holder pays by showing a QR code. The holder needs no crypto wallet and pays no fees. Only the giver needs USDC. After the end date, the giver can take back whatever wasn't spent.

## Examples

- **Regulars' tabs:** 20 USDC at the café you visit every morning.
- **Allowances:** lunch money that only works at the school canteen.
- **Teams:** fuel money for a field worker, at one station.
- **Gifts:** a gift for one shop, sent as a link.

## For the giver

1. Open [Give a budget](/app/give?for=person), choose the shop (or open the shop's own "get a budget for this shop" link), set the amount and the end date, and give it.
2. Tap **Give it to someone** and send the link or QR privately. The spending key travels only in the link's `#fragment`, which browsers never send to a server.

**What you can and can't control:** you choose where, how much and how long; you can top up, extend or simply not renew. You **can't** freeze or cancel a budget early, and that is deliberate: a shop can accept a payment instantly, even offline, only because the money can't be pulled back.

## For the holder: the wallet (`/wallet`)

- Open the link, choose a PIN. The key is stored on this phone only, encrypted with your PIN.
- To pay: tap **Pay**, scan the till's price code, check "Pay 3.50 USDC to Lantern Café, remaining after: 16.50", enter your PIN, and show your code.
- After the till says **Accepted**, tap *Yes, the shop accepted it*. Until you do, the wallet shows the same code again and won't start another payment.
- Add the wallet to your home screen and export a backup. Browsers may clear data for sites you don't install.

A lost phone never loses money: the giver can take back what's left after the end date. A leaked key can only spend what's left, at that one shop.

## For the shop: the till (`/shop`)

Open a till in three steps: your shop's name, the wallet that receives sales, done. The till is remembered on that device under **Your tills**. The ready screen also gives you a **get a budget for this shop** link and QR to share with regulars and their families: it opens the gift form with your shop filled in, marked unchecked until they confirm your address with you.

| Status | When | What it means |
|---|---|---|
| **Accepted: covered by a checked budget** | The till has checked this budget on the blockchain before, and the payment passes | Backed by money set aside for your shop until the end date. Collect before then |
| **Accepted at your own risk: not checked yet** | Offline, and this till has never seen this budget | Not covered. Your own risk, capped by your first-visit limit (default 5 USDC). Checked when you reconnect |
| **Rejected** | Wrong shop, not enough left, expired, bad signature | Don't hand over the goods |

**Collect** sends one transaction that collects everything accepted so far. Anyone may send it; the money only goes to your shop's address.

Privacy: payments are public on the blockchain but not linked to names. Anyone can see that some address paid a café, but not who.
