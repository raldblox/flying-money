import { type ChainConfig, getChainById } from '@flying-money/chains'
import { decodeSpendRequest, type SignedSpendRequest, verifySpendRequest } from '@flying-money/core'

/** Budget requests are kept 7 days (§21.4.2); an older link is shown as expired. */
export const REQUEST_TTL_SECONDS = 7 * 86_400

export type ParsedRequest =
  | { ok: true; signed: SignedSpendRequest; chain: ChainConfig; expired: boolean }
  | { ok: false; error: string }

/**
 * Reads a budget request from a link's fragment (`#fm1.…`, never sent to a server, §21.4.2). Strict: the request must
 * parse, be signed by its requester (so nothing in it was changed), and name a chain Flying Money is deployed on.
 */
export function readRequestFromHash(hash: string, now = Math.floor(Date.now() / 1000)): ParsedRequest {
  const value = decodeURIComponent(hash.replace(/^#/, '').trim())
  if (!value) return { ok: false, error: 'This link has no request in it.' }
  let signed: SignedSpendRequest
  try {
    signed = decodeSpendRequest(value)
  } catch {
    return { ok: false, error: 'This request is damaged or incomplete. Ask your agent for a new link.' }
  }
  if (!verifySpendRequest(signed))
    return {
      ok: false,
      error: 'This request was changed after your agent signed it. Don’t fund it; ask your agent for a new link.',
    }
  const chain = getChainById(signed.chainId)
  if (!chain?.flyingMoney) return { ok: false, error: 'This request is for a network Flying Money isn’t on.' }
  return { ok: true, signed, chain, expired: now > Number(signed.request.createdAt) + REQUEST_TTL_SECONDS }
}
