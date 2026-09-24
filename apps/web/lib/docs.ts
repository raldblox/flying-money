import 'server-only'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The docs (§10.7): one Markdown source per page in docs/site/*.md. Rendered at /docs/<slug>, served raw at
 * /docs/<slug>.md, and concatenated into /llms-full.txt. Read at build time (all docs routes are static).
 */
export const DOCS = [
  { slug: 'agents', group: 'Start' },
  { slug: 'shops', group: 'Start' },
  { slug: 'protocol', group: 'Reference' },
  { slug: 'contract', group: 'Reference' },
  { slug: 'client', group: 'Reference' },
  { slug: 'server', group: 'Reference' },
  { slug: 'mcp', group: 'Reference' },
  { slug: 'guarantees', group: 'About' },
  { slug: 'faq', group: 'About' },
  { slug: 'story', group: 'About' },
] as const
export type DocSlug = (typeof DOCS)[number]['slug']

const dir = join(process.cwd(), '..', '..', 'docs', 'site')

export interface Doc {
  slug: DocSlug
  group: string
  title: string
  description: string
  /** Markdown without the front matter. */
  body: string
}

export function getDoc(slug: string): Doc | null {
  const meta = DOCS.find((d) => d.slug === slug)
  if (!meta) return null
  let raw: string
  try {
    raw = readFileSync(join(dir, `${slug}.md`), 'utf8').replace(/\r\n/g, '\n')
  } catch {
    return null
  }
  const m = /^---\n([\s\S]*?)\n---\n/.exec(raw)
  const fm = Object.fromEntries(
    (m?.[1] ?? '')
      .split('\n')
      .map((l) => /^(\w+):\s*(.*)$/.exec(l))
      .filter((x): x is RegExpExecArray => x !== null)
      .map((x) => [x[1]!, x[2]!.replace(/^"(.*)"$/, '$1')]),
  )
  return {
    slug: meta.slug,
    group: meta.group,
    title: fm.title ?? slug,
    description: fm.description ?? '',
    body: m ? raw.slice(m[0].length) : raw,
  }
}

export const allDocs = () => DOCS.map((d) => getDoc(d.slug)).filter((d): d is Doc => d !== null)
