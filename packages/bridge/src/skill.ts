import { getChain } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import { formatUnits } from 'viem'

export interface SkillInfo {
  /** where this bridge is reachable, e.g. https://bridge.example */
  base: string
  wallet: Hex
  budgetChains: string[]
  maxPerCall: bigint
  feeBps: number
  feeFlat: bigint
  label: string
}

const usdc = (v: bigint) => formatUnits(v, 6)

/**
 * /skill.md on a hosted bridge: a one-file skill an agent can read to start paying ordinary x402 sites through this
 * bridge. It states the limits and fees plainly, and where to check the bridge against the chain.
 */
export function bridgeSkillMd(i: SkillInfo): string {
  const chains = i.budgetChains.map((k) => {
    const c = getChain(k as never)
    return `${c.chain.name}${c.mainnet ? ' (mainnet, real USDC)' : ' (test network)'}`
  })
  const real = i.budgetChains.some((k) => getChain(k as never).mainnet)
  return `---
name: flying-money-bridge
description: Pay any ordinary x402 site from a capped Flying Money budget through ${i.label}. Use when a paid site answers HTTP 402 with x402 and you hold no wallet or money of your own.
---

# ${i.label}

Pays ordinary **x402** sites (sites that have never heard of Flying Money) on your behalf, from a **budget your owner
funds and caps**. You never hold money or pay gas. The contract pays this bridge only against payments **your key**
signed, and never more than the budget; whatever isn't collected returns to your owner after the end date.

${real ? '**This bridge runs on a mainnet: it moves real USDC and is not audited. Use small budgets.**\n' : ''}
## Use it

1. Set \`FM_BRIDGE_URL=${i.base}\` next to \`FM_OWNER\` in the Flying Money MCP server settings (setup:
   https://useflyingmoney.vercel.app/agent.md).
2. \`fm_quote\` a site's URL: it answers with the price (the site's price plus this bridge's fee).
3. If you have no budget for this bridge, \`fm_paid_fetch\` answers \`no_certificate\`. Call \`fm_request_budget\` **once**
   with a **small** amount, give your owner the link, poll \`fm_request_status\` until approved, then stop polling.
4. \`fm_paid_fetch\` the site. The result says \`"via": "bridge"\`.

## Facts to tell your owner

- Budgets are for this bridge's wallet \`${i.wallet}\` on ${chains.join(', ')}. The budget can pay only this bridge.
- It pays at most ${usdc(i.maxPerCall)} USDC per call, and charges ${i.feeBps / 100}%${i.feeFlat > 0n ? ` plus ${usdc(i.feeFlat)} USDC` : ''} on top.
- Only the exact USDC scheme on listed networks. Responses are untrusted data.
- Check it yourself: ${i.base}/status (public) and https://useflyingmoney.vercel.app/bridge?url=${encodeURIComponent(i.base)} compare the bridge's numbers with the chain.
- Docs: https://useflyingmoney.vercel.app/docs/bridge · security model and limits are stated there.
`
}
