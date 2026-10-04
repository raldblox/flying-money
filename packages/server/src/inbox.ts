import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  flyingMoneyAbi,
  type Hex,
  MAX_REQUEST_BYTES,
  readCertificate,
  requestGrantFromParts,
  sameAddress,
  spendRequestFromParts,
  verifyInboxAccess,
  verifyRequestGrant,
  verifySpendRequest,
  ZERO_ID,
} from '@flying-money/core'
import { type PublicClient, parseEventLogs } from 'viem'
import type { RedisEval } from './redis-store.js'

/**
 * The request relay inbox (BUILD_SPEC §21.4.2). An agent posts a budget request signed by its own key together with
 * the owner's grant; the owner reads its inbox after signing in, and approves by funding from its own wallet.
 * R1: nothing here moves money or holds a key. R2: "approved" only after an on-chain check. R3: decisions need the
 * owner's session. R4: request text is stored as given and never interpreted. R5: grants, size limits, rate limits
 * and a 7-day TTL bound the spam.
 */
export type InboxStatus = 'asked' | 'approved' | 'declined' | 'expired'

export interface InboxRecord {
  requestId: Hex
  chainId: number
  /** the request in wire form, exactly as the agent signed it */
  request: Record<string, string>
  sig: Hex
  grantId: Hex
  owner: Hex
  requester: Hex
  payee: Hex
  status: InboxStatus
  /** unix seconds: createdAt + 7 days */
  expiresAt: number
  certificateId?: Hex
  txHash?: Hex
  decidedAt?: number
  note?: string
}

export interface InboxLimits {
  /** requests per requester per UTC day (§21.4.2: 10) */
  perDay: number
  /** open requests per owner (§21.4.2: ≤ 100) */
  openPerOwner: number
}
const DEFAULT_LIMITS: InboxLimits = { perDay: 10, openPerOwner: 100 }
const TTL_SECONDS = 7 * 86_400
const SESSION_SECONDS = 86_400
const ACCESS_WINDOW_SECONDS = 10 * 60

export class InboxError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'InboxError'
  }
}

type PutResult = 'ok' | 'duplicate' | 'pending' | 'owner-full' | 'daily-limit'

export interface InboxStore {
  /** Atomically: not a duplicate, no open request for (requester, payee, chain), owner and daily limits. */
  put(rec: InboxRecord, o: { nowMs: number; ttlSeconds: number; day: string; limits: InboxLimits }): Promise<PutResult>
  get(requestId: Hex): Promise<InboxRecord | null>
  /** `nowMs` is the inbox's clock, so pruning agrees with expiry checks (defaults to the real time). */
  list(owner: Hex, o?: { nowMs: number }): Promise<InboxRecord[]>
  /** Saves a decided record (keeping its expiry) and frees its slot. */
  decide(rec: InboxRecord): Promise<boolean>
  revoke(owner: Hex, grantId: Hex): Promise<void>
  isRevoked(owner: Hex, grantId: Hex): Promise<boolean>
  putSession(tokenHash: string, owner: Hex, ttlSeconds: number): Promise<void>
  getSession(tokenHash: string): Promise<Hex | null>
}

const lower = (a: string) => a.toLowerCase() as Hex
const slotOf = (r: InboxRecord) => `${lower(r.requester)}:${lower(r.payee)}:${r.chainId}`
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex')

