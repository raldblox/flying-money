import { certKey, NOTE_HEADER } from '@flying-money/core'
import { Hono } from 'hono'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import { flyingMoney } from '../src/hono.js'
import { memoryStore, requestHash } from '../src/index.js'
import { CHAIN_ID, Clock, FakeChain, note, payee } from './fixtures.js'

function app(opts: { maxStoredResponseBytes?: number; slow?: Promise<void> } = {}) {
  const chain = new FakeChain()
  const clock = new Clock()
  const spenderKey = generatePrivateKey()
  const cert = chain.issue({
    faceValue: 1_000n,
    expiresAt: BigInt(clock.t) + 7n * 86_400n,
    spender: privateKeyToAccount(spenderKey).address,
  })
  const store = memoryStore()
  const runs: string[] = []
  const a = new Hono()
  a.use(
    '/v1/*',
    flyingMoney({
      accepts: ['anvil'],
      payee: payee.address,
      store,
      readCertificate: chain.reader,
      now: clock.now,
      price: () => 10n,
      ...(opts.maxStoredResponseBytes !== undefined ? { maxStoredResponseBytes: opts.maxStoredResponseBytes } : {}),
    }),
  )
  a.get('/v1/:name', async (c) => {
    runs.push(c.req.url.replace('http://x', ''))
    if (opts.slow && c.req.param('name') === 'slow') await opts.slow
    return c.text(`result for ${c.req.url}`.padEnd(200, '.'))
  })
  const get = (path: string, header: string) => a.request(`http://x${path}`, { headers: { [NOTE_HEADER]: header } })
  return { get, runs, cert, spenderKey, store, key: certKey(CHAIN_ID, cert.id) }
}

describe('hono middleware: F1 (D32) request binding', () => {
  it('a served note replayed on another route or query is refused (409) and the handler never runs', async () => {
    const { get, runs, cert, spenderKey, store, key } = app({ maxStoredResponseBytes: 10 }) // nothing stored
    const n = await note(spenderKey, cert.id, 10n)
    expect((await get('/v1/expensive?q=0', n.header)).status).toBe(200)
    for (let i = 1; i <= 5; i++) expect((await get(`/v1/expensive?q=${i}`, n.header)).status).toBe(409)
    expect((await get('/v1/other', n.header)).status).toBe(409)
    expect(runs).toEqual(['/v1/expensive?q=0'])
    // the identical request may replay (idempotent re-run of the same request, no new charge)
    expect((await get('/v1/expensive?q=0', n.header)).status).toBe(200)
    expect(await store.state(key)).toMatchObject({ consumed: 10n, reserved: 0n })
  })

  it('while PENDING, replays on other routes are refused instead of resuming', async () => {
    let release!: () => void
    const slow = new Promise<void>((r) => {
      release = r
    })
    const { get, runs, cert, spenderKey } = app({ slow })
    const n = await note(spenderKey, cert.id, 10n)
    const first = get('/v1/slow', n.header)
    await new Promise((r) => setTimeout(r, 20))
    for (let i = 0; i < 5; i++) expect((await get(`/v1/free-ride-${i}`, n.header)).status).toBe(409)
    release()
    expect((await first).status).toBe(200)
    expect(runs).toEqual(['/v1/slow'])
  })

  it('requestHash is canonical: query order does not matter; method, path, query and body do', async () => {
    const h = (m: string, u: string, body = '') => requestHash(m, new URL(u), new TextEncoder().encode(body))
    expect(h('GET', 'http://x/a?b=2&a=1')).toBe(h('GET', 'http://y/a?a=1&b=2'))
    expect(h('GET', 'http://x/a?a=1')).not.toBe(h('GET', 'http://x/a?a=2'))
    expect(h('GET', 'http://x/a')).not.toBe(h('POST', 'http://x/a'))
    expect(h('POST', 'http://x/a', '{"n":1}')).not.toBe(h('POST', 'http://x/a', '{"n":2}'))
    expect(h('GET', 'http://x/a')).not.toBe(h('GET', 'http://x/b'))
  })
})
