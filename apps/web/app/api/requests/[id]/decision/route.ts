// §21.4.2: the owner's decision. "Approved" only after the relay checks the funding transaction on-chain (R2); no agent
// path can reach this (R3: owner session only).
import { getInbox, inboxErrorResponse, sameOrigin, sessionOwner } from '@/lib/inbox-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(req)
    const owner = await sessionOwner(req)
    const { id } = await ctx.params
    const body = await req.json().catch(() => null)
    const rec = await getInbox().decide(owner, id, body ?? {})
    return Response.json({ status: rec.status, certificateId: rec.certificateId, decidedAt: rec.decidedAt })
  } catch (e) {
    return inboxErrorResponse(e)
  }
}
