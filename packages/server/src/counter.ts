import { type ChainKey, getChain, rpcUrl } from '@flying-money/chains'
import {
  type Certificate,
  counterRequestId,
  decodeNote,
  decodeOffer,
  encodeHeader,
  type Hex,
  type Offer,
  readCertificate,
  type SignedNote,
} from '@flying-money/core'
import { createPublicClient, http, type PublicClient } from 'viem'
import { type CertificateReader, createFlyingMoneyServer, type HandleResult, type OfferReason } from './server.js'
import type { NoteStore } from './store.js'

/**
 * Shop till (BUILD_SPEC §6.8, §12.5): the §6.5 seller logic run against the till's own durable store, with the
 * counter acceptance statuses. "Service" is handing over the goods, so execution always succeeds.
 *
 * - GUARANTEED: the certificate was read on-chain by this till (now or earlier, cached durably) and the note
 *   passed §6.5 against the till's authoritative local state.
 * - UNVERIFIED · merchant risk: offline, certificate never seen by this till. NOT a Flying Money guarantee; capped
 *   per certificate by the shop's first-visit limit and till-wide by the offline float (D34), kept out of the
 *   guaranteed ledger, re-checked on reconnect.
 * - REJECTED: with a reason.
 */
export type CounterStatus = 'GUARANTEED' | 'UNVERIFIED' | 'REJECTED'

export type RejectReason =
  | Exclude<OfferReason, 'no-note' | 'unsupported-chain'>
  | 'wrong-chain'
  | 'malformed'
  | 'bad-signature'
  | 'different-order'
  | 'over-first-visit-limit'
  | 'over-offline-float'
  | 'flagged'

export interface CounterResult {
  status: CounterStatus
  /** True when this QR was already processed (same order): the stored outcome is shown again. */
  replay: boolean
  requestId?: Hex
  certificateId?: Hex
  price: bigint
  /** GUARANTEED: face value minus everything this till has accepted on the certificate. */
  remaining?: bigint
  expiresAt?: bigint
  /** UNVERIFIED: the most this till can lose on this certificate. */
  riskLimit?: bigint
  /** Offline acceptance (UNVERIFIED, or refused for the float): how much of the till's offline float is left. */
  floatLeft?: bigint
  reason?: RejectReason
}

export interface UnverifiedRecord {
  requestId: Hex
  certificateId: Hex
  noteHeader: string
  price: string
  orderId: string
  at: number
  state: 'UNVERIFIED' | 'PROMOTED' | 'FLAGGED'
  reason?: RejectReason
}

/** Small durable key-value store (IndexedDB in the browser). `set` MUST be durable when it resolves. */
export interface CounterKV {
  get(key: string): Promise<string | undefined>
  set(key: string, value: string): Promise<void>
  keys(prefix: string): Promise<string[]>
}

export function memoryKV(): CounterKV {
  const m = new Map<string, string>()
  return {
    async get(k) {
      return m.get(k)
    },
    async set(k, v) {
      m.set(k, v)
    },
    async keys(p) {
      return [...m.keys()].filter((k) => k.startsWith(p))
    },
  }
}

export interface CounterConfig {
  chain: ChainKey
  payee: Hex
  /** The till's authoritative seller state: memoryStore({ initial, onCommit }) persisted to IndexedDB. */
  store: NoteStore
  kv: CounterKV
  /** Shop-set cap on unverified value per certificate (default 5 USDC in the UI). */
  firstVisitLimit: bigint
  /**
   * Per-device offline float (§6.8, §12.5; D34): the most this till accepts UNVERIFIED in total, across all
   * certificates, until reconnecting resolves them. Certificate ids can be made up offline, so the per-certificate
   * limit alone doesn't bound the loss.
   */
  offlineFloat: bigint
  env?: Record<string, string | undefined>
  readCertificate?: CertificateReader
  now?: () => number
}

