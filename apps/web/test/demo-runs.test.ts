import { redisFromEnv } from '@flying-money/server'
import { describe, expect, it } from 'vitest'
import { memoryDemoRuns, redisDemoRuns } from '../lib/demo-runs'

describe('recoverable demo records', () => {
  it('claims a run once, preserves ordered events across readers, and never restarts it', async () => {
    const store = memoryDemoRuns()
    const id = crypto.randomUUID()
    expect(await store.create(id)).toBe(true)
    expect(await store.create(id)).toBe(false)
    await store.append(id, { type: 'step', text: 'purchase one' })
    await store.append(id, { type: 'error', message: 'chain unavailable' })
    const recovered = await store.read(id)
    expect(recovered?.events.map((e) => e.type)).toEqual(['step', 'error'])
    expect(recovered?.status).toBe('error')
    expect(await store.create(id)).toBe(false)
    expect(await store.read(crypto.randomUUID())).toBeNull()
  })
  it('marks a silent expired execution uncertain, preserving evidence without claiming completion', async () => {
    let now = 1
    const store = memoryDemoRuns(() => now)
    const id = crypto.randomUUID()
    await store.create(id)
    await store.append(id, { type: 'step', text: 'funding' })
    now += 301_000
    expect(await store.read(id)).toMatchObject({ status: 'interrupted', events: [{ type: 'step', text: 'funding' }] })
  })
})

const connection = redisFromEnv(process.env)
it.skipIf(!connection)(
  'Redis records are shared across instances and duplicate creation is atomic',
  async () => {
    const prefix = `fm:test:demo-recovery:${crypto.randomUUID()}:`
    const one = redisDemoRuns(connection!.redis, prefix)
    const two = redisDemoRuns(connection!.redis, prefix)
    const id = crypto.randomUUID()
    try {
      expect((await Promise.all([one.create(id), two.create(id)])).filter(Boolean)).toHaveLength(1)
      await one.append(id, { type: 'step', text: 'Saved by first instance' })
      await two.append(id, { type: 'error', message: 'Saved by second instance' })
      expect(await two.read(id)).toMatchObject({ status: 'error', events: [{ type: 'step' }, { type: 'error' }] })
      expect(
        Number(await connection!.redis.eval("return redis.call('TTL', KEYS[1])", [`${prefix}demo-run:${id}`], [])),
      ).toBeGreaterThan(0)
    } finally {
      await connection!.redis.eval("return redis.call('DEL', KEYS[1])", [`${prefix}demo-run:${id}`], [])
    }
  },
  30_000,
)