export function createInbox(opts: {
  store: InboxStore
  /** Verifies on-chain that the owner funded this request (R2); returns a refusal reason, or null when it checks out. */
  checkApproval: (rec: InboxRecord, a: { certificateId: Hex; txHash: Hex }) => Promise<string | null>
  /** chains this relay serves */
  isChain: (chainId: number) => boolean
  now?: () => number
  limits?: Partial<InboxLimits> | undefined
  /**
   * With a secret, sessions are self-verifying tokens (owner and expiry, HMAC-SHA256), valid on every instance with no
   * session storage. Without one, sessions are kept in the store.
   */
  sessionSecret?: string | undefined
}) {
  const { store } = opts
  const now = opts.now ?? Date.now
  const limits = { ...DEFAULT_LIMITS, ...opts.limits }
  const nowS = () => Math.floor(now() / 1000)
  const mac = (payload: string) =>
    createHmac('sha256', `fm-inbox-session|${opts.sessionSecret}`).update(payload).digest('base64url')
  const view = (r: InboxRecord): InboxRecord =>
    r.status === 'asked' && nowS() > r.expiresAt ? { ...r, status: 'expired' } : r

  return {
    async submit(body: unknown): Promise<{ requestId: Hex; status: 'asked' }> {
      let size = 0
      try {
        size = new TextEncoder().encode(JSON.stringify(body)).length
      } catch {
        throw new InboxError(400, 'bad-request')
      }
      if (size > MAX_REQUEST_BYTES) throw new InboxError(413, 'too-large')
      const b = body as Record<string, unknown> | null
      if (!b || typeof b !== 'object' || !b.request || !b.sig || !b.grant || !b.grantSig)
        throw new InboxError(400, 'bad-request', 'expected { chainId, request, sig, grant, grantSig }')
      let signed: ReturnType<typeof spendRequestFromParts>
      let grant: ReturnType<typeof requestGrantFromParts>
      try {
        signed = spendRequestFromParts(b.chainId, b.request, b.sig)
        grant = requestGrantFromParts(b.chainId, b.grant, b.grantSig)
      } catch (e) {
        throw new InboxError(400, 'bad-request', (e as Error).message)
      }
      const r = signed.request
      if (!opts.isChain(signed.chainId)) throw new InboxError(400, 'bad-request', 'unknown chain')
      if (!verifySpendRequest(signed)) throw new InboxError(401, 'bad-signature')
      if (!verifyRequestGrant(grant)) throw new InboxError(403, 'bad-grant')
      const g = grant.grant
      if (!sameAddress(g.requester, r.requester) || !sameAddress(g.owner, r.owner))
        throw new InboxError(403, 'bad-grant', 'the grant is for another agent or owner')
      if (BigInt(nowS()) > g.expiresAt) throw new InboxError(403, 'grant-expired')
      if (await store.isRevoked(lower(g.owner), g.grantId)) throw new InboxError(403, 'grant-revoked')
      if (r.amount > g.maxAmountPerRequest) throw new InboxError(403, 'over-grant')
      const created = Number(r.createdAt)
      if (nowS() - created > TTL_SECONDS) throw new InboxError(410, 'expired')
      if (created - nowS() > 300) throw new InboxError(400, 'bad-request', 'createdAt is in the future')
      const rec: InboxRecord = {
        requestId: lower(r.requestId),
        chainId: signed.chainId,
        request: b.request as Record<string, string>,
        sig: signed.sig,
        grantId: g.grantId,
        owner: lower(r.owner),
        requester: lower(r.requester),
        payee: lower(r.payee),
        status: 'asked',
        expiresAt: created + TTL_SECONDS,
      }
      const res = await store.put(rec, {
        nowMs: now(),
        ttlSeconds: Math.max(60, rec.expiresAt - nowS()),
        day: new Date(now()).toISOString().slice(0, 10),
        limits,
      })
      if (res === 'duplicate') throw new InboxError(409, 'duplicate')
      if (res !== 'ok') throw new InboxError(429, res)
      return { requestId: r.requestId, status: 'asked' }
    },

    /** Public minimal status (§21.4.2); the request id is unguessable. */
    async status(requestId: string) {
      if (!/^0x[0-9a-fA-F]{64}$/.test(requestId)) return null
      const rec = await store.get(lower(requestId))
      if (!rec) return null
      const v = view(rec)
      if (v.status === 'approved') return { status: v.status, certificateId: v.certificateId, decidedAt: v.decidedAt }
      if (v.status === 'declined') return { status: v.status, decidedAt: v.decidedAt }
      return { status: v.status }
    },

    /** InboxAccess signed by the owner, fresh (10 minutes) → a session token for 24 h. */
    async openSession(body: unknown): Promise<string> {
      const b = body as { chainId?: unknown; owner?: unknown; issuedAt?: unknown; sig?: unknown } | null
      const chainId = Number(b?.chainId)
      const owner = typeof b?.owner === 'string' ? b.owner : ''
      const issuedAt = typeof b?.issuedAt === 'string' && /^\d{1,19}$/.test(b.issuedAt) ? BigInt(b.issuedAt) : null
      const sig = typeof b?.sig === 'string' ? b.sig : ''
      if (
        !opts.isChain(chainId) ||
        !/^0x[0-9a-fA-F]{40}$/.test(owner) ||
        issuedAt === null ||
        !/^0x[0-9a-fA-F]{130}$/.test(sig)
      )
        throw new InboxError(400, 'bad-request')
      if (!verifyInboxAccess(chainId, owner as Hex, issuedAt, sig as Hex)) throw new InboxError(401, 'bad-signature')
      const age = nowS() - Number(issuedAt)
      if (age > ACCESS_WINDOW_SECONDS || age < -60) throw new InboxError(401, 'stale')
      if (opts.sessionSecret) {
        const payload = Buffer.from(
          `${lower(owner)}.${nowS() + SESSION_SECONDS}.${randomBytes(9).toString('base64url')}`,
        ).toString('base64url')
        return `${payload}.${mac(payload)}`
      }
      const token = randomBytes(32).toString('base64url')
      await store.putSession(hashToken(token), lower(owner), SESSION_SECONDS)
      return token
    },

    async owner(token: string | undefined | null): Promise<Hex | null> {
      if (!token || token.length > 200) return null
      if (opts.sessionSecret) {
        const [payload, sig] = token.split('.')
        if (!payload || !sig) return null
        const want = Buffer.from(mac(payload))
        const got = Buffer.from(sig)
        if (want.length !== got.length || !timingSafeEqual(want, got)) return null
        const [who, exp] = Buffer.from(payload, 'base64url').toString().split('.')
        if (!who || !/^0x[0-9a-f]{40}$/.test(who) || !(Number(exp) > nowS())) return null
        return who as Hex
      }
      return store.getSession(hashToken(token))
    },

    async list(owner: Hex): Promise<InboxRecord[]> {
      const all = await store.list(lower(owner), { nowMs: now() })
      return all
        .filter((r) => r.owner === lower(owner))
        .map(view)
        .sort((a, b) => Number(b.request.createdAt) - Number(a.request.createdAt))
    },

    async get(owner: Hex, requestId: string): Promise<InboxRecord> {
      const rec = /^0x[0-9a-fA-F]{64}$/.test(requestId) ? await store.get(lower(requestId)) : null
      if (!rec || rec.owner !== lower(owner)) throw new InboxError(404, 'not-found')
      return view(rec)
    },

    async decide(
      owner: Hex,
      requestId: string,
      d: { approved?: { certificateId?: unknown; txHash?: unknown }; declined?: { note?: unknown } },
    ): Promise<InboxRecord> {
      const rec = await this.get(owner, requestId)
      if (rec.status !== 'asked') throw new InboxError(409, rec.status === 'expired' ? 'expired' : 'already-decided')
      if (d?.approved) {
        const { certificateId, txHash } = d.approved
        if (
          typeof certificateId !== 'string' ||
          !/^0x[0-9a-fA-F]{64}$/.test(certificateId) ||
          typeof txHash !== 'string' ||
          !/^0x[0-9a-fA-F]{64}$/.test(txHash)
        )
          throw new InboxError(400, 'bad-request', 'approved needs { certificateId, txHash }')
        const refusal = await opts.checkApproval(rec, { certificateId: certificateId as Hex, txHash: txHash as Hex })
        if (refusal) throw new InboxError(409, 'not-verified', refusal)
        const next: InboxRecord = {
          ...rec,
          status: 'approved',
          certificateId: lower(certificateId),
          txHash: lower(txHash),
          decidedAt: nowS(),
        }
        await store.decide(next)
        return next
      }
      if (d?.declined) {
        const note = d.declined.note
        if (note !== undefined && (typeof note !== 'string' || [...note].length > 280))
          throw new InboxError(400, 'bad-request', 'note: at most 280 characters')
        const next: InboxRecord = { ...rec, status: 'declined', decidedAt: nowS(), ...(note ? { note } : {}) }
        await store.decide(next)
        return next
      }
      throw new InboxError(400, 'bad-request', 'expected { approved } or { declined }')
    },

    async revoke(owner: Hex, grantId: string): Promise<void> {
      if (!/^0x[0-9a-fA-F]{64}$/.test(grantId)) throw new InboxError(400, 'bad-request')
      await store.revoke(lower(owner), lower(grantId))
    },
  }
}
export type Inbox = ReturnType<typeof createInbox>

