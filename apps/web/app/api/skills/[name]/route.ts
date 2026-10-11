import { allSkills, getSkill } from '@/lib/skills'

export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return allSkills().map((s) => ({ name: s.name }))
}

/** /.well-known/skills/<name>/SKILL.md (rewritten here). */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const s = getSkill(name)
  if (!s) return new Response('not found', { status: 404 })
  return new Response(s.raw, { headers: { 'content-type': 'text/markdown; charset=utf-8' } })
}
