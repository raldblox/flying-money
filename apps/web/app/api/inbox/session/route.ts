// §21.4.2 owner session: the owner signs InboxAccess (valid 10 minutes), exchanged for an HttpOnly cookie for 24 h.
import { getInbox, inboxErrorResponse, sameOrigin, sessionCookie, sessionOwner } from '@/lib/inbox-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    sameOrigin(req)
    const body = await req.json().catch(() => null)
    const token = await getInbox().openSession(body)
    const owner = await getInbox().owner(token)
    return Response.json({ owner }, { headers: { 'set-cookie': sessionCookie(token, 86_400) } })
  } catch (e) {
    return inboxErrorResponse(e)
  }
}

/** Who is signed in (for the account screens), or 401. */
export async function GET(req: Request) {
  try {
    return Response.json({ owner: await sessionOwner(req) }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return inboxErrorResponse(e)
  }
}

export async function DELETE() {
  return Response.json({ signedOut: true }, { headers: { 'set-cookie': sessionCookie('', 0) } })
}
