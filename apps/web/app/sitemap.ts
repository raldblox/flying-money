import type { MetadataRoute } from 'next'
import { DOCS } from '@/lib/docs'
import { SITE } from '@/lib/site'

/**
 * The public pages, and the entry points written for AI agents: /agent.md (setup), /llms.txt (index) and
 * /llms-full.txt (every docs page in one file), plus each docs page as rendered HTML and as raw Markdown.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const u = (path: string) => `${SITE.url}${path}`
  const pages = [
    '/',
    '/start',
    '/demo',
    '/demo/counter',
    '/demo/slip',
    '/how-it-works',
    '/guarantees',
    '/story',
    '/shops',
    '/chains',
    '/networks',
    '/mainnet',
    '/testnet',
    '/bridge',
  ]
  const agent = ['/agent.md', '/llms.txt', '/llms-full.txt', '/skill.md', '/.well-known/skills/index.json']
  const docs = DOCS.flatMap((d) => [`/docs/${d.slug}`, `/docs/${d.slug}.md`])
  return [...pages, ...agent, '/docs', ...docs].map((p) => ({ url: u(p) }))
}
