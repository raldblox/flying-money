import { ioredisEval } from '@flying-money/server'
import RedisMock from 'ioredis-mock'
import { describe, expect, it } from 'vitest'
import { redisLedger, redisOutcomes } from '../src/index.js'

// The hosted bridge keeps its replay records and activity log in Redis, so any serverless instance sees the same state.
const redis = () => ioredisEval(new RedisMock())

describe('redis outcomes', () => {
  it('replays what a request returned, from any instance, case-insensitively', async () => {
    const r = redis()
    const a = redisOutcomes(r, 't:')
    const b = redisOutcomes(r, 't:') // another instance, same Redis
    expect(await b.get('0xABC')).toBeUndefined()
    await a.set('0xABC', { status: 200, type: 'application/json', text: '{"ok":true}', settle: 'abc' })
    expect(await b.get('0xabc')).toEqual({ status: 200, type: 'application/json', text: '{"ok":true}', settle: 'abc' })
  })
  it('does not store a response larger than the cap', async () => {
    const o = redisOutcomes(redis(), 't:')
    await o.set('0x01', { status: 200, type: null, text: 'x'.repeat(300_000), settle: null })
    expect(await o.get('0x01')).toBeUndefined()
  })
})

describe('redis ledger', () => {
  it('keeps totals (including wei-sized sums) and the recent log, newest first, shared across instances', async () => {
    const r = redis()
    const a = redisLedger(r, 't:', () => 1_000)
    const b = redisLedger(r, 't:', () => 2_000)
    await a.add({
      at: 1,
      kind: 'paid',
      host: 'x.test',
      network: 'eip155:8453',
      amount: '1000',
      price: '1200',
      tx: '0x1',
    })
    await b.add({ at: 2, kind: 'failed', host: 'y.test', amount: '1000' })
    await a.add({ at: 3, kind: 'collected', network: 'eip155:8453', amount: '1200', tx: '0x2', gas: '486304738218' })
    await b.add({ at: 4, kind: 'collected', amount: '500', gas: '9007199254740993' }) // above 2^53
    const t = await b.totals()
    expect(t).toMatchObject({ paid: 1, failed: 1, spent: 1000n, charged: 1200n, collected: 1700n, collections: 2 })
    expect(t.gas).toBe(486304738218n + 9007199254740993n)
    const recent = await a.recent(3)
    expect(recent.map((e) => e.at)).toEqual([4, 3, 2])
    expect(recent[1]).toMatchObject({ kind: 'collected', tx: '0x2' })
  })
})
