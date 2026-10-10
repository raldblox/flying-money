import { afterEach, expect, it, vi } from 'vitest'

vi.mock('../lib/demo-guard', () => ({ demoGuardFromEnv: () => ({}), admitSlip: async () => ({ ok: true }) }))
vi.mock('../lib/demo-fund', () => ({
  FundError: class extends Error {
    status = 502
  },
  fundDemoBudget: vi.fn(),
}))

import { POST } from '../app/api/demo/counter/route'
import { fundDemoBudget } from '../lib/demo-fund'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})

it('preserves an issued shop budget when the separate tips funding fails', async () => {
  vi.stubEnv('DEMO_SLIP_FUNDER_KEY', 'test-only-mocked-funder')
  vi.stubEnv('PAYEE_ADDRESS', `0x${'12'.repeat(20)}`)
  vi.mocked(fundDemoBudget)
    .mockResolvedValueOnce({ id: `0x${'ab'.repeat(32)}`, tx: `0x${'cd'.repeat(32)}`, expiresAt: 2000000000n })
    .mockRejectedValueOnce(new Error('tips funding unavailable'))
  const response = await POST(
    new Request('http://localhost/api/demo/counter', {
      method: 'POST',
      body: JSON.stringify({ chain: 'arbitrum-sepolia' }),
    }),
  )
  expect(response.ok).toBe(true)
  const result = await response.json()
  expect(result.budgets).toHaveLength(1)
  expect(result.budgets[0].role).toBe('shop')
  expect(result.note).toContain('tips')
  expect(response.headers.get('cache-control')).toBe('no-store')
})
