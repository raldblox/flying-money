'use client'
import type { ChainConfig } from '@flying-money/chains'
import {
  encodeRequestGrant,
  grantTypedData,
  type Hex,
  inboxAccessTypedData,
  newRequestId,
  type RequestGrant,
  type SignedSpendRequest,
  spendRequestFromParts,
  verifySpendRequest,
} from '@flying-money/core'
import type { WalletClient } from 'viem'

/**
 * The browser side of the request inbox (§21.4.2): sign in with a wallet signature (no transaction), list and open
 * requests, post decisions, create and revoke grants. The session is an HttpOnly cookie the page never sees.
 */
export interface InboxItem {
  requestId: Hex
  chainId: number
  request: Record<string, string>
  sig: Hex
  owner: Hex
  requester: Hex
  payee: Hex
  status: 'asked' | 'approved' | 'declined' | 'expired'
  expiresAt: number
  certificateId?: Hex
  decidedAt?: number
  note?: string
}

export class InboxSignInNeeded extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  // never cached: a 401 from before sign-in must not be replayed afterwards
  const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init })
  if (res.status === 401) throw new InboxSignInNeeded('sign in to your inbox')
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string }
  if (!res.ok) throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`)
  return body
}

/** Who is signed in to the inbox on this browser, if anyone. */
export async function inboxOwner(): Promise<Hex | null> {
  try {
    return (await call<{ owner: Hex }>('/api/inbox/session')).owner
  } catch {
    return null
  }
}

/** Signs InboxAccess with the wallet (free, no transaction) and opens a 24-hour session. */
export async function signInToInbox(wallet: WalletClient, chain: ChainConfig, owner: Hex): Promise<Hex> {
  const issuedAt = BigInt(Math.floor(Date.now() / 1000))
  const sig = await wallet.signTypedData({ account: owner, ...inboxAccessTypedData(chain.chain.id, owner, issuedAt) })
  const r = await call<{ owner: Hex }>('/api/inbox/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chainId: String(chain.chain.id), owner, issuedAt: issuedAt.toString(), sig }),
  })
  window.dispatchEvent(new Event('fm-inbox'))
  return r.owner
}

export async function signOutOfInbox() {
  await fetch('/api/inbox/session', { method: 'DELETE', credentials: 'same-origin' })
  window.dispatchEvent(new Event('fm-inbox'))
}

export const listInbox = async () => (await call<{ owner: Hex; requests: InboxItem[] }>('/api/requests')).requests

export const getInboxItem = (id: string) => call<InboxItem>(`/api/requests/${id}?full=1`)

/** The stored request, checked again here: parsed strictly and signed by its requester. */
export function signedFromInbox(it: InboxItem): SignedSpendRequest | null {
  try {
    const s = spendRequestFromParts(String(it.chainId), it.request, it.sig)
    return verifySpendRequest(s) ? s : null
  } catch {
    return null
  }
}

export async function decideInbox(
  id: string,
  d: { approved: { certificateId: Hex; txHash: Hex } } | { declined: { note?: string } },
) {
  const r = await call<{ status: string }>(`/api/requests/${id}/decision`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(d),
  })
  window.dispatchEvent(new Event('fm-inbox'))
  return r
}

/** The owner signs "I accept budget requests from this key" (free, no transaction); returns the FM_OWNER_GRANT value. */
export async function createGrant(
  wallet: WalletClient,
  chain: ChainConfig,
  owner: Hex,
  requester: Hex,
  maxAmountPerRequest: bigint,
  days: number,
): Promise<{ value: string; grant: RequestGrant }> {
  const grant: RequestGrant = {
    owner,
    requester,
    maxAmountPerRequest,
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + Math.round(days * 86_400)),
    grantId: newRequestId(),
  }
  const sig = await wallet.signTypedData({ account: owner, ...grantTypedData(chain.chain.id, grant) })
  return { value: encodeRequestGrant({ grant, chainId: chain.chain.id, sig }), grant }
}

export const revokeGrant = (grantId: Hex) => call<{ revoked: Hex }>(`/api/grants/${grantId}/revoke`, { method: 'POST' })
