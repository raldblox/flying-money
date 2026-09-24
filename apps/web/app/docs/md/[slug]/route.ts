import { allDocs, getDoc } from '@/lib/docs'

export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return allDocs().map((d) => ({ slug: d.slug }))
}

/** /docs/<slug>.md (rewritten here): the raw Markdown twin of a docs page (§10.7). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const doc = getDoc((await params).slug)
  if (!doc) return new Response('Not found', { status: 404 })
  return new Response(doc.body, { headers: { 'content-type': 'text/markdown; charset=utf-8' } })
}
