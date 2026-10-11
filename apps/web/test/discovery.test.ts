import { describe, expect, it, vi } from 'vitest'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'

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
})