/**
 * R2: a request is approved only if this transaction, on its chain, funded exactly it: a CertificateIssued (or, for a
 * top-up, CertificateToppedUp) for `certificateId`, from the owner, spendable by the requester, payable to the
 * requested payee, with a positive amount.
 */
export function onChainApproval(
  clientFor: (chainId: number) => { pub: PublicClient; contract: Hex } | undefined,
): (rec: InboxRecord, a: { certificateId: Hex; txHash: Hex }) => Promise<string | null> {
  return async (rec, a) => {
    const c = clientFor(rec.chainId)
    if (!c) return 'unknown chain'
    const receipt = await c.pub.getTransactionReceipt({ hash: a.txHash }).catch(() => null)
    if (!receipt) return 'transaction not found (yet)'
    if (receipt.status !== 'success') return 'the transaction failed'
    const logs = receipt.logs.filter((l) => sameAddress(l.address, c.contract))
    const topUp = rec.request.certificateId !== ZERO_ID
    if (!topUp) {
      const ev = parseEventLogs({ abi: flyingMoneyAbi, logs, eventName: 'CertificateIssued' }).find((l) =>
        sameAddress(l.args.id, a.certificateId),
      )
      if (!ev) return 'no budget was created with that id in this transaction'
      if (!sameAddress(ev.args.funder, rec.owner)) return 'wrong funder'
      if (!sameAddress(ev.args.spender, rec.requester)) return 'wrong spender'
      if (!sameAddress(ev.args.payee, rec.payee)) return 'wrong payee'
      if (ev.args.faceValue <= 0n) return 'empty budget'
      return null
    }
    if (!sameAddress(a.certificateId, rec.request.certificateId as Hex)) return 'not the budget this request tops up'
    const ev = parseEventLogs({ abi: flyingMoneyAbi, logs, eventName: 'CertificateToppedUp' }).find((l) =>
      sameAddress(l.args.id, a.certificateId),
    )
    if (!ev || ev.args.amount <= 0n) return 'no top-up of that budget in this transaction'
    const cert = await readCertificate(c.pub, c.contract, a.certificateId)
    if (!cert) return 'budget not found'
    if (!sameAddress(cert.funder, rec.owner)) return 'wrong funder'
    if (!sameAddress(cert.spender, rec.requester)) return 'wrong spender'
    if (!sameAddress(cert.payee, rec.payee)) return 'wrong payee'
    return null
  }
}

