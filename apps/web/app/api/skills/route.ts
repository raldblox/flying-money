import { SITE } from '@/lib/site'
import { allSkills } from '@/lib/skills'

export const dynamic = 'force-static'

/** /.well-known/skills/index.json (rewritten here): every skill, where to read it, and how to install it. */
export function GET() {
  return Response.json({
    skills: allSkills().map((s) => ({
      name: s.name,
      description: s.description,
      type: 'skill-md',
      url: `${SITE.url}/.well-known/skills/${s.name}/SKILL.md`,
    })),
    install: `npx skills add ${SITE.github} --skill <name>`,
    source: `${SITE.github}/tree/main/skills`,
  })
}
