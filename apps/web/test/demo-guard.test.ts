import { memoryLock, memoryRateLimiter } from '@flying-money/server'
import { describe, expect, it } from 'vitest'
import {
  admitDemoRun,
  admitSlip,
  DEMO_DAILY_CAP,
  demoGuardFromEnv,
  inspectCounter,
  inspectDemoRun,
  SLIP_DAILY_CAP,
} from '../lib/demo-guard'

const FACE = 300_000n
const req = (ip: string, origin: string | null = 'https://site.test') =>
  new Request('https://site.test/api/demo/run', {
    method: 'POST',
    headers: { 'x-real-ip': ip, ...(origin ? { origin } : {}) },
  })

// Audit F9 (D28): the demo's limits are shared by every serverless instance, and a stranger's page can't start runs.
describe('demo guard', () => {
  it('refuses cross-site requests (no Origin, or another origin)', async () => {
    const deps = { lock: memoryLock(), limits: memoryRateLimiter() }
    expect(await admitDemoRun(req('1.1.1.1', null), deps, FACE)).toMatchObject({ ok: false, status: 403 })
    expect(await admitDemoRun(req('1.1.1.1', 'https://evil.test'), deps, FACE)).toMatchObject({
      ok: false,
      status: 403,
    })
  })

  it('one run at a time across instances, one run per visitor per 2 minutes', async () => {
    const deps = { lock: memoryLock(), limits: memoryRateLimiter() }
    const first = await admitDemoRun(req('1.1.1.1'), deps, FACE)
    expect(first.ok).toBe(true)
    // a second visitor while the first run holds the lock: busy, and it doesn't use up their per-visitor slot
    expect(await admitDemoRun(req('2.2.2.2'), deps, FACE)).toMatchObject({ ok: false, status: 429 })
    if (first.ok) await first.release()
    expect((await admitDemoRun(req('2.2.2.2'), deps, FACE)).ok).toBe(true)
  })

  it('the same visitor again within 2 minutes is refused', async () => {
    const deps = { lock: memoryLock(), limits: memoryRateLimiter() }
    const a = await admitDemoRun(req('3.3.3.3'), deps, FACE)
    if (a.ok) await a.release()
    expect(await admitDemoRun(req('3.3.3.3'), deps, FACE)).toMatchObject({ ok: false, status: 429 })
  })

  it('a daily cap bounds the testnet USDC the demo can lock, whatever the number of visitors', async () => {
    const deps = { lock: memoryLock(), limits: memoryRateLimiter() }
    const runs = Number(DEMO_DAILY_CAP / FACE)
    for (let i = 0; i < runs; i++) {
      const r = await admitDemoRun(req(`10.0.0.${i}`), deps, FACE)
      expect(r.ok).toBe(true)
      if (r.ok) await r.release()
    }
    expect(await admitDemoRun(req('10.0.1.1'), deps, FACE)).toMatchObject({ ok: false, status: 429 })
  })

  it('on Vercel without a shared store the demo refuses to run; locally it falls back to memory', () => {
    expect(demoGuardFromEnv({ VERCEL: '1' })).toBeNull()
    expect(demoGuardFromEnv({})).not.toBeNull()
    expect(
      demoGuardFromEnv({ VERCEL: '1', KV_REST_API_URL: 'https://kv.example', KV_REST_API_TOKEN: 't' }),
    ).not.toBeNull()
  })
})

it('availability reads do not consume allowances and report busy, cooldown and exhaustion', async () => {
  const deps = { lock: memoryLock(), limits: memoryRateLimiter() }
  const request = req('availability-visitor')
  for (let i = 0; i < 5; i++) expect(await inspectDemoRun(request, deps, FACE)).toMatchObject({ available: true })
  const run = await admitDemoRun(request, deps, FACE)
  expect(run.ok).toBe(true)
  expect(await inspectDemoRun(req('other'), deps, FACE)).toMatchObject({ reason: 'busy' })
  if (run.ok) await run.release()
  expect(await inspectDemoRun(request, deps, FACE)).toMatchObject({ reason: 'cooldown' })
  await deps.limits.spend(
    'demo-usdc',
    new Date().toISOString().slice(0, 10),
    DEMO_DAILY_CAP - FACE,
    DEMO_DAILY_CAP,
    86400,
  )
  expect(await inspectDemoRun(req('other'), deps, FACE)).toMatchObject({ reason: 'exhausted' })
})

it('counter availability is read-only and reports its own funding lock and limits', async () => {
  const deps = { lock: memoryLock(), limits: memoryRateLimiter() }
  const request = req('counter-availability')
  const face = 150_000n
  for (let i = 0; i < 3; i++)
    expect(await inspectCounter(request, deps, face, 'anvil')).toMatchObject({ available: true })
  const token = await deps.lock.acquire('slip:anvil', 60000)
  expect(await inspectCounter(request, deps, face, 'anvil')).toMatchObject({ reason: 'busy' })
  await deps.lock.release('slip:anvil', token!)
  expect(await admitSlip(request, deps, face, 'counter')).toMatchObject({ ok: true })
  expect(await inspectCounter(request, deps, face, 'anvil')).toMatchObject({ reason: 'cooldown' })
  await deps.limits.spend(
    'slip-usdc',
    new Date().toISOString().slice(0, 10),
    SLIP_DAILY_CAP - face,
    SLIP_DAILY_CAP,
    86400,
  )
  expect(await inspectCounter(req('another-counter-visitor'), deps, face, 'anvil')).toMatchObject({
    reason: 'exhausted',
  })
})