// ───────── stores ─────────

export function memoryInboxStore(): InboxStore {
  const recs = new Map<string, InboxRecord>()
  const slots = new Map<string, string>()
  const days = new Map<string, number>()
  const revoked = new Set<string>()
  const sessions = new Map<string, { owner: Hex; until: number }>()
  const openFor = (owner: Hex, nowMs: number) =>
    [...recs.values()].filter((r) => r.owner === owner && r.status === 'asked' && r.expiresAt * 1000 > nowMs).length
  return {
    async put(rec, o) {
      if (recs.has(rec.requestId)) return 'duplicate'
      const s = slots.get(slotOf(rec))
      const held = s ? recs.get(s) : undefined
      if (held && held.status === 'asked' && held.expiresAt * 1000 > o.nowMs) return 'pending'
      if (openFor(rec.owner, o.nowMs) >= o.limits.openPerOwner) return 'owner-full'
      const dk = `${rec.requester}:${o.day}`
      if ((days.get(dk) ?? 0) >= o.limits.perDay) return 'daily-limit'
      recs.set(rec.requestId, rec)
      slots.set(slotOf(rec), rec.requestId)
      days.set(dk, (days.get(dk) ?? 0) + 1)
      return 'ok'
    },
    async get(id) {
      return recs.get(id) ?? null
    },
    async list(owner) {
      return [...recs.values()].filter((r) => r.owner === owner)
    },
    async decide(rec) {
      if (!recs.has(rec.requestId)) return false
      recs.set(rec.requestId, rec)
      if (slots.get(slotOf(rec)) === rec.requestId) slots.delete(slotOf(rec))
      return true
    },
    async revoke(owner, grantId) {
      revoked.add(`${owner}:${grantId}`)
    },
    async isRevoked(owner, grantId) {
      return revoked.has(`${owner}:${lower(grantId)}`)
    },
    async putSession(h, owner, ttl) {
      sessions.set(h, { owner, until: Date.now() + ttl * 1000 })
    },
    async getSession(h) {
      const s = sessions.get(h)
      return s && s.until > Date.now() ? s.owner : null
    },
  }
}

