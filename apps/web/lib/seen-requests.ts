import type { Hex } from '@flying-money/core'
import { idbKV } from './idb'

/**
 * Budget requests opened on this device (§21.4 link channel): the link itself carries the signed request, so this is
 * only a local list for the Requests tab. Nothing is sent anywhere.
 */
export interface SeenRequest {
  requestId: Hex
  link: string
  chain: string
  requester: Hex
  payee: Hex
  amount: string
  days: number
  reason: string
  seenAt: number
  status: 'waiting' | 'funded' | 'declined'
  certificateId?: Hex
}

const db = () => idbKV('fm-requests')

export async function listSeenRequests(): Promise<SeenRequest[]> {
  const kv = db()
  const out: SeenRequest[] = []
  for (const k of await kv.keys('req:')) {
    const v = await kv.get(k)
    if (v) out.push(JSON.parse(v) as SeenRequest)
  }
  return out.sort((a, b) => b.seenAt - a.seenAt)
}

export async function rememberRequest(r: Omit<SeenRequest, 'seenAt' | 'status'>): Promise<void> {
  const kv = db()
  const key = `req:${r.requestId.toLowerCase()}`
  const prev = await kv.get(key)
  if (prev) return
  await kv.set(key, JSON.stringify({ ...r, seenAt: Date.now(), status: 'waiting' } satisfies SeenRequest))
}

export async function markRequest(requestId: Hex, status: SeenRequest['status'], certificateId?: Hex) {
  const kv = db()
  const key = `req:${requestId.toLowerCase()}`
  const prev = await kv.get(key)
  if (!prev) return
  await kv.set(
    key,
    JSON.stringify({ ...(JSON.parse(prev) as SeenRequest), status, ...(certificateId ? { certificateId } : {}) }),
  )
}
