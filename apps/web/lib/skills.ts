import 'server-only'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Agent skills (the SKILL.md format used by Claude and other agent platforms): one folder per skill under /skills at the
 * repo root, each with a SKILL.md whose front matter names it and says when to use it. They install with
 * `npx skills add https://github.com/raldblox/flying-money --skill <name>`, and are served here for agents that read the web.
 */
const dir = join(process.cwd(), '..', '..', 'skills')

export interface Skill {
  name: string
  description: string
  /** the whole file, front matter included */
  raw: string
}

export function allSkills(): Skill[] {
  let names: string[]
  try {
    names = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
  } catch {
    return []
  }
  const out: Skill[] = []
  for (const n of names) {
    let raw: string
    try {
      raw = readFileSync(join(dir, n, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n')
    } catch {
      continue
    }
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(raw)?.[1] ?? ''
    // simple "key: value" lines (YAML); a value may be double-quoted
    const field = (k: string) => {
      const line = fm.split('\n').find((l) => l.startsWith(`${k}:`))
      const v = line ? line.slice(k.length + 1).trim() : ''
      return v.length > 1 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).split('\\"').join('"') : v
    }
    out.push({ name: field('name') || n, description: field('description'), raw })
  }
  return out
}

export const getSkill = (name: string) => allSkills().find((s) => s.name === name)
