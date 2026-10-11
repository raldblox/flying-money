import { describe, expect, it, vi } from 'vitest'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
import nextConfig from '../next.config'

vi.mock('server-only', () => ({}))

// What a crawler or an AI agent finds first: robots.txt points at the sitemap, and the sitemap lists the agent entry
// points and the x402 pages.
describe('discovery for crawlers and agents', () => {
  it('robots allows the site, keeps the API out, and names the sitemap', () => {
    const r = robots()
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/)
    expect(JSON.stringify(r.rules)).toContain('/api/')
  })
  it('the sitemap lists agent.md, llms.txt, llms-full.txt and the x402 docs in both forms', () => {
    const urls = sitemap().map((e) => e.url)
    for (const p of ['/agent.md', '/llms.txt', '/llms-full.txt', '/docs/x402', '/docs/x402.md', '/docs/bridge.md'])
      expect(
        urls.some((u) => u.endsWith(p)),
        p,
      ).toBe(true)
  })

  it('every docs page is reachable as raw Markdown (the rewrite pattern accepts every slug, digits included)', async () => {
    const { DOCS } = await import('@/lib/docs')
    const rules = (await (nextConfig as { rewrites?: () => Promise<Array<{ source: string }>> }).rewrites?.()) ?? []
    const rule = rules.find((r) => r.source.startsWith('/docs/:slug'))
    expect(rule).toBeTruthy()
    const re = new RegExp(`^${(rule as { source: string }).source.replace(/:slug(\(.*?\))/, '$1')}$`)
    for (const d of DOCS) expect(re.test(`/docs/${d.slug}.md`), d.slug).toBe(true)
  })
})
