import {
  grantTypedData,
  type Hex,
  inboxAccessTypedData,
  newRequestId,
  type RequestGrant,
  type SignedSpendRequest,
  signSpendRequest,
  spendRequestToParts,
  ZERO_ID,
} from '@flying-money/core'
import { Redis as UpstashRedis } from '@upstash/redis'
import RedisMock from 'ioredis-mock'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createInbox,
  type InboxLimits,
  type InboxStore,
  ioredisEval,
  memoryInboxStore,
  redisInboxStore,
  upstashEnv,
  upstashEval,
} from '../src/index.js'
import { remoteTimeout } from './fixtures.js'

// §21.4.2 relay inbox and §21.4.6 R1–R5: both signatures, grant limits and revocation, size and rate limits, owner
// sessions, and approval only after an on-chain check.
const CHAIN = 421614
const rand = () => Math.random().toString(36).slice(2, 10)
const upstashPrefixes: string[] = []
afterAll(async () => {
  const up = upstashEnv()
  if (!up) return
  const r = new UpstashRedis(up)
  for (const prefix of upstashPrefixes) {
    let cursor = '0'
    do {
      const [next, keys] = await r.scan(cursor, { match: `${prefix}*`, count: 500 })
      if (keys.length) await r.del(...keys)
      cursor = String(next)
    } while (cursor !== '0')
  }
}, 300_000)

const stores: Array<[string, () => InboxStore]> = [
  ['memory', () => memoryInboxStore()],
  ['redis Lua (ioredis-mock)', () => redisInboxStore(ioredisEval(new RedisMock() as never), `t:${rand()}:`)],
]
const up = upstashEnv()
if (up)
  stores.push([
    'redis Lua (Upstash)',
    () => {
      const prefix = `fm:test:${rand()}:`
      upstashPrefixes.push(prefix)
      return redisInboxStore(upstashEval(new UpstashRedis({ ...up, automaticDeserialization: false })), prefix)
    },
  ])

const NOW = 1_790_000_000_000 // ms

function world(store: InboxStore, limits?: Partial<InboxLimits>) {
  const owner = privateKeyToAccount(generatePrivateKey())
  const agent = privateKeyToAccount(generatePrivateKey())
  const payee = privateKeyToAccount(generatePrivateKey()).address
  let now = NOW
  let approvalRefusal: string | null = null
  const inbox = createInbox({
    store,
    now: () => now,
    limits,
    isChain: (id) => id === CHAIN,
    checkApproval: async () => approvalRefusal,
  })
  const grantFor = async (g: Partial<RequestGrant> = {}, by = owner) => {
    const grant: RequestGrant = {
      owner: owner.address,
      requester: agent.address,
      maxAmountPerRequest: 1_000_000n,
      expiresAt: BigInt(Math.floor(NOW / 1000) + 30 * 86_400),
      grantId: newRequestId(),
      ...g,
    }
    const sig = await by.signTypedData(grantTypedData(CHAIN, grant))
    return {
      grant: {
        owner: grant.owner,
        requester: grant.requester,
        maxAmountPerRequest: grant.maxAmountPerRequest.toString(),
        expiresAt: grant.expiresAt.toString(),
        grantId: grant.grantId,
      },
      grantSig: sig,
      raw: grant,
    }
  }
  const requestFor = (
    o: { amount?: bigint; payee?: Hex; reason?: string; createdAt?: bigint; by?: typeof agent } = {},
  ) =>
    signSpendRequest(o.by ?? agent, CHAIN, {
      owner: owner.address,
      payee: o.payee ?? payee,
      amount: o.amount ?? 500_000n,
      validFor: 7n * 86_400n,
      certificateId: ZERO_ID,
      requestId: newRequestId(),
      createdAt: o.createdAt ?? BigInt(Math.floor(NOW / 1000)),
      reason: o.reason ?? 'Tea prices for the trip',
      origin: 'https://oracle.example',
    })
  const body = (s: SignedSpendRequest, g: Awaited<ReturnType<typeof grantFor>>) => {
    const p = spendRequestToParts(s)
    return { chainId: p.chainId, request: p.request, sig: p.sig, grant: g.grant, grantSig: g.grantSig }
  }
  const session = async (who = owner) => {
    const issuedAt = BigInt(Math.floor(now / 1000))
    const sig = await who.signTypedData(inboxAccessTypedData(CHAIN, who.address, issuedAt))
    return inbox.openSession({ chainId: String(CHAIN), owner: who.address, issuedAt: issuedAt.toString(), sig })
  }
  return {
    owner,
    agent,
    payee,
    inbox,
    grantFor,
    requestFor,
    body,
    session,
    setNow: (t: number) => {
      now = t
    },
    refuseApproval: (r: string | null) => {
      approvalRefusal = r
    },
  }
}

const code = async (p: Promise<unknown>) => {
  try {
    await p
    return 'ok'
  } catch (e) {
    return (e as { code?: string }).code ?? String(e)
  }
}

