// §21.4.2 relay inbox: agents POST a request with the owner's grant; the signed-in owner lists its requests.
import { getInbox, inboxErrorResponse, sessionOwner } from '@/lib/inbox-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const text = await req.text()
    if (text.length > 8192) return Response.json({ error: 'too-large' }, { status: 413 })
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      return Response.json({ error: 'bad-request' }, { status: 400 })
    }
    return Response.json(await getInbox().submit(body), { status: 201 })
  } catch (e) {
    return inboxErrorResponse(e)
  }
}

export async function GET(req: Request) {
  try {
    const owner = await sessionOwner(req)
    const asked = new URL(req.url).searchParams.get('owner')
    if (asked && asked.toLowerCase() !== owner) return Response.json({ error: 'not-your-inbox' }, { status: 403 })
    const requests = await getInbox().list(owner)
    return Response.json({ owner, requests }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return inboxErrorResponse(e)
  }
}
