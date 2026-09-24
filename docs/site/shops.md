---
title: People & shops
description: Tabs, allowances and gifts. The customer pays at the counter by showing a QR code; the till works offline.
---

# People & shops

Flying Money is for anyone who spends on your behalf, not only agents. A parent, an employer or a friend locks a budget **for one place**; the holder pays by showing a QR code. The holder needs no crypto wallet and pays no fees. Only the giver needs USDC, and whatever isn't spent returns to the giver after the end date.

## Examples

- **Regulars' tabs:** 20 USDC at the café you visit every morning.
- **Allowances:** lunch money that only works at the school canteen.
- **Teams:** fuel money for a field worker, at one station.
- **Gifts:** a gift for one shop, sent as a link.

## For the giver

1. Open the [Counting House](/app), choose the shop's address, generate a spending key in the browser, set the amount and the end date, and issue.
2. Tap **Give it to someone** and send the link or QR privately. The spending key travels only in the link's `#fragment`, which browsers never send to a server.

**What you can and can't control:** you choose where, how much and how long; you can top up, extend or simply not renew. You **can't** freeze or cancel a certificate early, and that is deliberate: a shop can accept a payment instantly, even offline, only because the money can't be pulled back.

## For the holder: the wallet (`/wallet`)

- Open the link, choose a PIN. The key is stored on this phone only, encrypted with your PIN.
- To pay: tap **Pay**, scan the till's price code, check "Pay 3.50 USDC to Lantern Café, remaining after: 16.50", enter your PIN, and show your code.
- After the till says **Accepted**, tap *Yes, the shop accepted it*. Until you do, the wallet shows the same code again and won't start another payment.
- Add the wallet to your home screen and export a backup. Browsers may clear data for sites you don't install.

A lost phone never loses money: the giver gets the remainder back after the end date. A leaked key can only spend what's left, at that one shop.

## For the shop: the till (`/shop`)

Open a till with your shop's name and address. Keep it on one device.

| Status | When | What it means |
|---|---|---|
| **Accepted** (guaranteed) | The till has checked this certificate on the blockchain before, and the payment passes | Backed by money set aside for your shop until the end date. Collect before then |
| **Unverified · merchant risk** | Offline, and this till has never seen this certificate | Not a guarantee. Your own risk, capped by your first-visit limit (default 5 USDC). Checked when you reconnect |
| **Rejected** | Wrong shop, not enough left, expired, bad signature | Don't hand over the goods |

**Collect** sends one transaction that collects everything accepted so far. Anyone may send it; the money only goes to your shop's address.

Privacy: payments are public on the blockchain but not linked to names. Anyone can see that some address paid a café, but not who.
