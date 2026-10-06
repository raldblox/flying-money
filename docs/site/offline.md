---
title: Offline and local payments
description: Pay with no internet. A slip travels by QR code, sound, a link or the shop's own Wi-Fi; the seller checks it on the spot and collects later.
---

# Payments that work without the internet

A Flying Money payment is a **slip**: about 150 bytes, signed by the payer's key, good at one seller, up to a budget
that is already set aside for that seller. Nothing about a slip needs the internet. It needs a way to get from the
payer to the seller, and the seller needs to have seen the budget once.

That makes Flying Money a payment network for places the internet doesn't reach reliably: a canteen in a basement, a
market stall, a festival, a ship, a factory floor, a robot's charging dock, a laptop running a local model.

## How it works offline

1. **Once, while online:** the seller checks the budget (it reads it from the chain and remembers it). The payer holds
   the budget's own key; the money stays locked for that seller until the end date.
2. **Offline, every payment:** the payer signs a slip with the new running total and hands it over by any carrier.
   The seller checks the signature and the total against its own records, on the spot, and serves.
3. **Back online:** the seller collects everything in one transaction.

**Guaranteed:** a slip for a budget the seller has checked is backed by money that can't be pulled back before the end
date and can only go to that seller. **Not guaranteed:** a budget the seller has never seen, accepted offline; that's
the seller's own risk, capped by its first-visit limit and its offline float. The seller must come back online and
collect before the end date. See [Guarantees](/docs/guarantees).

## Carriers

Every carrier ends in the same checks. A slip is about 150 characters in its compact form (190 with its order), a price
code about 80, a till's receipt about 260; small carriers send them as numbered frames. The exact formats are in the
[protocol](/docs/protocol) ("Carriers").

| Carrier | Works today | Best for |
|---|---|---|
| **Face to face** (two-way QR) | Yes | A phone at a till: each screen shows a code and reads the other's with the camera on its screen side. Price, slip and receipt cross by themselves; the buyer only enters a PIN |
| **QR code** (one way) | Yes | Any camera; printed price codes |
| **Sound / ultrasound** | Yes | Two devices in a quiet room; ultrasound for machines |
| **Share sheet** (AirDrop, Quick Share) | Yes | Phone to phone, with no internet |
| **Link, file, copy and paste** | Yes | Anything else |
| **Local network** (mDNS) | Yes | Shops and offices with their own Wi-Fi; agents and devices on the same network |
| **HTTP 402 / x402, MCP** | Yes | APIs and AI agents |
| Bluetooth LE, NFC, MQTT, ROS 2, LoRa | Next | Robots, vending machines, sensors, drones: the formats fit, each needs only its adapter |

At a till, the phone and the till pick the same carrier (the choice is remembered on each device), and each has its
own flow: face to face and QR read codes with the camera, sound and ultrasound play and listen in turns until the
other side answers, and the by-hand carriers send and receive a link, a file or text.

### Permissions

- **Camera** (face to face, QR): to read the other screen's code. Frames are read on the device, never uploaded.
- **Microphone** (sound, ultrasound): to hear the other device's chirps. Nothing is recorded or sent.
- The site explains each one and waits for a tap before the browser asks. **It never asks for local-network
  access:** browsers can't announce or find sellers on a network; discovery runs in Node (the MCP server, the SDK,
  or a seller on a computer).

## Shops with Wi-Fi: the local network

A seller on a shop's Wi-Fi can **announce itself**, the way a printer does, with no internet and no registry. Anything
on the same network (an agent on a laptop, a phone, a device) finds it, checks its prices, and pays it with slips.
Discovery is DNS-SD over multicast DNS as `_flying-money._tcp`; the announcement is small (the seller's path, its
payee and networks), and the full price list comes from the seller's `/.well-known/flying-money.json`.

Announce a seller (Node):

```ts
import { getChain } from '@flying-money/chains'
import { announceSeller } from '@flying-money/server'

const announcement = announceSeller({
  name: 'Corner Tea Shop',
  port: 8787, // where your seller listens
  path: '/v1', // where its paid API lives
  payee: process.env.PAYEE_ADDRESS as `0x${string}`,
  chainIds: [getChain('arbitrum-sepolia').chain.id, getChain('base-sepolia').chain.id],
})
// on shutdown: await announcement.stop()
```

Find sellers (Node, or any agent through MCP with `fm_discover`):

```ts
import { discoverSellers } from '@flying-money/client/discover'

for (const s of await discoverSellers({ seconds: 3 })) console.log(s.name, s.url, s.chainIds)
```

Try it with the demo seller: run `pnpm dev` in the repository (it announces the Oracle on your Wi-Fi), then

```bash
FM_OWNER=0xYourWallet FM_ALLOW_LAN=1 npx -y @flying-money/mcp call fm_discover
```

**What the network needs:**

- **Devices can see each other.** A shop's own Wi-Fi usually allows it. Many guest and public networks turn on
  "client isolation" (each device sees only the internet): there, run the seller on the shop's own network or use
  face to face at the till instead.
- **No VPN in the way.** A VPN on the laptop or phone may block local traffic unless its "allow LAN" (local network
  access) setting is on.
- **An agent only pays local sellers it found, or that you allow.** By default the MCP server pays only public
  services; a seller found with `fm_discover` becomes payable for that session, and `FM_ALLOW_LAN=1` allows the local
  network for one-shot commands. Never link-local addresses.

An announcement is a claim, not a proof: the agent checks the seller's offer, and pays only from a budget made for that
seller (its payee), so a fake announcer can't be paid.

## Try it

- **[The offline counter](/demo/counter):** your phone in airplane mode pays a till, face to face; the till accepts
  it as guaranteed and collects when it's back online.
- **[The slip that pays](/demo/slip):** carry a real slip between two devices by QR, sound, share, link or file.
- **Local network:** `pnpm dev`, then `fm_discover` (above).
