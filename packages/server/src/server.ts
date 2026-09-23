import { type ChainKey, getChain, rpcUrl } from '@flying-money/chains'
import {
  type Accept,
  type Certificate,
  type CertKey,
  certKey,
  decodeNote,
  type Hex,
  maxBig,
  type Offer,
  type Receipt,
  readCertificate,
  type SignedNote,
  sameAddress,
  verifyNoteSignature,
} from '@flying-money/core'
import { createPublicClient, http, type PublicClient } from 'viem'
import { NoStateError, type NoteStore, type Outcome } from './store.js'

export type AppStatus = 'done' | 'not-started' | 'running' | 'failed'

export interface PaymentContext {
  requestId: Hex
  certificateId: Hex
  chainId: number
  price: bigint
  payee: Hex
  key: CertKey
}

/** The application's result. `responseRef` is stored so replays of a SERVED request return it (S1). */
export interface ExecResult {
  ok: boolean
  responseRef?: string
}

export type OfferReason =
  | 'no-note'
  | 'unsupported-chain'
  | 'unknown-certificate'
  | 'wrong-payee'
  | 'closed'
  | 'expiring'
  | 'insufficient'

export type HandleResult =
  | { kind: 'offer'; status: 402; offer: Offer; reason: OfferReason }
  | { kind: 'error'; status: 400 | 401 | 503; error: string }
  | { kind: 'served'; status: 200; receipt: Receipt; result: ExecResult; replay: boolean; ctx: PaymentContext }
  | { kind: 'failed'; status: 502; receipt: Receipt; replay: boolean; ctx: PaymentContext }

export type CertificateReader = (chainId: number, contract: Hex, id: Hex) => Promise<Certificate | null>

export interface FlyingMoneyServerConfig {
  /** Registry keys; each must have a deployment (packages/chains). */
  accepts: ChainKey[]
  /** Same payee address on every EVM chain. */
  payee: Hex
  store: NoteStore
  /** Seconds. Default 3600 (§6.7). */
  minRemainingLifetime?: number
  suggestedFaceValue?: bigint
  docs?: string
  /** RPC overrides (RPC_<KEY>), e.g. process.env. */
  env?: Record<string, string | undefined>
  /** Override chain reads (tests, custom/multi-RPC verification). */
  readCertificate?: CertificateReader
  /** Unix seconds. */
  now?: () => number
  /** PENDING records older than this are resolved by the sweeper. Default 10 min (§6.5 step 10). */
  pendingTimeoutMs?: number
  /**
   * The application's idempotency status for a requestId (§6.5 step 8/10). Without it the sweeper resolves stale
   * PENDING records as failed (credit to the buyer) — buyer-safe, at the seller's risk.
   */
  requestStatus?: (requestId: Hex, key: CertKey) => Promise<AppStatus>
}

export interface FlyingMoneyServer {
  offer(price: bigint, memoHint?: string): Offer
  handle(
    input: { noteHeader: string | null | undefined; price: bigint },
    execute: (ctx: PaymentContext) => Promise<ExecResult>,
  ): Promise<HandleResult>
  sweep(): Promise<{ resolved: number; running: number }>
  startSweeper(intervalMs?: number): () => void
  /** Cached certificate read (conservative, §6.2). */
  certificate(chainId: number, id: Hex, fresh?: boolean): Promise<Certificate | null>
  accepts: Accept[]
  config: Readonly<FlyingMoneyServerConfig>
}