for (const [name, make] of stores)
  describe(`relay inbox (§21.4.2): ${name}`, { timeout: remoteTimeout(name) }, () => {
    it('accepts a request carrying a valid grant; its public status is asked', async () => {
      const w = world(make())
      const s = await w.requestFor()
      const r = await w.inbox.submit(w.body(s, await w.grantFor()))
      expect(r).toEqual({ requestId: s.request.requestId, status: 'asked' })
      expect(await w.inbox.status(s.request.requestId)).toEqual({ status: 'asked' })
    })

    it('rejects no grant, a forged, expired, revoked or wrong-party grant, and an amount over the grant max', async () => {
      const w = world(make())
      const g = await w.grantFor()
      const s = await w.requestFor()
      const b = w.body(s, g)
      expect(await code(w.inbox.submit({ ...b, grant: undefined, grantSig: undefined }))).toBe('bad-request')
      expect(await code(w.inbox.submit(w.body(s, await w.grantFor({}, w.agent))))).toBe('bad-grant')
      expect(
        await code(w.inbox.submit(w.body(s, await w.grantFor({ expiresAt: BigInt(Math.floor(NOW / 1000) - 1) })))),
      ).toBe('grant-expired')
      const other = privateKeyToAccount(generatePrivateKey())
      expect(await code(w.inbox.submit(w.body(s, await w.grantFor({ requester: other.address }))))).toBe('bad-grant')
      expect(await code(w.inbox.submit(w.body(await w.requestFor({ amount: 2_000_000n }), g)))).toBe('over-grant')
      // revoked: only by the owner's session
      const token = await w.session()
      await w.inbox.revoke((await w.inbox.owner(token))!, g.raw.grantId)
      expect(await code(w.inbox.submit(b))).toBe('grant-revoked')
    })

    it('rejects a forged request, a stale one, and oversized input', async () => {
      const w = world(make())
      const g = await w.grantFor()
      const s = await w.requestFor()
      expect(await code(w.inbox.submit({ ...w.body(s, g), sig: (await w.requestFor()).sig }))).toBe('bad-signature')
      const old = await w.requestFor({ createdAt: BigInt(Math.floor(NOW / 1000) - 8 * 86_400) })
      expect(await code(w.inbox.submit(w.body(old, g)))).toBe('expired')
      const big = w.body(s, g)
      expect(await code(w.inbox.submit({ ...big, padding: 'x'.repeat(5000) }))).toBe('too-large')
      expect(
        await code(w.inbox.submit({ ...w.body(s, g), request: { ...w.body(s, g).request, reason: 'y'.repeat(281) } })),
      ).toBe('bad-request')
    })

    it('rate limits: one pending per (payee, chain) per requester, 10 a day, and a cap on an owner’s open requests', async () => {
      const w = world(make(), { perDay: 3, openPerOwner: 100 })
      const g = await w.grantFor()
      expect(await code(w.inbox.submit(w.body(await w.requestFor(), g)))).toBe('ok')
      expect(await code(w.inbox.submit(w.body(await w.requestFor(), g)))).toBe('pending')
      const p2 = privateKeyToAccount(generatePrivateKey()).address
      const p3 = privateKeyToAccount(generatePrivateKey()).address
      const p4 = privateKeyToAccount(generatePrivateKey()).address
      expect(await code(w.inbox.submit(w.body(await w.requestFor({ payee: p2 }), g)))).toBe('ok')
      expect(await code(w.inbox.submit(w.body(await w.requestFor({ payee: p3 }), g)))).toBe('ok')
      expect(await code(w.inbox.submit(w.body(await w.requestFor({ payee: p4 }), g)))).toBe('daily-limit')

      const v = world(make(), { perDay: 100, openPerOwner: 2 })
      const gv = await v.grantFor()
      for (let i = 0; i < 2; i++)
        expect(
          await code(
            v.inbox.submit(
              v.body(await v.requestFor({ payee: privateKeyToAccount(generatePrivateKey()).address }), gv),
            ),
          ),
        ).toBe('ok')
      expect(
        await code(
          v.inbox.submit(v.body(await v.requestFor({ payee: privateKeyToAccount(generatePrivateKey()).address }), gv)),
        ),
      ).toBe('owner-full')
    })

    it('sessions: only the owner’s own signature, and only if fresh (10 minutes)', async () => {
      const w = world(make())
      const token = await w.session()
      expect(await w.inbox.owner(token)).toBe(w.owner.address.toLowerCase())
      const issuedAt = BigInt(Math.floor(NOW / 1000))
      const forged = await w.agent.signTypedData(inboxAccessTypedData(CHAIN, w.owner.address, issuedAt))
      expect(
        await code(
          w.inbox.openSession({
            chainId: String(CHAIN),
            owner: w.owner.address,
            issuedAt: issuedAt.toString(),
            sig: forged,
          }),
        ),
      ).toBe('bad-signature')
      const stale = BigInt(Math.floor(NOW / 1000) - 11 * 60)
      const sig = await w.owner.signTypedData(inboxAccessTypedData(CHAIN, w.owner.address, stale))
      expect(
        await code(
          w.inbox.openSession({ chainId: String(CHAIN), owner: w.owner.address, issuedAt: stale.toString(), sig }),
        ),
      ).toBe('stale')
      expect(await w.inbox.owner('not-a-token')).toBeNull()
    })

    it('self-verifying sessions (with a secret): valid anywhere, tamper-proof, and they expire', async () => {
      const w = world(make())
      const signed = createInbox({
        store: make(),
        now: () => NOW,
        isChain: (id) => id === CHAIN,
        checkApproval: async () => null,
        sessionSecret: 'a-test-secret',
      })
      const issuedAt = BigInt(Math.floor(NOW / 1000))
      const sig = await w.owner.signTypedData(inboxAccessTypedData(CHAIN, w.owner.address, issuedAt))
      const token = await signed.openSession({
        chainId: String(CHAIN),
        owner: w.owner.address,
        issuedAt: issuedAt.toString(),
        sig,
      })
      expect(await signed.owner(token)).toBe(w.owner.address.toLowerCase())
      // another instance with the same secret accepts it; a different secret doesn't
      const other = (secret: string, now = NOW) =>
        createInbox({
          store: make(),
          now: () => now,
          isChain: () => true,
          checkApproval: async () => null,
          sessionSecret: secret,
        })
      expect(await other('a-test-secret').owner(token)).toBe(w.owner.address.toLowerCase())
      expect(await other('another-secret').owner(token)).toBeNull()
      // tampering with the owner breaks the MAC
      const [payload, mac] = token.split('.')
      const forged = Buffer.from(
        Buffer.from(payload!, 'base64url')
          .toString()
          .replace(/^0x[0-9a-f]{40}/, w.agent.address.toLowerCase()),
      ).toString('base64url')
      expect(await signed.owner(`${forged}.${mac}`)).toBeNull()
      // after 24 hours it is no longer valid
      expect(await other('a-test-secret', NOW + 86_401_000).owner(token)).toBeNull()
    })

    it('an owner sees only its own requests', async () => {
      const w = world(make())
      const s = await w.requestFor()
      await w.inbox.submit(w.body(s, await w.grantFor()))
      const mine = await w.inbox.list(w.owner.address)
      expect(mine.map((r) => r.requestId)).toEqual([s.request.requestId])
      expect(mine[0]!.status).toBe('asked')
      const stranger = privateKeyToAccount(generatePrivateKey()).address
      expect(await w.inbox.list(stranger)).toEqual([])
      expect(await code(w.inbox.get(stranger, s.request.requestId))).toBe('not-found')
      expect((await w.inbox.get(w.owner.address, s.request.requestId)).request).toMatchObject({
        owner: w.owner.address,
      })
    })

    it('approval only after the on-chain check (R2); then the (payee, chain) slot is free again', async () => {
      const w = world(make())
      const g = await w.grantFor()
      const s = await w.requestFor()
      await w.inbox.submit(w.body(s, g))
      const approved = { approved: { certificateId: newRequestId(), txHash: newRequestId() } }
      w.refuseApproval('wrong spender')
      expect(await code(w.inbox.decide(w.owner.address, s.request.requestId, approved))).toBe('not-verified')
      expect(await w.inbox.status(s.request.requestId)).toEqual({ status: 'asked' })
      const stranger = privateKeyToAccount(generatePrivateKey()).address
      w.refuseApproval(null)
      expect(await code(w.inbox.decide(stranger, s.request.requestId, approved))).toBe('not-found')
      await w.inbox.decide(w.owner.address, s.request.requestId, approved)
      expect(await w.inbox.status(s.request.requestId)).toEqual({
        status: 'approved',
        certificateId: approved.approved.certificateId,
        decidedAt: Math.floor(NOW / 1000),
      })
      expect(await code(w.inbox.submit(w.body(await w.requestFor(), g)))).toBe('ok')
    })

    it('decline with a note; a decided request can’t be decided again', async () => {
      const w = world(make())
      const s = await w.requestFor()
      await w.inbox.submit(w.body(s, await w.grantFor()))
      await w.inbox.decide(w.owner.address, s.request.requestId, { declined: { note: 'Not this week' } })
      expect(await w.inbox.status(s.request.requestId)).toMatchObject({ status: 'declined' })
      expect(await code(w.inbox.decide(w.owner.address, s.request.requestId, { declined: {} }))).toBe('already-decided')
    })

    it('an unknown request id has no status; requests past 7 days read as expired', async () => {
      const w = world(make())
      expect(await w.inbox.status(newRequestId())).toBeNull()
      const s = await w.requestFor()
      await w.inbox.submit(w.body(s, await w.grantFor()))
      w.setNow(NOW + 7 * 86_400_000 + 1000)
      expect((await w.inbox.status(s.request.requestId))?.status ?? 'expired').toBe('expired')
    })
  })
