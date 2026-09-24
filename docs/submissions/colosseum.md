# Submission: Colosseum Crypto World’s Fair

> Internal material (BUILD_SPEC §21.2). Not deployed, not linked from the site, not in llms files.
> Public pages are keyed by chain: `/chains/base-sepolia`, `/chains/base`.

| | |
|---|---|
| Event | Colosseum Crypto World’s Fair |
| Kind | EVM track (Base) and the general pool |
| Deadline | 12 Oct 2026 |
| Chains | base-sepolia, base |
| Track / framing | EVM track: agent payments |
| Lead door | Agents (SDK + MCP), Shop mode second |

## Pitch line

Give your AI agent a sealed certificate, not your wallet.

## Why it fits

- Agents pay per request over HTTP 402 with signed notes; the seller checks them locally in milliseconds.
- Claude and any MCP agent can pay through four tools, inside a budget it cannot raise.
- The budget is enforced by the certificate, not the prompt: a stolen key can only pay the named seller.
- The same certificates work at a shop counter, by QR, even offline.
- Invariant-tested contract; unaudited; mainnet exposure bounded by immutable caps.

## Checklist (§16.1)

- [ ] Public repo with clean history, MIT, README (§14.3)
- [ ] Contract verified on this event's chain(s); addresses in the README and `/chains`
- [ ] Live site with working `/demo` and `/app` (link with `?chain=`)
- [ ] 2-minute video (unlisted)
- [ ] Deck PDF (10 slides)
- [ ] `docs/SECURITY.md`
- [ ] Contact on `/pitch`
- [ ] "Built during the event" statement: the rebuild started 23 Sep 2026
