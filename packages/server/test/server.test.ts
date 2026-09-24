import { certKey, decodeOffer, encodeHeader, type Hex, newRequestId, signNote } from '@flying-money/core'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import {
  createFlyingMoneyServer,
  createIdempotency,
  type ExecResult,
  type HandleResult,
  type NoteStore,
  type PaymentContext,
} from '../src/index.js'
import { CHAIN_ID, Clock, CONTRACT, FakeChain, note, payee, remoteTimeout, storeFactories } from './fixtures.js'

const DAY = 86_400n

function setup(store: NoteStore, opts: { face?: bigint; life?: bigint } = {}) {
  const chain = new FakeChain()
  const clock = new Clock()
  const spenderKey = generatePrivateKey()
  const cert = chain.issue({
    faceValue: opts.face ?? 1_000n,
    expiresAt: BigInt(clock.t) + (opts.life ?? 7n * DAY),
    spender: privateKeyToAccount(spenderKey).address,
  })
  const jobs = createIdempotency()
  const server = createFlyingMoneyServer({
    accepts: ['anvil'],
    payee: payee.address,
    store,
    readCertificate: chain.reader,
    now: clock.now,
    requestStatus: async (rid) => jobs.status(rid),
  })
  return { chain, clock, spenderKey, cert, server, jobs, key: certKey(CHAIN_ID, cert.id) }
}

/** Invariant probe: wraps a store and checks the §6.5 state invariant after every begin/finish. */
function probed(inner: NoteStore, face: () => bigint, violations: string[]): NoteStore {
  const check = async (key: Parameters<NoteStore['state']>[0]) => {
    const st = await inner.state(key)
    if (!st) return
    if (st.consumed + st.reserved > st.accepted) violations.push(`consumed+reserved>accepted ${JSON.stringify(st, bi)}`)
    if (st.accepted > face()) violations.push(`accepted>face ${JSON.stringify(st, bi)}`)
    if (st.reserved < 0n || st.consumed < 0n) violations.push('negative')
  }
  return new Proxy(inner, {
    get(target, prop, recv) {
      const v = Reflect.get(target, prop, recv)
      if (prop === 'begin' || prop === 'finish') {
        return async (...args: unknown[]) => {
          const r = await (v as (...a: unknown[]) => Promise<unknown>).apply(target, args)
          await check(args[0] as Parameters<NoteStore['state']>[0])
          return r
        }
      }
      return typeof v === 'function' ? v.bind(target) : v
    },
  })
}
/** Poll instead of sleeping a fixed time (the Lua mock is slow under CPU load). */
async function until(cond: () => Promise<boolean>, ms = 10_000) {
  const t0 = Date.now()
  while (!(await cond())) {
    if (Date.now() - t0 > ms) throw new Error('timed out waiting for condition')
    await new Promise((r) => setTimeout(r, 10))
  }
}
const bi = (_: string, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)

const ok = (value: unknown = 'ok'): ExecResult => ({ ok: true, responseRef: JSON.stringify(value) })

