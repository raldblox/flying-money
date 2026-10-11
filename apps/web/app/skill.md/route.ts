import { getSkill } from '@/lib/skills'

export const dynamic = 'force-static'

/** /skill.md: the main onboarding skill, for agents that look for a skill file at the site root. */
export function GET() {
  const s = getSkill('flying-money')
  if (!s) return new Response('not found', { status: 404 })
  return new Response(s.raw, { headers: { 'content-type': 'text/markdown; charset=utf-8' } })
}
