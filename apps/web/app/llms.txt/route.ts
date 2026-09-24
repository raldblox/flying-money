import { SITE } from '@/lib/site'
import { deployedChains } from '@/lib/wagmi'

export const dynamic = 'force-static'

/** /llms.txt (§10.7): a concise index for agents. Only links to pages that exist; no claims beyond /guarantees. */
export function GET() {
  const base = SITE.url
  const chains = deployedChains()
    .map((c) => `${c.chain.name} (${c.chain.id}${c.mainnet ? ', mainnet, capped' : ', testnet'})`)
    .join(', ')
  const body = `# Flying Money

> Sealed spending certificates for AI agents, people and devices. A funder locks USDC for ONE payee, spendable by ONE spender key until expiry. The spender pays with EIP-712 "notes" signed over a cumulative total; the payee verifies locally and redeems the latest note on-chain in one transaction. Same contract source on every supported EVM chain. No token.

Deployed now: ${chains || 'none yet'}. Unaudited; testnets plus capped mainnets.

Key rules for agents:
- You can only pay the payee named on your certificate, never more than its face value.
- On HTTP 402 with a \`Flying-Money-Offer\` header, sign a Note with cumulative = max(accepted, consumed + price) and memo = a fresh requestId, save it, and retry with \`Flying-Money-Note\`. On a timeout, resend the SAME note. Never sign a higher one because of a network failure.
- Never sign a cumulative above face value. Never ask the user for their main wallet key.

## Docs
- [Quickstart for agents](${base}/docs/agents.md): pay a Flying Money API in a few lines
- [Protocol](${base}/docs/protocol.md): EIP-712 types, headers, seller and buyer algorithms
- [Contract](${base}/docs/contract.md): functions, events, errors, caps, invariants
- [Client SDK](${base}/docs/client.md): the buyer side and its durable outbox
- [Sellers](${base}/docs/server.md): accept notes with middleware; the redeemer
- [People & shops](${base}/docs/shops.md): the QR counter flow
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
