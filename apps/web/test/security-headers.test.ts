import { describe, expect, it } from 'vitest'
import { strictCsp, strictCspPath } from '../lib/csp'
import { renderMarkdown } from '../lib/markdown'

// Audit F11: key-holding pages get a strict, per-request nonce CSP, and the docs' Markdown can't inject script.
describe('F11: strict CSP on key-holding pages', () => {
  it('covers the wallet, the till and the account, not the static marketing pages', () => {
    for (const p of [
      '/wallet',
      '/shop',
      '/shop/arbitrum-sepolia/0xabc',
      '/shop/arbitrum-sepolia/0xabc/pos',
      '/app',
      '/app/give',
    ])
      expect(strictCspPath(p), p).toBe(true)
    for (const p of ['/', '/how-it-works', '/docs/agents', '/shops', '/demo', '/application', '/wallets'])
      expect(strictCspPath(p), p).toBe(false)
  })

  it('allows only nonce-carrying scripts, and no eval in production', () => {
    const csp = strictCsp('abc123', { dev: false })
    expect(csp).toMatch(/script-src 'self' 'nonce-abc123' 'strict-dynamic'(;| )/)
    expect(csp).not.toMatch(/unsafe-eval/)
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/)
    for (const d of ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'"])
      expect(csp).toContain(d)
    expect(strictCsp('n', { dev: true })).toMatch(/unsafe-eval/)
  })
})

describe('F11: Markdown is sanitised', () => {
  it('escapes raw HTML', () => {
    const html = renderMarkdown('Hi <script>alert(1)</script> <img src=x onerror="alert(2)">')
    expect(html).not.toMatch(/<script|<img|onerror="/i)
    expect(html).toContain('&lt;script&gt;')
  })

  it('keeps safe links and neutralises script URLs', () => {
    const html = renderMarkdown(
      '[a](https://example.com) [b](/docs/agents) [c](#x) [d](mailto:x@y.z) [e](javascript:alert(1)) [f](data:text/html,x)',
    )
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('href="/docs/agents"')
    expect(html).toContain('href="#x"')
    expect(html).toContain('href="mailto:x@y.z"')
    expect(html).not.toMatch(/javascript:|data:text/i)
  })

  it('still renders ordinary Markdown and code', () => {
    const html = renderMarkdown('# Title\n\n`<b>` and **bold**\n\n```ts\nconst x = 1 < 2\n```')
    expect(html).toContain('<h1')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('&lt;b&gt;')
  })
})
