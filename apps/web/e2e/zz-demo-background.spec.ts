import { expect, test } from '@playwright/test'

test('the real background route survives its response and recovers one local-chain execution', async ({ request }) => {
  const availability = await request.get('/api/demo/run?chain=anvil')
  expect(await availability.json()).toMatchObject({ available: true })
  const runId = crypto.randomUUID()
  const payload = { data: { runId, chain: 'anvil' }, headers: { origin: 'http://localhost:3200' } }
  const started = await request.post('/api/demo/run', payload)
  expect(started.status()).toBe(202)
  expect(await started.json()).toEqual({ runId })
  // The POST response is finished. Subsequent requests recover the same background work.
  const repeated = await request.post('/api/demo/run', payload)
  expect(await repeated.json()).toEqual({ runId })
  await expect
    .poll(async () => (await (await request.get(`/api/demo/run?runId=${runId}`)).json()).status, {
      timeout: 150_000,
      intervals: [1000, 2000],
    })
    .toBe('done')
  const record = await (await request.get(`/api/demo/run?runId=${runId}`)).json()
  expect(record.events.filter((e: { type: string }) => e.type === 'issued')).toHaveLength(1)
  expect(
    record.events.some(
      (e: { type: string; body?: { kind: string } }) =>
        e.type === 'answer' && e.body?.kind === 'flying-money-certificate',
    ),
  ).toBe(true)
  expect(record.events.some((e: { type: string }) => e.type === 'redeemed')).toBe(true)
})
