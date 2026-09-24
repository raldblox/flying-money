import { certKey, type Hex, newRequestId } from '@flying-money/core'
import { generatePrivateKey } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import { CHAIN_ID, note, remoteTimeout, storeFactories } from './fixtures.js'

const spenderKey = generatePrivateKey()
const cid = newRequestId() // any 32-byte id

for (const [name, make] of storeFactories()) {
  describe(`NoteStore contract: ${name}`, { timeout: remoteTimeout(name) }, () => {
    const key = certKey(CHAIN_ID, cid)

    it('state is null until recover; recover sets accepted = consumed = redeemedOnChain (D5 status)', async () => {
      const s = make()
      expect(await s.state(key)).toBeNull()
      await s.recover(key, 0n)
      expect(await s.state(key)).toEqual({ accepted: 0n, consumed: 0n, reserved: 0n, status: 'OK' })
      // recover never overwrites existing state
      await s.recover(key, 999n)
      expect((await s.state(key))?.accepted).toBe(0n)

      const k2 = certKey(CHAIN_ID, newRequestId())
      await s.recover(k2, 500n)
      expect(await s.state(k2)).toEqual({ accepted: 500n, consumed: 500n, reserved: 0n, status: 'RECOVERED' })
    })

    it('begin: re-checks S2 atomically, reserves, stores the note; duplicate requestId → DUPLICATE', async () => {
      const s = make()
      await s.recover(key, 0n)
      const n = await note(spenderKey, cid, 30n)
      const rid = n.signed.memo
      expect(await s.begin(key, rid, 10n, n.signed, 100n)).toBe('ADMITTED')
      expect(await s.state(key)).toMatchObject({ accepted: 30n, consumed: 0n, reserved: 10n })
      expect(await s.outcome(key, rid)).toMatchObject({ status: 'PENDING', price: 10n })
      expect(await s.begin(key, rid, 10n, n.signed, 100n)).toBe('DUPLICATE')
      // budget: consumed + reserved + P ≤ max(accepted, cumulative)
      const n2 = await note(spenderKey, cid, 30n)
      expect(await s.begin(key, n2.signed.memo, 20n, n2.signed, 100n)).toBe('ADMITTED') // 10 + 20 ≤ 30
      const n3 = await note(spenderKey, cid, 30n)
      expect(await s.begin(key, n3.signed.memo, 1n, n3.signed, 100n)).toBe('INSUFFICIENT') // 31 > 30
      // cumulative above face value is never admitted
      const n4 = await note(spenderKey, cid, 101n)
      expect(await s.begin(key, n4.signed.memo, 1n, n4.signed, 100n)).toBe('INSUFFICIENT')
      expect(await s.outcome(key, n4.signed.memo)).toBeNull()
      // an older, lower note is judged against max(accepted, cumulative) — no spurious rejection, no new value
      const old = await note(spenderKey, cid, 5n)
      expect(await s.state(key)).toMatchObject({ accepted: 30n, reserved: 30n })
      expect(await s.begin(key, old.signed.memo, 1n, old.signed, 100n)).toBe('INSUFFICIENT')
    })

    it('F1 (D32): begin records the request hash with the outcome, and it survives finish', async () => {
      const s = make()
      await s.recover(key, 0n)
      const n = await note(spenderKey, cid, 10n)
      const h = `0x${'c'.repeat(64)}` as Hex
      expect(await s.begin(key, n.signed.memo, 10n, n.signed, 100n, h)).toBe('ADMITTED')
      expect(await s.outcome(key, n.signed.memo)).toEqual({ status: 'PENDING', price: 10n, requestHash: h })
      await s.finish(key, n.signed.memo, true, 'r')
      expect(await s.outcome(key, n.signed.memo)).toEqual({
        status: 'SERVED',
        price: 10n,
        responseRef: 'r',
        requestHash: h,
      })
    })

    it('finish: only from PENDING; success → consumed, failure → credit (S3)', async () => {
      const s = make()
      await s.recover(key, 0n)
      const a = await note(spenderKey, cid, 10n)
      const b = await note(spenderKey, cid, 20n)
      await s.begin(key, a.signed.memo, 10n, a.signed, 100n)
      await s.begin(key, b.signed.memo, 10n, b.signed, 100n)
      expect(await s.finish(key, a.signed.memo, true, 'resp-a')).toBe('DONE')
      expect(await s.finish(key, a.signed.memo, true)).toBe('NOT_PENDING')
      expect(await s.finish(key, a.signed.memo, false)).toBe('NOT_PENDING')
      expect(await s.finish(key, b.signed.memo, false)).toBe('DONE')
      expect(await s.finish(key, newRequestId(), true)).toBe('NOT_PENDING')
      expect(await s.state(key)).toMatchObject({ accepted: 20n, consumed: 10n, reserved: 0n })
      expect(await s.outcome(key, a.signed.memo)).toEqual({ status: 'SERVED', price: 10n, responseRef: 'resp-a' })
      expect(await s.outcome(key, b.signed.memo)).toMatchObject({ status: 'FAILED_CREDITED', price: 10n })
    })

    it('bestNote returns the highest stored note ≤ max; pendingRedemptions offers only served value', async () => {
      const s = make()
      await s.recover(key, 0n)
      const ids: Hex[] = []
      for (const cum of [10n, 20n, 30n, 40n]) {
        const n = await note(spenderKey, cid, cum)
        ids.push(n.signed.memo)
        expect(await s.begin(key, n.signed.memo, 10n, n.signed, 1000n)).toBe('ADMITTED')
      }
      await s.finish(key, ids[0]!, true)
      await s.finish(key, ids[1]!, true)
      await s.finish(key, ids[2]!, false) // credit
      // consumed = 20, accepted = 40
      expect((await s.bestNote(key, 20n))?.cumulative).toBe(20n)
      expect((await s.bestNote(key, 25n))?.cumulative).toBe(20n)
      expect((await s.bestNote(key, 1000n))?.cumulative).toBe(40n)
      expect(await s.bestNote(key, 9n)).toBeNull()

      const pr = await s.pendingRedemptions(CHAIN_ID)
      expect(pr).toHaveLength(1)
      expect(pr[0]).toMatchObject({ key, redeemedOnChain: 0n })
      expect(pr[0]!.note.cumulative).toBe(20n) // never above consumed (redeem-only-served)
      expect(typeof pr[0]!.oldestServedAt).toBe('number')

      await s.markRedeemed(key, 20n, `0x${'ab'.repeat(32)}`)
      expect(await s.pendingRedemptions(CHAIN_ID)).toEqual([])
      expect(await s.pendingRedemptions(CHAIN_ID + 1)).toEqual([])
      // notes below redeemedOnChain are pruned, higher ones kept
      expect(await s.bestNote(key, 19n)).toBeNull()
      expect((await s.bestNote(key, 1000n))?.cumulative).toBe(40n)
    })

    it('stalePending lists PENDING records older than the threshold', async () => {
      const s = make()
      await s.recover(key, 0n)
      const n = await note(spenderKey, cid, 10n)
      await s.begin(key, n.signed.memo, 10n, n.signed, 100n)
      await new Promise((r) => setTimeout(r, 30))
      expect(await s.stalePending(10_000)).toEqual([])
      expect(await s.stalePending(10)).toEqual([{ key, requestId: n.signed.memo.toLowerCase() }])
      await s.finish(key, n.signed.memo, true)
      expect(await s.stalePending(0)).toEqual([])
    })

    it('one in-flight submission per chain', async () => {
      const s = make()
      expect(await s.getSubmission(CHAIN_ID)).toBeNull()
      const sub = { txHash: `0x${'cd'.repeat(32)}` as Hex, keys: [key], nonce: 7 }
      await s.setSubmission(CHAIN_ID, sub)
      expect(await s.getSubmission(CHAIN_ID)).toEqual(sub)
      expect(await s.getSubmission(CHAIN_ID + 1)).toBeNull()
      await s.setSubmission(CHAIN_ID, null)
      expect(await s.getSubmission(CHAIN_ID)).toBeNull()
    })

    it('handles amounts above 2^53 exactly (Lua uses decimal-string arithmetic)', async () => {
      const s = make()
      const big = 2n ** 200n
      await s.recover(key, big)
      const n = await note(spenderKey, cid, big + 3n)
      expect(await s.begin(key, n.signed.memo, 3n, n.signed, big + 10n)).toBe('ADMITTED')
      await s.finish(key, n.signed.memo, true)
      expect(await s.state(key)).toMatchObject({ accepted: big + 3n, consumed: big + 3n, reserved: 0n })
    })
  })
}
