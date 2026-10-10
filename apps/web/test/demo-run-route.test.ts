import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  tasks: [] as Array<() => Promise<void>>,
  runs: vi.fn(),
  release: vi.fn(),
  admit: vi.fn(),
  inspect: vi.fn(),
  balance: vi.fn(),
}))
vi.mock('next/server', () => ({ after: (task: () => Promise<void>) => mocks.tasks.push(task) }))
vi.mock('@flying-money/agent', () => ({
  keyFromEnv: () => ({ address: '0x1111111111111111111111111111111111111111' }),
  runLiveDemo: mocks.runs,
}))
vi.mock('viem', () => ({
  erc20Abi: [],
  http: vi.fn(),
  createPublicClient: () => ({ readContract: mocks.balance, getBalance: mocks.balance }),
}))
vi.mock('../lib/demo-guard', () => ({
  demoGuardFromEnv: () => ({}),
  admitDemoRun: mocks.admit,
  inspectDemoRun: mocks.inspect,
}))

import { GET, POST } from '../app/api/demo/run/route'

beforeEach(() => {
  mocks.tasks.length = 0
  vi.clearAllMocks()
  for (const name of ['DEMO_FUNDER_KEY', 'DEMO_AGENT_KEY', 'REDEEMER_KEY', 'PAYEE_ADDRESS'])
    vi.stubEnv(name, 'configured-for-mocked-test')
  vi.stubEnv('VERCEL', '')
  for (const name of [
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'REDIS_URL',
  ])
    vi.stubEnv(name, '')
  mocks.balance.mockResolvedValue(300_000n)
  mocks.admit.mockResolvedValue({ ok: true, release: mocks.release })
  mocks.release.mockResolvedValue(undefined)
  mocks.inspect.mockResolvedValue({ available: true, reason: 'ready' })
})
const post = (id: string) =>
  new Request('https://site.test/api/demo/run', {
    method: 'POST',
    headers: { origin: 'https://site.test', 'content-type': 'application/json' },
    body: JSON.stringify({ runId: id, chain: 'arbitrum-sepolia' }),
  })
const get = (id: string) => GET(new Request(`https://site.test/api/demo/run?runId=${id}`))
describe('recoverable run route', () => {
  it('returns before execution, persists background results, and treats repeated approval IDs idempotently', async () => {
    const id = crypto.randomUUID()
    mocks.runs.mockImplementation(async ({ onEvent }) => {
      onEvent({ type: 'step', text: 'buying' })
      onEvent({ type: 'error', message: 'test ended' })
    })
    expect((await POST(post(id))).status).toBe(202)
    expect(mocks.runs).not.toHaveBeenCalled()
    expect((await (await get(id)).json()).status).toBe('running')
    await mocks.tasks[0]!()
    const recovered = await (await get(id)).json()
    expect(recovered.status).toBe('error')
    expect(recovered.events.map((e: { type: string }) => e.type)).toEqual(['start', 'step', 'error'])
    await POST(post(id))
    expect(mocks.tasks).toHaveLength(1)
    expect(mocks.admit).toHaveBeenCalledTimes(1)
    expect(mocks.runs).toHaveBeenCalledTimes(1)
    expect(mocks.release).toHaveBeenCalledTimes(1)
  })
  it('checks availability without admitting a run or funding anything', async () => {
    mocks.inspect.mockResolvedValue({ available: false, reason: 'busy', message: 'Another run is active' })
    const response = await GET(new Request('https://site.test/api/demo/run?chain=arbitrum-sepolia'))
    expect(await response.json()).toMatchObject({ available: false, reason: 'busy' })
    expect(mocks.admit).not.toHaveBeenCalled()
    expect(mocks.runs).not.toHaveBeenCalled()
  })
  it('rejects malformed IDs and does not expose other run records', async () => {
    expect((await POST(post('invalid'))).status).toBe(400)
    expect((await get(crypto.randomUUID())).status).toBe(404)
    expect(mocks.admit).not.toHaveBeenCalled()
  })
})
