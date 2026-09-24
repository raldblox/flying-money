import { memoryLock, memoryRateLimiter } from '@flying-money/server'
import { describe, expect, it } from 'vitest'
import { admitDemoRun, DEMO_DAILY_CAP, demoGuardFromEnv } from '../lib/demo-guard'

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