export function createFlyingMoneyServer(config: FlyingMoneyServerConfig): FlyingMoneyServer {
  const minLife = BigInt(config.minRemainingLifetime ?? 3600)
  const now = () => BigInt(Math.floor(config.now ? config.now() : Date.now() / 1000))
  const store = config.store

  const accepts: Accept[] = config.accepts.map((k) => {
    const c = getChain(k)
    if (!c.flyingMoney) throw new Error(`No FlyingMoney deployment for ${k} in @flying-money/chains`)
    return { chainId: c.chain.id, contract: c.flyingMoney, token: c.usdc, payee: config.payee }
  })

  const clients = new Map<number, PublicClient>()
  const reader: CertificateReader =
    config.readCertificate ??
    (async (chainId, contract, id) => {
      let client = clients.get(chainId)
      if (!client) {
        const key = config.accepts.find((k) => getChain(k).chain.id === chainId)!
        client = createPublicClient({ transport: http(rpcUrl(key, config.env ?? {})) }) as PublicClient
        clients.set(chainId, client)
      }
      return readCertificate(client, contract, id)
    })

  // Certificate cache (§6.2): payee/spender never change; faceValue/expiresAt/redeemed only increase.
  const cache = new Map<CertKey, Certificate>()
  async function certificate(chainId: number, id: Hex, fresh = false): Promise<Certificate | null> {
    const key = certKey(chainId, id)
    const cached = cache.get(key)
    if (cached && !fresh) return cached
    const acc = accepts.find((a) => a.chainId === chainId)
    if (!acc) return null
    const c = await reader(chainId, acc.contract, id)
    if (!c) return cached ?? null
    const merged: Certificate = cached
      ? {
          ...c,
          faceValue: maxBig(c.faceValue, cached.faceValue),
          expiresAt: maxBig(c.expiresAt, cached.expiresAt),
          redeemed: maxBig(c.redeemed, cached.redeemed),
          closed: c.closed || cached.closed,
        }
      : c
    cache.set(key, merged)
    return merged
  }

  function offer(price: bigint, memoHint?: string): Offer {
    return {
      scheme: 'flying-money',
      v: 1,
      price,
      minRemainingLifetime: Number(minLife),
      accepts,
      ...(config.suggestedFaceValue !== undefined ? { suggestedFaceValue: config.suggestedFaceValue } : {}),
      ...(memoHint !== undefined ? { memoHint } : {}),
      ...(config.docs !== undefined ? { docs: config.docs } : {}),
    }
  }

  const offerResult = (price: bigint, reason: OfferReason): HandleResult => ({
    kind: 'offer',
    status: 402,
    offer: offer(price),
    reason,
  })

  async function receipt(key: CertKey, cert: Certificate, requestId: Hex, status: Receipt['status']): Promise<Receipt> {
    const st = (await store.state(key)) ?? { accepted: 0n, consumed: 0n, reserved: 0n }
    return {
      certificateId: cert.id,
      requestId,
      status,
      accepted: st.accepted,
      consumed: st.consumed,
      reserved: st.reserved,
      credit: st.accepted - st.consumed - st.reserved,
      remaining: cert.faceValue - st.accepted,
      expiresAt: cert.expiresAt,
    }
  }

  async function fromOutcome(
    o: Outcome,
    ctx: PaymentContext,
    cert: Certificate,
    execute: (ctx: PaymentContext) => Promise<ExecResult>,
    fresh?: ExecResult,
  ): Promise<HandleResult> {
    if (o.status === 'PENDING') return run({ ...ctx, price: o.price }, cert, execute)
    const r = await receipt(ctx.key, cert, ctx.requestId, o.status)
    if (o.status === 'SERVED') {
      const result: ExecResult = {
        ok: true,
        ...(o.responseRef !== undefined
          ? { responseRef: o.responseRef }
          : fresh?.responseRef
            ? { responseRef: fresh.responseRef }
            : {}),
      }
      return { kind: 'served', status: 200, receipt: r, result, replay: true, ctx: { ...ctx, price: o.price } }
    }
    return { kind: 'failed', status: 502, receipt: r, replay: true, ctx: { ...ctx, price: o.price } }
  }

  // §6.5 steps 8–9: execute, then finish atomically (only from PENDING).
  async function run(
    ctx: PaymentContext,
    cert: Certificate,
    execute: (ctx: PaymentContext) => Promise<ExecResult>,
  ): Promise<HandleResult> {
    let res: ExecResult
    try {
      res = await execute(ctx)
    } catch {
      res = { ok: false }
    }
    const f = await store.finish(ctx.key, ctx.requestId, res.ok, res.ok ? res.responseRef : undefined)
    if (f === 'NOT_PENDING') {
      // someone else (a racing retry or the sweeper) finished it first: report the stored truth
      const o = await store.outcome(ctx.key, ctx.requestId)
      if (!o || o.status === 'PENDING') throw new Error('finish raced into an impossible state')
      return fromOutcome(o, ctx, cert, execute, res)
    }
    const r = await receipt(ctx.key, cert, ctx.requestId, res.ok ? 'SERVED' : 'FAILED_CREDITED')
    return res.ok
      ? { kind: 'served', status: 200, receipt: r, result: res, replay: false, ctx }
      : { kind: 'failed', status: 502, receipt: r, replay: false, ctx }
  }

  async function handle(
    input: { noteHeader: string | null | undefined; price: bigint },
    execute: (ctx: PaymentContext) => Promise<ExecResult>,
  ): Promise<HandleResult> {
    const price = input.price
    if (!input.noteHeader) return offerResult(price, 'no-note')

    // 1. parse
    let note: SignedNote
    try {
      note = decodeNote(input.noteHeader)
    } catch (e) {
      return { kind: 'error', status: 400, error: `malformed note: ${(e as Error).message}` }
    }
    // 2. chain + contract must be accepted
    const acc = accepts.find((a) => a.chainId === note.chainId && sameAddress(a.contract, note.contract))
    if (!acc) return offerResult(price, 'unsupported-chain')

    const key = certKey(note.chainId, note.certificateId)
    const requestId = note.memo.toLowerCase() as Hex
    let cert: Certificate | null
    try {
      cert = await certificate(note.chainId, note.certificateId)
    } catch {
      return { kind: 'error', status: 503, error: 'chain unavailable and certificate not cached' }
    }
    if (!cert) return offerResult(price, 'unknown-certificate')
    const ctx: PaymentContext = {
      requestId,
      certificateId: cert.id,
      chainId: note.chainId,
      price,
      payee: config.payee,
      key,
    }

    // 4 (first, DECISIONS D3): a known requestId returns its stored outcome — after an ECDSA check.
    const existing = await store.outcome(key, requestId)
    if (existing) {
      if (!verifyNoteSignature(note, cert.spender)) return { kind: 'error', status: 401, error: 'bad signature' }
      return fromOutcome(existing, ctx, cert, execute)
    }

    // 3. certificate checks
    if (!sameAddress(cert.payee, config.payee)) return offerResult(price, 'wrong-payee')
    if (cert.closed) return offerResult(price, 'closed')
    if (cert.expiresAt - now() < minLife) {
      cert = (await certificate(note.chainId, note.certificateId, true).catch(() => cert)) ?? cert
      if (cert.expiresAt - now() < minLife) return offerResult(price, 'expiring')
    }

    // 6a. authenticity (pure ECDSA against the certificate's spender)
    if (!verifyNoteSignature(note, cert.spender)) return { kind: 'error', status: 401, error: 'bad signature' }
    if (note.cumulative > cert.faceValue) {
      cert = (await certificate(note.chainId, note.certificateId, true).catch(() => cert)) ?? cert
      if (note.cumulative > cert.faceValue) return offerResult(price, 'insufficient')
    }

    // 5. state (Recovery / first sight, DECISIONS D5)
    let st = await store.state(key)
    if (!st) {
      let onChain: Certificate | null
      try {
        onChain = await certificate(note.chainId, note.certificateId, true)
      } catch {
        return { kind: 'error', status: 503, error: 'chain unavailable: cannot initialise seller state' }
      }
      await store.recover(key, onChain?.redeemed ?? 0n)
      st = await store.state(key)
      if (!st) throw new Error('recover did not create state')
    }

    // 6b. S2 pre-check (re-checked atomically in begin)
    if (st.consumed + st.reserved + price > maxBig(st.accepted, note.cumulative))
      return offerResult(price, 'insufficient')

    // 7. begin (atomic)
    let b: Awaited<ReturnType<NoteStore['begin']>>
    try {
      b = await store.begin(key, requestId, price, note, cert.faceValue)
    } catch (e) {
      if (!(e instanceof NoStateError)) throw e
      await store.recover(key, (await certificate(note.chainId, note.certificateId, true))?.redeemed ?? 0n)
      b = await store.begin(key, requestId, price, note, cert.faceValue)
    }
    if (b === 'INSUFFICIENT') return offerResult(price, 'insufficient')
    if (b === 'DUPLICATE') {
      const o = await store.outcome(key, requestId)
      if (!o) throw new Error('duplicate without outcome')
      return fromOutcome(o, ctx, cert, execute)
    }
    return run(ctx, cert, execute)
  }

  async function sweep() {
    const stale = await store.stalePending(config.pendingTimeoutMs ?? 600_000)
    let resolved = 0
    let running = 0
    for (const { key, requestId } of stale) {
      const status: AppStatus = config.requestStatus ? await config.requestStatus(requestId, key) : 'failed'
      if (status === 'running') {
        running++
        continue
      }
      const f = await store.finish(key, requestId, status === 'done')
      if (f === 'DONE') resolved++
    }
    return { resolved, running }
  }

  function startSweeper(intervalMs = 60_000) {
    const t = setInterval(() => void sweep().catch(() => {}), intervalMs)
    return () => clearInterval(t)
  }

  return { offer, handle, sweep, startSweeper, certificate, accepts, config }
}
