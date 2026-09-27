// §21.4.2: public minimal status for anyone holding the (unguessable) request id; the full request only for its owner.
import { getInbox, inboxErrorResponse, sessionOwner } from '@/lib/inbox-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    if (new URL(req.url).searchParams.get('full') === '1') {
      const owner = await sessionOwner(req)
      return Response.json(await getInbox().get(owner, id), { headers: { 'cache-control': 'no-store' } })
    }
    const s = await getInbox().status(id)
    if (!s) return Response.json({ error: 'not-found' }, { status: 404 })
    return Response.json(s, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return inboxErrorResponse(e)
  }
}
