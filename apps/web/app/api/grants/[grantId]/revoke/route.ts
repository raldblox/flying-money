// §21.4.2: the owner revokes a grant; the relay then refuses every request carrying it.
import { getInbox, inboxErrorResponse, sameOrigin, sessionOwner } from '@/lib/inbox-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ grantId: string }> }) {
  try {
    sameOrigin(req)
    const owner = await sessionOwner(req)
    const { grantId } = await ctx.params
    await getInbox().revoke(owner, grantId)
    return Response.json({ revoked: grantId })
  } catch (e) {
    return inboxErrorResponse(e)
  }
}
