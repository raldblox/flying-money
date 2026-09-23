import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getChain, setLocalDeployment } from '@flying-money/chains'
import { type Certificate, certificateId, certKey, type Hex } from '@flying-money/core'
import { createIdempotency, memoryStore as sellerMemoryStore } from '@flying-money/server'
import { flyingMoney } from '@flying-money/server/hono'
import { Hono } from 'hono'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { afterAll, describe, expect, it } from 'vitest'
import {
  type ClientStore,
  createFlyingMoneyClient,
  fileStore,
  memoryStore,
  NoCertificateError,
  PriceTooHighError,
} from '../src/index.js'

const CONTRACT: Hex = '0x00000000000000000000000000000000000f1f1f'
setLocalDeployment({ usdc: '0x00000000000000000000000000000000000c0c0c', flyingMoney: CONTRACT })
const CHAIN_ID = getChain('anvil').chain.id
const DAY = 86_400n

class CrashError extends Error {}

function world(opts: { face: bigint; failRate?: number; price?: () => bigint }) {
  const payee = privateKeyToAccount(generatePrivateKey())
  const spenderKey = generatePrivateKey()
  const funder = privateKeyToAccount(generatePrivateKey()).address
  const id = certificateId(CHAIN_ID, CONTRACT, funder, 0n)
  const cert: Certificate = {
    id,
    funder,
    payee: payee.address,
    spender: privateKeyToAccount(spenderKey).address,
    faceValue: opts.face,
    redeemed: 0n,
    expiresAt: BigInt(Math.floor(Date.now() / 1000)) + 7n * DAY,
    closed: false,
  }
  const reader = async (_c: number, _k: Hex, q: Hex) => (q.toLowerCase() === id.toLowerCase() ? { ...cert } : null)
  const sellerStore = sellerMemoryStore()
  const jobs = createIdempotency()
  let executions = 0
  const app = new Hono()
  const mw = flyingMoney({
    accepts: ['anvil'],
    payee: payee.address,
    store: sellerStore,
    readCertificate: reader,
    price: () => (opts.price ? opts.price() : 10n),
    requestStatus: async (rid) => jobs.status(rid),
  })
  app.use('/v1/*', mw)
  app.get('/v1/data', async (c) => {
    const { requestId } = c.get('flyingMoney')
    const out = await jobs.runOnce(requestId, async () => {
      executions++
      if (Math.random() < (opts.failRate ?? 0)) throw new Error('service failed')
      return { value: executions }
    })
    return c.json(out)
  })
  app.onError((_e, c) => c.json({ error: 'failed' }, 500))
  return { payee, spenderKey, cert, reader, sellerStore, app, mw, executions: () => executions }
}

/** Network with injected faults: request lost before the server, or response lost after it. */
function flakyFetch(app: Hono, p: { dropBefore: number; dropAfter: number }): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (Math.random() < p.dropBefore) throw new TypeError('network: connection reset (before server)')
    const res = await app.request(input instanceof Request ? input : String(input), init)
    if (Math.random() < p.dropAfter) {
      await res.text()
      throw new TypeError('network: timeout (response lost)')
    }
    return res
  }) as typeof fetch
}