// Redis layout (§21.5 prefix {p}): rq:{id} (JSON, EX 7 d), rq:slot:{requester}:{payee}:{chain} (id, EX),
// rq:owner:{owner} (zset of ids by expiry, ms), rq:open:{owner} (zset of undecided ids by expiry),
// rl:rq-day:{requester}:{day} (count, EX 1 d), grant-revoked:{owner}:{grantId}, sess:{sha256(token)} (EX 24 h).
const PUT = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 'duplicate' end
if redis.call('EXISTS', KEYS[2]) == 1 then return 'pending' end
redis.call('ZREMRANGEBYSCORE', KEYS[4], '-inf', ARGV[4])
if redis.call('ZCARD', KEYS[4]) >= tonumber(ARGV[6]) then return 'owner-full' end
local d = tonumber(redis.call('GET', KEYS[5]) or '0')
if d >= tonumber(ARGV[7]) then return 'daily-limit' end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
redis.call('ZADD', KEYS[3], ARGV[5], ARGV[2])
redis.call('ZADD', KEYS[4], ARGV[5], ARGV[2])
redis.call('INCR', KEYS[5])
if d == 0 then redis.call('EXPIRE', KEYS[5], 172800) end
return 'ok'`
const DECIDE = `
local t = redis.call('TTL', KEYS[1])
if t <= 0 then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', t)
if redis.call('GET', KEYS[2]) == ARGV[2] then redis.call('DEL', KEYS[2]) end
redis.call('ZREM', KEYS[3], ARGV[2])
return 1`
const IDS = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
return redis.call('ZRANGE', KEYS[1], 0, 199)`
const MGET = `local out = {} for i, k in ipairs(KEYS) do out[i] = redis.call('GET', k) or '' end return out`
const GET = `return redis.call('GET', KEYS[1])`
const SETEX = `redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2]) return 1`

export function redisInboxStore(r: RedisEval, prefix: string): InboxStore {
  const k = {
    rec: (id: string) => `${prefix}rq:${id}`,
    slot: (rec: InboxRecord) => `${prefix}rq:slot:${slotOf(rec)}`,
    owner: (o: string) => `${prefix}rq:owner:${o}`,
    open: (o: string) => `${prefix}rq:open:${o}`,
    day: (req: string, day: string) => `${prefix}rl:rq-day:${req}:${day}`,
    revoked: (o: string, g: string) => `${prefix}grant-revoked:${o}:${g}`,
    sess: (h: string) => `${prefix}sess:${h}`,
  }
  // a missing key comes back as null, '' or false depending on the client
  const str = (v: unknown) => (v === null || v === undefined || v === '' || v === false ? null : String(v))
  return {
    async put(rec, o) {
      const res = await r.eval(
        PUT,
        [k.rec(rec.requestId), k.slot(rec), k.owner(rec.owner), k.open(rec.owner), k.day(rec.requester, o.day)],
        [
          JSON.stringify(rec),
          rec.requestId,
          String(o.ttlSeconds),
          String(o.nowMs),
          String(rec.expiresAt * 1000),
          String(o.limits.openPerOwner),
          String(o.limits.perDay),
        ],
      )
      return String(res) as PutResult
    },
    async get(id) {
      const v = str(await r.eval(GET, [k.rec(id)], []))
      return v ? (JSON.parse(v) as InboxRecord) : null
    },
    async list(owner, o) {
      // keep decided records until they expire; drop ids whose record expired
      const nowMs = o?.nowMs ?? Date.now()
      const ids = ((await r.eval(IDS, [k.owner(owner)], [String(nowMs - 60_000)])) as unknown[]).map(String)
      if (ids.length === 0) return []
      const vals = (await r.eval(MGET, ids.map(k.rec), [])) as unknown[]
      return vals
        .map(str)
        .filter((v): v is string => v !== null)
        .map((v) => JSON.parse(v) as InboxRecord)
    },
    async decide(rec) {
      const n = await r.eval(
        DECIDE,
        [k.rec(rec.requestId), k.slot(rec), k.open(rec.owner)],
        [JSON.stringify(rec), rec.requestId],
      )
      return Number(n) === 1
    },
    async revoke(owner, grantId) {
      await r.eval(SETEX, [k.revoked(owner, lower(grantId))], ['1', String(400 * 86_400)])
    },
    async isRevoked(owner, grantId) {
      return str(await r.eval(GET, [k.revoked(owner, lower(grantId))], [])) !== null
    },
    async putSession(h, owner, ttl) {
      await r.eval(SETEX, [k.sess(h)], [owner, String(ttl)])
    },
    async getSession(h) {
      return str(await r.eval(GET, [k.sess(h)], [])) as Hex | null
    },
  }
}
