import { describe, expect, it } from 'vitest'
import { GET } from '@/app/llms.txt/route'

// /llms.txt is what an agent reads first: it must say Flying Money works with x402, and link the pages.
describe('/llms.txt and x402', () => {
  it('names both x402 paths, links the x402 and bridge docs, and stays honest about the status', async () => {
    const body = await GET().text()
    expect(body).toMatch(/\*\*x402:\*\*/)
    expect(body).toContain('/docs/x402.md')
    expect(body).toContain('/docs/bridge.md')
    expect(body).toContain('FM_BRIDGE_URL')
    expect(body).toMatch(/prototypes, test networks/)
  })
})
