import { SITE } from '@/lib/site'
import { deployedChains } from '@/lib/wagmi'

export const dynamic = 'force-static'

/** /llms.txt (§10.7): a concise index for agents. Only links to pages that exist; no claims beyond /guarantees. */
export function GET() {
  const base = SITE.url
  const chains = deployedChains()
    .map((c) => `${c.chain.name} (${c.chain.id}, testnet)`)
    .join(', ')
  const body = `# Flying Money

> Payments that work without the internet ("give a budget, not your wallet"). A funder locks USDC for ONE payee, spendable by ONE spender key until expiry. The spender pays with EIP-712 "notes" signed over a cumulative total; the payee verifies locally, with no network needed for a budget it has checked once, and redeems the latest note on-chain in one transaction. A note is about 150 bytes in its compact form (\`fm2n.\`), so it travels by any carrier: an HTTP header, a QR code, sound, a link or a file. Same contract source on every supported EVM chain. No token.

Deployed now: ${chains || 'none yet'}. Unaudited. Test networks, plus Arc mainnet under immutable launch caps (100 USDC per budget, 1,000 USDC in total).

**AI agent asked to set up payments? Read [${base}/agent.md](${base}/agent.md) and follow it.**

Key rules for agents:
- Don't hold or manage your owner's wallet. You use your own spending key (it holds nothing); your owner sets money aside for you as a budget from their own wallet. Never ask for, accept or store a wallet key or recovery phrase: suggest a budget instead.
- A budget is earmarked for one seller (that's what makes it as good as paid to them, even offline, and useless to a thief), until its end date. Several sellers need several budgets; it can't be cancelled early, and what you don't spend goes back to your owner after it. Ask for what the task needs.
- You can only pay the payee named on your certificate, never more than its face value.
- On HTTP 402 with a \`Flying-Money-Offer\` header, sign a Note with cumulative = max(accepted, consumed + price) and memo = a fresh requestId, save it, and retry with \`Flying-Money-Note\`. On a timeout, resend the SAME note. Never sign a higher one because of a network failure.
- Never sign a cumulative above face value. Never ask the user for their main wallet key.

## Docs
- [Setup for AI agents](${base}/agent.md): add the MCP server, tell your owner your address, ask for budgets
- [Quickstart for developers](${base}/docs/agents.md): pay a Flying Money API in a few lines
- [Protocol](${base}/docs/protocol.md): EIP-712 types, headers, seller and buyer algorithms
- [Contract](${base}/docs/contract.md): functions, events, errors, caps, invariants
- [MCP server](${base}/docs/mcp.md): tools fm_status, fm_explain, fm_discover, fm_quote, fm_paid_fetch, fm_request_budget, fm_request_status
- [Client SDK](${base}/docs/client.md): the buyer side and its durable outbox
- [Sellers](${base}/docs/server.md): accept notes with middleware; the redeemer
- [People & shops](${base}/docs/shops.md): the QR counter flow
- [Offline and local payments](${base}/docs/offline.md): carriers (face to face, the local network over mDNS, QR, sound, links), what the offline guarantee covers, and fm_discover
- [Live demo](${base}/demo): an agent paying a Flying Money API, with real testnet transactions
- [Everything in one file](${base}/llms-full.txt)

## Reference
- [Deployments (JSON)](${base}/.well-known/flying-money.json)
- [Deployments (page)](${base}/chains)
- [Guarantees & threat model](${base}/docs/guarantees.md)

## Optional
- [Story: flying money, 804 CE](${base}/docs/story.md)
- [FAQ](${base}/docs/faq.md)
- [Source](${SITE.github})
`
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