for (const [name, make] of storeFactories()) {
  describe(`server §6.5 — ${name}`, { timeout: remoteTimeout(name) }, () => {
    it('no note → 402 with a flying-money offer listing the registry contract, USDC and payee', async () => {
      const { server } = setup(make())
      const r = await server.handle({ noteHeader: null, price: 10n }, async () => ok())
      expect(r.kind).toBe('offer')
      if (r.kind !== 'offer') return
      expect(r.status).toBe(402)
      expect(r.offer).toMatchObject({ scheme: 'flying-money', v: 1, price: 10n, minRemainingLifetime: 3600 })
      expect(r.offer.accepts).toEqual([
        { chainId: CHAIN_ID, contract: CONTRACT, token: expect.any(String), payee: payee.address },
      ])
      expect(decodeOffer(encodeHeader(r.offer))).toEqual(r.offer)
    })

    it('rejects malformed (400), wrong chain/contract (402), bad signature (401), wrong payee / expiring (402)', async () => {
      const { server, cert, spenderKey, chain, clock } = setup(make())
      const exec = async () => ok()
      expect((await server.handle({ noteHeader: 'fm1.garbage', price: 10n }, exec)).status).toBe(400)

      const other = await signNote(privateKeyToAccount(spenderKey), CHAIN_ID + 1, CONTRACT, {
        certificateId: cert.id,
        cumulative: 10n,
        memo: newRequestId(),
      })
      expect(await server.handle({ noteHeader: encodeHeader(other), price: 10n }, exec)).toMatchObject({ status: 402 })

      const forged = await note(generatePrivateKey(), cert.id, 10n)
      expect(await server.handle({ noteHeader: forged.header, price: 10n }, exec)).toMatchObject({ status: 401 })

      const wrongPayeeCert = chain.issue({
        faceValue: 100n,
        expiresAt: BigInt(clock.t) + DAY,
        spender: privateKeyToAccount(spenderKey).address,
        payee: privateKeyToAccount(generatePrivateKey()).address,
      })
      const wp = await note(spenderKey, wrongPayeeCert.id, 10n)
      expect(await server.handle({ noteHeader: wp.header, price: 10n }, exec)).toMatchObject({
        status: 402,
        reason: 'wrong-payee',
      })

      const soon = chain.issue({
        faceValue: 100n,
        expiresAt: BigInt(clock.t) + 3599n,
        spender: privateKeyToAccount(spenderKey).address,
      })
      const sn = await note(spenderKey, soon.id, 10n)
      expect(await server.handle({ noteHeader: sn.header, price: 10n }, exec)).toMatchObject({
        status: 402,
        reason: 'expiring',
      })

      const unknown = await note(spenderKey, newRequestId(), 10n)
      expect(await server.handle({ noteHeader: unknown.header, price: 10n }, exec)).toMatchObject({
        status: 402,
        reason: 'unknown-certificate',
      })

      const over = await note(spenderKey, cert.id, 1_001n)
      expect(await server.handle({ noteHeader: over.header, price: 10n }, exec)).toMatchObject({
        status: 402,
        reason: 'insufficient',
      })
    })

    it('serves, then returns a receipt with accepted/consumed/reserved/credit/remaining', async () => {
      const { server, cert, spenderKey } = setup(make())
      const n = await note(spenderKey, cert.id, 30n)
      const r = await server.handle({ noteHeader: n.header, price: 10n }, async (ctx) => {
        expect(ctx.requestId).toBe(n.signed.memo)
        expect(ctx.price).toBe(10n)
        return ok({ tea: 1 })
      })
      expect(r).toMatchObject({ kind: 'served', replay: false })
      if (r.kind !== 'served') return
      expect(r.receipt).toMatchObject({
        certificateId: cert.id,
        requestId: n.signed.memo,
        status: 'SERVED',
        accepted: 30n,
        consumed: 10n,
        reserved: 0n,
        credit: 20n,
        remaining: 970n,
        expiresAt: cert.expiresAt,
      })
    })

    it('S1: replaying an accepted note (sequentially and concurrently) never charges or executes twice', async () => {
      const store = make()
      const { server, cert, spenderKey, jobs, key } = setup(store)
      let executions = 0
      const exec = (ctx: PaymentContext) =>
        jobs.runOnce(ctx.requestId, async () => {
          executions++
          return ok({ n: executions })
        })
      const n = await note(spenderKey, cert.id, 10n)
      const first = await server.handle({ noteHeader: n.header, price: 10n }, exec)
      expect(first.kind).toBe('served')
      for (let i = 0; i < 5; i++) {
        const again = await server.handle({ noteHeader: n.header, price: 10n }, exec)
        expect(again).toMatchObject({ kind: 'served', replay: true })
        if (again.kind === 'served') expect(again.result.responseRef).toBe(JSON.stringify({ n: 1 }))
      }
      const concurrent = await Promise.all(
        Array.from({ length: 20 }, () => server.handle({ noteHeader: n.header, price: 10n }, exec)),
      )
      for (const c of concurrent) expect(c.kind).toBe('served')
      expect(executions).toBe(1)
      expect(await store.state(key)).toMatchObject({ consumed: 10n, reserved: 0n })

      // concurrent FIRST delivery of one fresh note: exactly one admission, one execution
      const m = await note(spenderKey, cert.id, 20n)
      const burst = await Promise.all(
        Array.from({ length: 20 }, () => server.handle({ noteHeader: m.header, price: 10n }, exec)),
      )
      expect(executions).toBe(2)
      expect(burst.filter((b) => b.kind === 'served').length).toBe(20)
      expect(await store.state(key)).toMatchObject({ accepted: 20n, consumed: 20n, reserved: 0n })
    })

    it('S3: a failing service leaves credit = P; the next request succeeds with next == accepted (no higher signature)', async () => {
      const store = make()
      const { server, cert, spenderKey, key } = setup(store)
      const n = await note(spenderKey, cert.id, 10n)
      const failed = await server.handle({ noteHeader: n.header, price: 10n }, async () => {
        throw new Error('upstream down')
      })
      expect(failed).toMatchObject({
        kind: 'failed',
        receipt: { status: 'FAILED_CREDITED', credit: 10n, consumed: 0n },
      })
      expect(await store.state(key)).toMatchObject({ accepted: 10n, consumed: 0n, reserved: 0n })
      // replay of the failed request returns the stored failure (no retry of the charge)
      expect(await server.handle({ noteHeader: n.header, price: 10n }, async () => ok())).toMatchObject({
        kind: 'failed',
        replay: true,
      })
      const again = await note(spenderKey, cert.id, 10n) // same cumulative, fresh requestId
      const served = await server.handle({ noteHeader: again.header, price: 10n }, async () => ok())
      expect(served).toMatchObject({ kind: 'served', receipt: { accepted: 10n, consumed: 10n, credit: 0n } })
    })

    it('S4: ten concurrent 10-unit requests against accepted = 10 → exactly one admitted', async () => {
      const store = make()
      const violations: string[] = []
      const { server, cert, spenderKey, key } = setup(probed(store, () => 1_000n, violations))
      let release!: () => void
      const gate = new Promise<void>((r) => {
        release = r
      })
      const notes = await Promise.all(Array.from({ length: 10 }, () => note(spenderKey, cert.id, 10n)))
      const results = notes.map((n) =>
        server.handle({ noteHeader: n.header, price: 10n }, async () => {
          await gate
          return ok()
        }),
      )
      await new Promise((r) => setTimeout(r, 50))
      release()
      const done = await Promise.all(results)
      expect(done.filter((d) => d.kind === 'served')).toHaveLength(1)
      expect(done.filter((d) => d.kind === 'offer' && d.reason === 'insufficient')).toHaveLength(9)
      expect(await store.state(key)).toMatchObject({ accepted: 10n, consumed: 10n, reserved: 0n })
      expect(violations).toEqual([])
    })

    it('S4 (randomised): 10–100 concurrent adversarial requests, mixed cumulatives, two server instances', async () => {
      for (let trial = 0; trial < 5; trial++) {
        const store = make()
        const violations: string[] = []
        const face = 500n
        const a = setup(
          probed(store, () => face, violations),
          { face },
        )
        // a second seller instance sharing the same store and chain
        const b = createFlyingMoneyServer({
          accepts: ['anvil'],
          payee: payee.address,
          store: probed(store, () => face, violations),
          readCertificate: a.chain.reader,
          now: a.clock.now,
        })
        const n = 10 + Math.floor(Math.random() * 91)
        const cums = [50n, 100n, 150n, 200n]
        const notes = await Promise.all(
          Array.from({ length: n }, (_, i) => note(a.spenderKey, a.cert.id, cums[i % cums.length]!)),
        )
        const pending = new Set<string>()
        let servedSum = 0n
        let maxPendingPlusServed = 0n
        const results = await Promise.all(
          notes.map((nt, i) =>
            (i % 2 ? b : a.server).handle({ noteHeader: nt.header, price: 10n }, async (ctx) => {
              pending.add(ctx.requestId)
              const sumNow = servedSum + BigInt(pending.size) * 10n
              if (sumNow > maxPendingPlusServed) maxPendingPlusServed = sumNow
              await new Promise((r) => setTimeout(r, Math.random() * 5))
              pending.delete(ctx.requestId)
              if (Math.random() < 0.2) throw new Error('random failure')
              servedSum += 10n
              return ok()
            }),
          ),
        )
        const st = (await store.state(a.key))!
        expect(violations).toEqual([])
        expect(st.reserved).toBe(0n)
        // Σ price(SERVED ∪ PENDING) ≤ accepted − consumed₀ (consumed₀ = 0) at every observed moment
        expect(maxPendingPlusServed).toBeLessThanOrEqual(st.accepted)
        expect(st.accepted).toBeLessThanOrEqual(200n)
        expect(st.consumed).toBe(servedSum)
        expect(results.filter((r) => r.kind === 'served').length * 10).toBe(Number(servedSum))
      }
    }, 60_000) // the in-process Lua VM is slow under CPU load; this is a timing budget, not an invariant

    it('sweeper: stale PENDING resolves via the application status; a racing retry never double-finishes', async () => {
      const store = make()
      const { server, cert, spenderKey, key, jobs } = setup(store)
      const statuses = new Map<string, 'done' | 'failed' | 'not-started' | 'running'>()
      void jobs
      // Simulate crashes after admission: execute never returns.
      const hang = () => new Promise<ExecResult>(() => {})
      const done = await note(spenderKey, cert.id, 10n)
      const failed = await note(spenderKey, cert.id, 20n)
      const notStarted = await note(spenderKey, cert.id, 30n)
      const running = await note(spenderKey, cert.id, 40n)
      for (const n of [done, failed, notStarted, running])
        void server.handle({ noteHeader: n.header, price: 10n }, hang)
      await until(async () => (await store.state(key))?.reserved === 40n)
      expect(await store.state(key)).toMatchObject({ reserved: 40n, consumed: 0n })
      statuses.set(done.signed.memo, 'done')
      statuses.set(failed.signed.memo, 'failed')
      statuses.set(notStarted.signed.memo, 'not-started')
      statuses.set(running.signed.memo, 'running')

      const sweeper = createFlyingMoneyServer({
        accepts: ['anvil'],
        payee: payee.address,
        store,
        readCertificate: async () => null,
        pendingTimeoutMs: 0,
        requestStatus: async (rid) => statuses.get(rid) ?? 'running',
      })
      // race: the sweeper and a client retry of `done` at the same time
      const [swept, retry] = await Promise.all([
        sweeper.sweep(),
        server.handle({ noteHeader: done.header, price: 10n }, async () => ok('retried')),
      ])
      expect(swept.resolved + (retry.kind === 'served' && !retry.replay ? 1 : 0)).toBeGreaterThanOrEqual(3)
      const st = (await store.state(key))!
      expect(st.consumed).toBe(10n) // `done` finished exactly once
      expect(st.reserved).toBe(10n) // only `running` still reserved
      expect(await store.outcome(key, failed.signed.memo)).toMatchObject({ status: 'FAILED_CREDITED' })
      expect(await store.outcome(key, notStarted.signed.memo)).toMatchObject({ status: 'FAILED_CREDITED' })
      expect(await store.outcome(key, running.signed.memo)).toMatchObject({ status: 'PENDING' })
      statuses.set(running.signed.memo, 'done')
      await sweeper.sweep()
      expect(await store.state(key)).toMatchObject({ consumed: 20n, reserved: 0n })
    })

    it('PENDING resume: a retry of an admitted-but-unfinished request re-runs the idempotent operation', async () => {
      const store = make()
      const { server, cert, spenderKey, key, jobs } = setup(store)
      const n = await note(spenderKey, cert.id, 10n)
      let calls = 0
      void server.handle({ noteHeader: n.header, price: 10n }, () => new Promise<ExecResult>(() => {})) // crash
      await until(async () => (await store.outcome(key, n.signed.memo))?.status === 'PENDING')
      const r = await server.handle({ noteHeader: n.header, price: 10n }, (ctx) =>
        jobs.runOnce(ctx.requestId, async () => {
          calls++
          return ok()
        }),
      )
      expect(r).toMatchObject({ kind: 'served' })
      expect(calls).toBe(1)
      expect(await store.state(key)).toMatchObject({ consumed: 10n, reserved: 0n })
    })

    it('F1 (D32): a requestId is bound to its request; a replay for a different request is refused, never run', async () => {
      const store = make()
      const { server, cert, spenderKey, key } = setup(store)
      const n = await note(spenderKey, cert.id, 10n)
      const A = `0x${'a'.repeat(64)}` as Hex
      const B = `0x${'b'.repeat(64)}` as Hex
      let calls = 0
      const exec = async () => {
        calls++
        return ok()
      }
      // admitted for request A, then stuck PENDING (slow handler)
      void server.handle({ noteHeader: n.header, price: 10n, requestHash: A }, () => new Promise<ExecResult>(() => {}))
      await until(async () => (await store.outcome(key, n.signed.memo))?.status === 'PENDING')
      // the same note replayed for request B while PENDING: refused, the handler does not run
      for (let i = 0; i < 5; i++)
        expect(await server.handle({ noteHeader: n.header, price: 10n, requestHash: B }, exec)).toMatchObject({
          kind: 'error',
          status: 409,
        })
      expect(calls).toBe(0)
      // resuming request A itself is still allowed (§6.5 step 4)
      expect(await server.handle({ noteHeader: n.header, price: 10n, requestHash: A }, exec)).toMatchObject({
        kind: 'served',
      })
      expect(calls).toBe(1)
      // once SERVED, a replay for request B is refused too (no stored response, no re-run)
      expect(await server.handle({ noteHeader: n.header, price: 10n, requestHash: B }, exec)).toMatchObject({
        status: 409,
      })
      expect(calls).toBe(1)
      expect(await store.state(key)).toMatchObject({ consumed: 10n, reserved: 0n })
    })

    it('F1 (D32, property): random replays across requests never run a handler for a request that was not admitted', async () => {
      const store = make()
      const { server, cert, spenderKey } = setup(store, { face: 1_000_000n })
      const hashes = Array.from({ length: 4 }, (_, i) => `0x${String(i + 1).repeat(64)}` as Hex)
      const admitted = new Map<Hex, Hex>() // memo → the request it was admitted for
      const ran: Array<[Hex, Hex]> = []
      const notes: Array<{ header: string; memo: Hex }> = []
      let cum = 0n
      for (let step = 0; step < 40; step++) {
        const reuse = notes.length > 0 && Math.random() < 0.6
        let pick: { header: string; memo: Hex }
        if (reuse) pick = notes[Math.floor(Math.random() * notes.length)]!
        else {
          cum += 10n
          const n = await note(spenderKey, cert.id, cum)
          pick = { header: n.header, memo: n.signed.memo.toLowerCase() as Hex }
          notes.push(pick)
        }
        const h = hashes[Math.floor(Math.random() * hashes.length)]!
        const r = await server.handle({ noteHeader: pick.header, price: 10n, requestHash: h }, async (ctx) => {
          ran.push([ctx.requestId, h])
          return ok()
        })
        if (!admitted.has(pick.memo) && r.kind === 'served') admitted.set(pick.memo, h)
        if (admitted.has(pick.memo) && admitted.get(pick.memo) !== h) expect(r).toMatchObject({ status: 409 })
      }
      for (const [rid, h] of ran) expect(admitted.get(rid.toLowerCase() as Hex)).toBe(h)
    })

    it('D3: stored outcomes are returned before the lifetime check; forged notes with a known memo get 401', async () => {
      const { server, cert, spenderKey, clock } = setup(make(), { life: 2n * 3600n })
      const n = await note(spenderKey, cert.id, 10n)
      expect((await server.handle({ noteHeader: n.header, price: 10n }, async () => ok('v'))).kind).toBe('served')
      clock.t += 3601 // now inside minRemainingLifetime
      const replay = await server.handle({ noteHeader: n.header, price: 10n }, async () => ok('x'))
      expect(replay).toMatchObject({ kind: 'served', replay: true })
      // a fresh note is refused near expiry
      const fresh = await note(spenderKey, cert.id, 20n)
      expect(await server.handle({ noteHeader: fresh.header, price: 10n }, async () => ok())).toMatchObject({
        status: 402,
        reason: 'expiring',
      })
      // a forged note reusing a known memo cannot read the stored response
      const forged = await note(generatePrivateKey(), cert.id, 10n, n.signed.memo)
      expect(await server.handle({ noteHeader: forged.header, price: 10n }, async () => ok())).toMatchObject({
        status: 401,
      })
    })

    it('store loss: rebuilds RECOVERED with accepted = consumed = redeemedOnChain; notes at or below it are not new value', async () => {
      const store = make()
      const { server, cert, spenderKey, chain, key } = setup(store)
      chain.certs.get(cert.id.toLowerCase())!.redeemed = 50n // redeemed on-chain before the wipe
      const low = await note(spenderKey, cert.id, 50n)
      const r1 = await server.handle({ noteHeader: low.header, price: 10n }, async () => ok())
      expect(r1).toMatchObject({ status: 402, reason: 'insufficient' })
      expect(await store.state(key)).toEqual({ accepted: 50n, consumed: 50n, reserved: 0n, status: 'RECOVERED' })
      // the buyer's next note (its own view: consumed + credit + P) is admitted; the buyer never loses credit
      const next = await note(spenderKey, cert.id, 70n)
      const r2 = await server.handle({ noteHeader: next.header, price: 10n }, async () => ok())
      expect(r2).toMatchObject({ kind: 'served', receipt: { accepted: 70n, consumed: 60n, credit: 10n } })
    })

    it('certificate cache: re-reads only when a note exceeds cached faceValue (topUp) or expiry is near', async () => {
      const { server, cert, spenderKey, chain } = setup(make(), { face: 100n })
      const n1 = await note(spenderKey, cert.id, 10n)
      await server.handle({ noteHeader: n1.header, price: 10n }, async () => ok())
      const readsAfterFirst = chain.reads
      for (let i = 2; i <= 5; i++) {
        const n = await note(spenderKey, cert.id, BigInt(i * 10))
        await server.handle({ noteHeader: n.header, price: 10n }, async () => ok())
      }
      expect(chain.reads).toBe(readsAfterFirst) // cached
      chain.certs.get(cert.id.toLowerCase())!.faceValue = 200n // topUp on-chain
      const big = await note(spenderKey, cert.id, 150n)
      expect(await server.handle({ noteHeader: big.header, price: 10n }, async () => ok())).toMatchObject({
        kind: 'served',
      })
      expect(chain.reads).toBe(readsAfterFirst + 1)
    })

    it('"cut the network": with the certificate cached, notes keep being verified and accepted while the RPC is down', async () => {
      const { server, cert, spenderKey, chain } = setup(make())
      const first = await note(spenderKey, cert.id, 10n)
      await server.handle({ noteHeader: first.header, price: 10n }, async () => ok())
      chain.down = true
      for (let i = 2; i <= 10; i++) {
        const n = await note(spenderKey, cert.id, BigInt(i * 10))
        expect((await server.handle({ noteHeader: n.header, price: 10n }, async () => ok())).kind).toBe('served')
      }
    })
  })
}

describe('createIdempotency', () => {
  it('runs once per requestId and reports status', async () => {
    const jobs = createIdempotency()
    const rid: Hex = newRequestId()
    expect(jobs.status(rid)).toBe('not-started')
    let n = 0
    const [a, b] = await Promise.all([jobs.runOnce(rid, async () => ++n), jobs.runOnce(rid, async () => ++n)])
    expect(a).toBe(1)
    expect(b).toBe(1)
    expect(jobs.status(rid)).toBe('done')
    const bad: Hex = newRequestId()
    await expect(
      jobs.runOnce(bad, async () => {
        throw new Error('x')
      }),
    ).rejects.toThrow()
    expect(jobs.status(bad)).toBe('failed')
  })
})

export type { HandleResult }