describe('C1: no obligation growth on failure (§6.6), with S1 exactly-once', () => {
  it('1,000 requests with drops, lost responses, service failures and crashes between sign/save/send', async () => {
    const w = world({ face: 1_000_000n, failRate: 0.05, price: () => BigInt(5 + Math.floor(Math.random() * 11)) })
    const clientStore = memoryStore() // durable across simulated crashes (the process dies; the store survives)
    const signed: bigint[] = []
    const spender = privateKeyToAccount(w.spenderKey)
    const spyAccount = {
      ...spender,
      signTypedData: async (p: Parameters<typeof spender.signTypedData>[0]) => {
        signed.push((p.message as { cumulative: bigint }).cumulative)
        return spender.signTypedData(p)
      },
    } as typeof spender

    const crashAt = new Set(['afterSign', 'afterSave', 'afterSend'])
    let crashes = 0
    const make = () =>
      createFlyingMoneyClient({
        chains: ['anvil'],
        spender: spyAccount,
        store: clientStore,
        certificates: [w.cert.id],
        maxPricePerRequest: 100n,
        readCertificate: w.reader,
        fetch: flakyFetch(w.app, { dropBefore: 0.08, dropAfter: 0.08 }),
        retry: { attempts: 4, backoffMs: 0 },
        hooks: {
          point: (name) => {
            if (crashAt.has(name) && Math.random() < 0.02) {
              crashes++
              throw new CrashError(name)
            }
          },
        },
      })

    let client = make()
    let completed = 0
    let guard = 0
    while (completed < 1000 && guard++ < 5000) {
      try {
        await client.ready
        await client.fetch('http://oracle.test/v1/data')
        completed++
      } catch (e) {
        if (e instanceof CrashError) {
          client = make() // restart: resolvePending runs first
        }
        // network gave up after retries: the pending note stays and is resent on the next call
      }
    }
    // final restart + resolution of anything left pending
    client = createFlyingMoneyClient({
      chains: ['anvil'],
      spender: spyAccount,
      store: clientStore,
      certificates: [w.cert.id],
      maxPricePerRequest: 100n,
      readCertificate: w.reader,
      fetch: flakyFetch(w.app, { dropBefore: 0, dropAfter: 0 }),
    })
    await client.ready

    const st = (await w.sellerStore.state(certKey(CHAIN_ID, w.cert.id)))!
    const maxSigned = signed.reduce((a, b) => (a > b ? a : b), 0n)
    const credit = st.accepted - st.consumed - st.reserved
    expect(completed).toBe(1000)
    expect(crashes).toBeGreaterThan(5)
    expect(st.reserved).toBe(0n)
    // C1: the highest cumulative ever signed equals Σ price(SERVED) + credit
    expect(maxSigned).toBe(st.consumed + credit)
    expect(maxSigned).toBe(st.accepted)
    // the client's own view converged to the seller's
    const local = (await clientStore.load(certKey(CHAIN_ID, w.cert.id)))!
    expect(local.pending).toBeUndefined()
    expect(local.accepted).toBe(st.accepted)
    expect(local.consumed).toBe(st.consumed)
  }, 120_000)

  it('S3 via the client: a failed service leaves credit and the next request signs no higher note', async () => {
    let fail = true
    const w = world({ face: 1_000n })
    w.app.get('/v1/flaky', (c) => (fail ? c.json({ error: 'x' }, 500) : c.json({ ok: 1 })))
    const signed: bigint[] = []
    const spender = privateKeyToAccount(w.spenderKey)
    const spy = {
      ...spender,
      signTypedData: async (p: Parameters<typeof spender.signTypedData>[0]) => {
        signed.push((p.message as { cumulative: bigint }).cumulative)
        return spender.signTypedData(p)
      },
    } as typeof spender
    const client = createFlyingMoneyClient({
      chains: ['anvil'],
      spender: spy,
      store: memoryStore(),
      certificates: [w.cert.id],
      maxPricePerRequest: 100n,
      readCertificate: w.reader,
      fetch: flakyFetch(w.app, { dropBefore: 0, dropAfter: 0 }),
    })
    const r1 = await client.fetch('http://oracle.test/v1/flaky')
    expect(r1.status).toBe(500)
    fail = false
    const r2 = await client.fetch('http://oracle.test/v1/flaky')
    expect(r2.status).toBe(200)
    expect(signed).toEqual([10n, 10n]) // next == accepted: credit spent, obligation did not grow
  })

  it('refuses prices above maxPricePerRequest and offers with no matching certificate', async () => {
    const w = world({ face: 1_000n, price: () => 500n })
    const client = createFlyingMoneyClient({
      chains: ['anvil'],
      spender: privateKeyToAccount(w.spenderKey),
      store: memoryStore(),
      certificates: [w.cert.id],
      maxPricePerRequest: 100n,
      readCertificate: w.reader,
      fetch: flakyFetch(w.app, { dropBefore: 0, dropAfter: 0 }),
    })
    await expect(client.fetch('http://oracle.test/v1/data')).rejects.toBeInstanceOf(PriceTooHighError)

    const other = world({ face: 1_000n }) // a different payee
    const c2 = createFlyingMoneyClient({
      chains: ['anvil'],
      spender: privateKeyToAccount(w.spenderKey),
      store: memoryStore(),
      certificates: [w.cert.id],
      maxPricePerRequest: 100n,
      readCertificate: w.reader,
      fetch: flakyFetch(other.app, { dropBefore: 0, dropAfter: 0 }),
    })
    await expect(c2.fetch('http://other.test/v1/data')).rejects.toBeInstanceOf(NoCertificateError)
  })

  it('never signs above faceValue; stops at the cap', async () => {
    const w = world({ face: 50n })
    const client = createFlyingMoneyClient({
      chains: ['anvil'],
      spender: privateKeyToAccount(w.spenderKey),
      store: memoryStore(),
      certificates: [w.cert.id],
      maxPricePerRequest: 100n,
      readCertificate: w.reader,
      fetch: flakyFetch(w.app, { dropBefore: 0, dropAfter: 0 }),
    })
    for (let i = 0; i < 5; i++) expect((await client.fetch('http://oracle.test/v1/data')).status).toBe(200)
    await expect(client.fetch('http://oracle.test/v1/data')).rejects.toThrow(/NoCertificate|insufficient|face value/i)
    expect(client.status()[0]).toMatchObject({ faceValue: 50n, spentLocal: 50n, remaining: 0n })
  })
})

describe('fileStore (durable outbox)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fm-client-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('persists pending notes and receipts across instances (atomic write)', async () => {
    const path = join(dir, 'outbox.json')
    const key = certKey(CHAIN_ID, `0x${'11'.repeat(32)}`)
    const a: ClientStore = fileStore(path)
    expect(await a.load(key)).toBeNull()
    await a.save(key, {
      accepted: 10n,
      consumed: 5n,
      reserved: 0n,
      pending: {
        requestId: `0x${'22'.repeat(32)}`,
        noteHeader: 'fm1.x',
        cumulative: 15n,
        request: { url: 'http://x', method: 'GET', headers: {} },
        createdAt: 1,
      },
    })
    const b = fileStore(path) // "after a restart"
    const got = await b.load(key)
    expect(got).toMatchObject({ accepted: 10n, consumed: 5n, pending: { cumulative: 15n, noteHeader: 'fm1.x' } })
    await b.save(key, { accepted: 15n, consumed: 15n, reserved: 0n })
    expect((await fileStore(path).load(key))?.pending).toBeUndefined()
  })
})