const certJson = (c: Certificate) =>
  JSON.stringify({
    ...c,
    faceValue: c.faceValue.toString(),
    redeemed: c.redeemed.toString(),
    expiresAt: c.expiresAt.toString(),
  })
const certParse = (s: string): Certificate => {
  const j = JSON.parse(s) as Record<string, string | boolean>
  return {
    id: j.id as Hex,
    funder: j.funder as Hex,
    payee: j.payee as Hex,
    spender: j.spender as Hex,
    faceValue: BigInt(j.faceValue as string),
    redeemed: BigInt(j.redeemed as string),
    expiresAt: BigInt(j.expiresAt as string),
    closed: j.closed as boolean,
  }
}

export function createCounter(cfg: CounterConfig) {
  const { kv, store } = cfg
  const c = getChain(cfg.chain)
  if (!c.flyingMoney) throw new Error(`No FlyingMoney deployment for ${cfg.chain} in @flying-money/chains`)

  // Certificates read on-chain are cached durably: that is what "verified by this shop earlier" means (§6.8).
  const base: CertificateReader =
    cfg.readCertificate ??
    (() => {
      const client = createPublicClient({ transport: http(rpcUrl(cfg.chain, cfg.env ?? {})) }) as PublicClient
      return (_chainId, contract, id) => readCertificate(client, contract, id)
    })()
  const reader: CertificateReader = async (chainId, contract, id) => {
    const k = `cert:${id.toLowerCase()}`
    try {
      const got = await base(chainId, contract, id)
      if (got) await kv.set(k, certJson(got))
      return got
    } catch (e) {
      const cached = await kv.get(k)
      if (cached) return certParse(cached)
      throw e
    }
  }
  const server = createFlyingMoneyServer({
    accepts: [cfg.chain],
    payee: cfg.payee,
    store,
    readCertificate: reader,
    ...(cfg.env ? { env: cfg.env } : {}),
    ...(cfg.now ? { now: cfg.now } : {}),
  })
  const priceQr = (price: bigint, orderId: string) => encodeHeader(server.offer(price, orderId))

  function decodePrice(qr: string): Offer {
    return decodeOffer(qr)
  }

  const unvKey = (rid: Hex) => `unv:${rid.toLowerCase()}`
  async function getUnverified(rid: Hex): Promise<UnverifiedRecord | null> {
    const s = await kv.get(unvKey(rid))
    return s ? (JSON.parse(s) as UnverifiedRecord) : null
  }
  async function unverified(): Promise<UnverifiedRecord[]> {
    const out: UnverifiedRecord[] = []
    for (const k of await kv.keys('unv:')) {
      const s = await kv.get(k)
      if (s) out.push(JSON.parse(s) as UnverifiedRecord)
    }
    return out.sort((a, b) => a.at - b.at)
  }

  const reject = (price: bigint, reason: RejectReason, note?: SignedNote): CounterResult => ({
    status: 'REJECTED',
    replay: false,
    price,
    reason,
    ...(note ? { requestId: note.memo, certificateId: note.certificateId } : {}),
  })

  function fromHandle(r: HandleResult, price: bigint, note: SignedNote): CounterResult | 'offline' {
    if (r.kind === 'served')
      return {
        status: 'GUARANTEED',
        replay: r.replay,
        price: r.ctx.price,
        requestId: r.ctx.requestId,
        certificateId: r.ctx.certificateId,
        remaining: r.receipt.remaining,
        expiresAt: r.receipt.expiresAt,
      }
    if (r.kind === 'offer') {
      const reason = r.reason === 'no-note' ? 'malformed' : r.reason === 'unsupported-chain' ? 'wrong-chain' : r.reason
      return reject(price, reason, note)
    }
    if (r.kind === 'error') {
      if (r.status === 503) return 'offline'
      return reject(price, r.status === 401 ? 'bad-signature' : 'malformed', note)
    }
    return reject(price, 'malformed', note) // 'failed' cannot happen: handing over goods always succeeds
  }

  const handOver = async () => ({ ok: true })

  /** Scan result for the current order (§6.8 step 3). Re-scanning the same QR returns the same outcome. */
  async function accept(noteQr: string, price: bigint, orderId: string): Promise<CounterResult> {
    let note: SignedNote
    try {
      note = decodeNote(noteQr.trim())
    } catch {
      return reject(price, 'malformed')
    }
    // the note must be sealed for THIS order, or an old QR could be replayed as payment for a new one
    if (note.memo.toLowerCase() !== counterRequestId(orderId).toLowerCase())
      return reject(price, 'different-order', note)

    const prior = await getUnverified(note.memo)
    if (prior?.state === 'UNVERIFIED')
      return {
        status: 'UNVERIFIED',
        replay: true,
        price: BigInt(prior.price),
        requestId: note.memo,
        certificateId: note.certificateId,
        riskLimit: cfg.firstVisitLimit,
      }
    if (prior?.state === 'FLAGGED') return { ...reject(BigInt(prior.price), 'flagged', note), replay: true }

    const r = fromHandle(await server.handle({ noteHeader: noteQr.trim(), price }, handOver), price, note)
    if (r !== 'offline') return r

    // Offline and never verified by this till: the shop's own credit decision, capped per certificate and till-wide.
    const openAll = (await unverified()).filter((u) => u.state === 'UNVERIFIED')
    const tillExposure = openAll.reduce((s, u) => s + BigInt(u.price), 0n)
    const floatLeft = cfg.offlineFloat > tillExposure ? cfg.offlineFloat - tillExposure : 0n
    if (price > floatLeft) return { ...reject(price, 'over-offline-float', note), floatLeft }
    const open = openAll.filter((u) => u.certificateId.toLowerCase() === note.certificateId.toLowerCase())
    const exposure = open.reduce((s, u) => s + BigInt(u.price), 0n) + price
    if (exposure > cfg.firstVisitLimit || note.cumulative < exposure)
      return reject(price, exposure > cfg.firstVisitLimit ? 'over-first-visit-limit' : 'insufficient', note)
    const rec: UnverifiedRecord = {
      requestId: note.memo,
      certificateId: note.certificateId,
      noteHeader: noteQr.trim(),
      price: price.toString(),
      orderId,
      at: Date.now(),
      state: 'UNVERIFIED',
    }
    await kv.set(unvKey(note.memo), JSON.stringify(rec))
    return {
      status: 'UNVERIFIED',
      replay: false,
      price,
      requestId: note.memo,
      certificateId: note.certificateId,
      riskLimit: cfg.firstVisitLimit,
      floatLeft: floatLeft - price,
    }
  }

  /** On reconnect: run each UNVERIFIED note through §6.5; promote it to GUARANTEED or flag it. */
  async function reconcile() {
    let promoted = 0
    let flagged = 0
    let waiting = 0
    for (const u of await unverified()) {
      if (u.state !== 'UNVERIFIED') continue
      const note = decodeNote(u.noteHeader)
      const r = fromHandle(
        await server.handle({ noteHeader: u.noteHeader, price: BigInt(u.price) }, handOver),
        BigInt(u.price),
        note,
      )
      if (r === 'offline') {
        waiting++
        continue
      }
      const next: UnverifiedRecord =
        r.status === 'GUARANTEED'
          ? { ...u, state: 'PROMOTED' }
          : { ...u, state: 'FLAGGED', ...(r.reason ? { reason: r.reason } : {}) }
      await kv.set(unvKey(u.requestId), JSON.stringify(next))
      if (next.state === 'PROMOTED') promoted++
      else flagged++
    }
    return { promoted, flagged, waiting }
  }

  return { priceQr, decodePrice, accept, reconcile, unverified, store, server, accepts: server.accepts }
}

export type Counter = ReturnType<typeof createCounter>
