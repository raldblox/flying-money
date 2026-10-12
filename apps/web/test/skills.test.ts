import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// Skills follow the SKILL.md format: a folder per skill, front matter with a matching name and a description that says
// when to use it, and nothing in them may ask for or reveal a key.
const root = join(import.meta.dirname, '..', '..', '..', 'skills')

describe('agent skills', () => {
  const names = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
  it('has the three skills', () => {
    expect(names.sort()).toEqual(['flying-money', 'flying-money-owner', 'flying-money-x402'])
  })
  for (const n of names) {
    it(`${n}: front matter names the skill, says when to use it, and stays safe`, () => {
      const raw = readFileSync(join(root, n, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n')
      const fm = /^---\n([\s\S]*?)\n---\n/.exec(raw)?.[1] ?? ''
      expect(/^name:\s*(.+)$/m.exec(fm)?.[1]?.trim()).toBe(n)
      const rawDescription = (fm.split('\n').find((l) => l.startsWith('description:')) ?? '').slice(12).trim()
      // the front matter is YAML: a description with a colon must be quoted, or strict parsers (the skills CLI) drop the skill
      expect(rawDescription.startsWith('"') && rawDescription.endsWith('"')).toBe(true)
      const description = rawDescription.slice(1, -1)
      expect(description.length).toBeGreaterThan(40)
      expect(description.length).toBeLessThanOrEqual(1024)
      expect(description).toMatch(/\bUse when\b/i)
      expect(raw).not.toMatch(/0x[0-9a-fA-F]{64}\b/) // never a key or a 32-byte value pasted in
      expect(raw).not.toMatch(/private key.*(paste|send|share)/i)
    })
  }
  it('the routes serve the main skill and a discovery index', async () => {
    const { GET: skillMd } = await import('@/app/skill.md/route')
    const res = skillMd()
    expect(res.headers.get('content-type')).toMatch(/markdown/)
    expect(await res.text()).toMatch(/^---\nname: flying-money\n/)
    const { GET: index } = await import('@/app/api/skills/route')
    const j = (await index().json()) as { skills: Array<{ name: string; url: string }>; install: string }
    expect(j.skills.map((s) => s.name)).toEqual(['flying-money', 'flying-money-owner', 'flying-money-x402'])
    for (const sk of j.skills as unknown as Array<{ description: string }>)
      expect(sk.description.length).toBeGreaterThan(40)
    expect(j.skills[0]?.url).toMatch(/\/\.well-known\/skills\/flying-money\/SKILL\.md$/)
    expect(j.install).toMatch(/npx skills add .* --skill/)
  })
})
