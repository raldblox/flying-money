/**
 * What a wallet or node error actually says, in plain words. Wallets bury the reason: MetaMask wraps it as
 * "Internal JSON-RPC error" with the real message in `data`, and viem nests it a few causes deep. Show that reason;
 * never guess at a cause we can't see.
 */
const GENERIC = /^(internal json-rpc error\.?|execution reverted\.?|an unknown rpc error occurred\.?|unknown error)$/i

function reasons(e: unknown): string[] {
  const out: string[] = []
  const seen = new Set<unknown>()
  let cur: unknown = e
  while (cur && typeof cur === 'object' && !seen.has(cur)) {
    seen.add(cur)
    const o = cur as {
      details?: unknown
      shortMessage?: unknown
      message?: unknown
      reason?: unknown
      data?: { message?: unknown; originalError?: { message?: unknown } }
      cause?: unknown
    }
    for (const v of [o.data?.originalError?.message, o.data?.message, o.reason, o.details, o.shortMessage, o.message])
      if (typeof v === 'string' && v.trim()) out.push(v.trim().split('\n')[0]!.trim())
    cur = o.cause
  }
  return out
}

export function txErrorMessage(e: unknown): string {
  const all = reasons(e)
  const text = all.join(' | ')
  if (/user rejected|user denied|rejected the request|denied transaction/i.test(text))
    return 'You rejected the request in your wallet.'
  if (/does not match the target chain|chain mismatch|wrong network/i.test(text))
    return 'Your wallet is on another network. Switch it to the network shown on this page, then try again.'
  if (/insufficient funds/i.test(text)) return 'Your wallet doesn’t have enough ETH for gas on this network.'
  if (/nonce too low|nonce has already been used|already known/i.test(text))
    return `Your wallet already sent a transaction with this number (${pick(all)}). Wait for it to confirm, or check your wallet’s activity, then try again.`
  if (/exceeds allowance|insufficient allowance/i.test(text))
    return 'The USDC approval hasn’t reached the network yet. Wait a few seconds and try again.'
  if (/transfer amount exceeds balance/i.test(text)) return 'Your wallet doesn’t hold enough USDC for this amount.'
  const best = pick(all)
  if (!best || /reverted with the following reason:\s*$/i.test(best))
    return 'The transaction was refused on-chain without a reason. Nothing was sent. Try again; if it repeats, reload the page.'
  return best
}

/** the most specific message: the deepest one that isn't a generic wrapper */
function pick(all: string[]): string {
  const specific = all.filter((m) => !GENERIC.test(m) && !/reverted with the following reason:\s*$/i.test(m))
  return specific.at(-1) ?? all.at(-1) ?? ''
}
