import { type ChainKey, getChain, rpcUrl } from '@flying-money/chains'
import {
  type Certificate,
  type CertKey,
  certKey,
  decodeOffer,
  decodeReceipt,
  decodeSpendRequest,
  encodeHeader,
  encodeSpendRequest,
  type Hex,
  maxBig,
  NOTE_HEADER,
  newRequestId,
  OFFER_HEADER,
  type Offer,
  parseOffer,
  RECEIPT_HEADER,
  REQUEST_MIN_VALID_FOR,
  type Receipt,
  readCertificate,
  type SpendRequest,
  sameAddress,
  signNote,
  signSpendRequest,
  verifySpendRequest,
  ZERO_ID,
} from '@flying-money/core'
import { createPublicClient, http, type LocalAccount, type PublicClient } from 'viem'

const minBig = (a: bigint, b: bigint) => (a < b ? a : b)

import type {
  BudgetRequestRecord,
  ClientCertState,
  ClientStore,
  PendingRecord,
  PendingRequest,
  RequestStore,
} from './store.js'

export class NoCertificateError extends Error {
  constructor(public offer: Offer) {
    super('NoCertificateError: no certificate matches this offer (payee, chain, remaining face value, lifetime)')
    this.name = 'NoCertificateError'
  }
}
export class PriceTooHighError extends Error {
  constructor(
    public offer: Offer,
    public max: bigint,
  ) {
    super(`PriceTooHighError: price ${offer.price} exceeds maxPricePerRequest ${max}`)
    this.name = 'PriceTooHighError'
  }
}
export class InsufficientBudgetError extends Error {
  constructor(
    public certificateId: Hex,
    public needed: bigint,
    public faceValue: bigint,
  ) {
    super(`insufficient: would need cumulative ${needed} above face value ${faceValue}`)
    this.name = 'InsufficientBudgetError'
  }
}
/** The seller rejected the note without a receipt (never admitted). The pending note was cleared (D3). */
export class PaymentRejectedError extends Error {
  constructor(
    public status: number,
    public reason: string | null,
    public body: string,
  ) {
    super(`payment rejected (${status}${reason ? `, ${reason}` : ''})`)
    this.name = 'PaymentRejectedError'
  }
}
/** The pending note could not be delivered yet. It stays pending and is resent (never re-signed) later. */
export class PendingUnresolvedError extends Error {
  constructor(public certificateId: Hex) {
    super('pending note not yet resolved; it will be resent')
    this.name = 'PendingUnresolvedError'
  }
}

export interface PaymentEvent {
  url: string
  price: bigint
  cumulative: bigint
  certificateId: Hex
  chainId: number
  receipt: Receipt
}

export type ClientEvent =
  | { type: 'request'; url: string }
  | { type: 'offer'; url: string; offer: Offer }
  | { type: 'sealed'; url: string; certificateId: Hex; cumulative: bigint; requestId: Hex }
  | { type: 'retry'; url: string; requestId: Hex; attempt: number; error: string }
  | { type: 'receipt'; url: string; receipt: Receipt }
  | { type: 'rejected'; url: string; status: number; reason: string | null }
  /** The receipt claimed more than this client ever signed; only the signed amounts were kept (D33). */
  | {
      type: 'suspicious-receipt'
      url: string
      receipt: Receipt
      kept: { accepted: bigint; consumed: bigint; reserved: bigint }
    }

export interface FlyingMoneyClientConfig {
  chains: ChainKey[]
  /** Order used when an offer accepts several chains. */
  preferredChains?: ChainKey[]
  spender: LocalAccount
  /** Durable outbox (§6.6): fileStore(path) for agents, memoryStore() for tests. */
  store: ClientStore
  /** Certificate ids this agent may use (issued by the funder). */
  certificates: Hex[]
  /** Safety: refuse offers above this (base units). */
  maxPricePerRequest: bigint
  onPayment?: (e: PaymentEvent) => void
  onEvent?: (e: ClientEvent) => void
  env?: Record<string, string | undefined>
  readCertificate?: (chainId: number, contract: Hex, id: Hex) => Promise<Certificate | null>
  fetch?: typeof fetch
  /** Unix seconds. */
  now?: () => number
  retry?: { attempts?: number; backoffMs?: number }
  /** Test hooks (crash injection). */
  hooks?: { point?: (name: 'afterSign' | 'afterSave' | 'afterSend') => void }
  /** Who to ask for budgets (§21.4, FM_OWNER). Without it, requestBudget is unavailable. */
  owner?: Hex
  /** Where approval links open, e.g. https://useflyingmoney.vercel.app (§21.4.2 link channel). */
  requestLinkBase?: string
  /** Durable list of this agent's budget requests (so approvals survive restarts). */
  requestStore?: RequestStore
}

/** A budget request made by this agent (§21.4). It never moves money: only the owner's own issue does (R1). */
export interface BudgetRequest {
  requestId: Hex
  chain: ChainKey
  status: 'asked' | 'approved' | 'expired'
  /** open this to review and approve (link channel) */
  link: string
  request: SpendRequest
  /** set once approved and verified on-chain */
  certificateId?: Hex
  faceValue?: bigint
  expiresAt?: bigint
}

/** Requests are kept 7 days (§21.4.2), then reported as expired. */
const REQUEST_TTL_SECONDS = 7n * 86_400n

interface Held {
  key: CertKey
  chainKey: ChainKey
  chainId: number
  contract: Hex
  cert: Certificate
}

export interface CertificateStatus {
  id: Hex
  chain: ChainKey
  chainId: number
  payee: Hex
  faceValue: bigint
  /** Highest cumulative accepted by the seller (from receipts). */
  spentLocal: bigint
  consumed: bigint
  credit: bigint
  redeemedOnChain: bigint
  remaining: bigint
  expiresAt: bigint
  pending: boolean
}

export interface FlyingMoneyClient {
  fetch(input: string | URL, init?: RequestInit): Promise<Response>
  status(): CertificateStatus[]
  resolvePending(): Promise<void>
  refresh(): Promise<void>
  /** Resolves after certificates are loaded and pending notes resolved (runs automatically). */
  ready: Promise<void>
  /**
   * Asks the owner for a budget (§21.4.5), signed with this agent's key. Returns a link for the owner to review and
   * approve. Nothing moves until the owner funds it on-chain (R1).
   */
  requestBudget(o: {
    /** the 402 offer (from NoCertificateError): payee and chain come from it */
    offer?: Offer
    payee?: Hex
    chain?: ChainKey
    amount: bigint
    days: number
    reason: string
    origin?: string
    /** top up this certificate instead of asking for a new one */
    certificateId?: Hex
  }): Promise<BudgetRequest>
  /**
   * Checks the chain for the owner's answer. Approved only when a certificate funded by the owner, spendable by this
   * key and payable to the requested payee exists on-chain (R2); it is then used for payments right away.
   */
  requestStatus(requestId: Hex): Promise<BudgetRequest>
  requests(): BudgetRequest[]
}

export function createFlyingMoneyClient(config: FlyingMoneyClientConfig): FlyingMoneyClient {
  const doFetch = config.fetch ?? globalThis.fetch.bind(globalThis)
  const nowS = () => BigInt(Math.floor(config.now ? config.now() : Date.now() / 1000))
  const attempts = config.retry?.attempts ?? 5
  const backoffMs = config.retry?.backoffMs ?? 250
  const emit = (e: ClientEvent) => config.onEvent?.(e)
  const point = (n: 'afterSign' | 'afterSave' | 'afterSend') => config.hooks?.point?.(n)

  const held = new Map<CertKey, Held>()
  const local = new Map<CertKey, ClientCertState>()
  const locks = new Map<CertKey, Promise<unknown>>()

  const clients = new Map<ChainKey, PublicClient>()
  const pubFor = (chainKey: ChainKey) => {
    let c = clients.get(chainKey)
    if (!c) {
      c = createPublicClient({ transport: http(rpcUrl(chainKey, config.env ?? {})) }) as PublicClient
      clients.set(chainKey, c)
    }
    return c
  }
  const read = async (chainKey: ChainKey, contract: Hex, id: Hex) => {
    const chainId = getChain(chainKey).chain.id
    if (config.readCertificate) return config.readCertificate(chainId, contract, id)
    return readCertificate(pubFor(chainKey), contract, id)
  }

  /** Starts using one certificate if (and only if) it is spendable by this key. */
  async function adopt(chainKey: ChainKey, id: Hex): Promise<Held | null> {
    const ch = getChain(chainKey)
    if (!ch.flyingMoney) return null
    const c = await read(chainKey, ch.flyingMoney, id).catch(() => null)
    if (!c || !sameAddress(c.spender, config.spender.address)) return null
    const key = certKey(ch.chain.id, id)
    const h: Held = { key, chainKey, chainId: ch.chain.id, contract: ch.flyingMoney, cert: c }
    held.set(key, h)
    await load(key)
    return h
  }

  async function load(key: CertKey): Promise<ClientCertState> {
    const s = (await config.store.load(key)) ?? { accepted: 0n, consumed: 0n, reserved: 0n }
    local.set(key, s)
    return s
  }
  async function save(key: CertKey, s: ClientCertState) {
    await config.store.save(key, s)
    local.set(key, s)
  }

  function withLock<T>(key: CertKey, fn: () => Promise<T>): Promise<T> {
    const prev = locks.get(key) ?? Promise.resolve()
    const p = prev.then(fn, fn)
    locks.set(
      key,
      p.catch(() => {}),
    )
    return p
  }

  async function discover() {
    for (const id of config.certificates) {
      for (const chainKey of config.chains) {
        if (await adopt(chainKey, id)) break
      }
    }
    // requests survive restarts (§21.4.5): the saved link carries the signed request itself; approved budgets
    // are used again, pending ones can still be checked
    for (const rec of (await config.requestStore?.load()) ?? []) {
      let signed: ReturnType<typeof decodeSpendRequest>
      try {
        signed = decodeSpendRequest(rec.link.split('#')[1] ?? '')
      } catch {
        continue
      }
      if (!verifySpendRequest(signed) || !sameAddress(signed.request.requester, config.spender.address)) continue
      const r: BudgetRequest & { fromBlock: bigint } = {
        requestId: signed.request.requestId,
        chain: rec.chain as ChainKey,
        status: rec.status,
        link: rec.link,
        request: signed.request,
        fromBlock: BigInt(rec.fromBlock),
        ...(rec.certificateId ? { certificateId: rec.certificateId } : {}),
      }
      reqs.set(r.requestId.toLowerCase(), r)
      if (rec.status === 'approved' && rec.certificateId) {
        const h = await adopt(r.chain, rec.certificateId)
        if (h) Object.assign(r, { faceValue: h.cert.faceValue, expiresAt: h.cert.expiresAt })
      }
    }
  }

  async function refreshOne(h: Held) {
    const c = await read(h.chainKey, h.contract, h.cert.id).catch(() => null)
    if (c)
      h.cert = {
        ...c,
        faceValue: maxBig(c.faceValue, h.cert.faceValue),
        expiresAt: maxBig(c.expiresAt, h.cert.expiresAt),
      }
  }

  const buildRequest = (req: PendingRequest, noteHeader?: string): RequestInit & { url: string } => ({
    url: req.url,
    method: req.method,
    headers: noteHeader ? { ...req.headers, [NOTE_HEADER]: noteHeader } : req.headers,
    ...(req.body !== undefined ? { body: req.body } : {}),
  })

  /** Resend the SAME pending note until a final receipt (§6.6 steps 2, 5). Never re-signs. */
  async function sendPending(h: Held, pending: PendingRecord): Promise<Response> {
    let lastErr = ''
    for (let attempt = 1; attempt <= attempts; attempt++) {
      let res: Response
      try {
        const { url, ...init } = buildRequest(pending.request, pending.noteHeader)
        res = await doFetch(url, init)
      } catch (e) {
        lastErr = (e as Error).message
        emit({ type: 'retry', url: pending.request.url, requestId: pending.requestId, attempt, error: lastErr })
        if (backoffMs) await new Promise((r) => setTimeout(r, backoffMs * attempt))
        continue
      }
      point('afterSend')
      const rh = res.headers.get(RECEIPT_HEADER)
      if (rh) {
        const receipt = decodeReceipt(rh)
        if (receipt.requestId.toLowerCase() !== pending.requestId.toLowerCase())
          throw new Error('receipt does not match the pending requestId')
        if (receipt.certificateId.toLowerCase() !== h.cert.id.toLowerCase())
          throw new Error('receipt is for a different certificate than the pending note')
        // D33: a receipt is trusted only up to what this client signed, so a lying seller (or a man in the middle)
        // can't inflate the next note: accepted ≤ highest signed, consumed ≤ accepted, consumed + reserved ≤ accepted.
        const cur = local.get(h.key) ?? (await load(h.key))
        const accepted = minBig(receipt.accepted, maxBig(cur.accepted, pending.cumulative))
        const consumed = minBig(receipt.consumed, accepted)
        const reserved = minBig(receipt.reserved, accepted - consumed)
        if (accepted !== receipt.accepted || consumed !== receipt.consumed || reserved !== receipt.reserved)
          emit({
            type: 'suspicious-receipt',
            url: pending.request.url,
            receipt,
            kept: { accepted, consumed, reserved },
          })
        // final: update from the receipt and clear pending atomically (§6.6 step 6)
        const consumedBefore = cur.consumed
        await save(h.key, { accepted, consumed, reserved })
        emit({ type: 'receipt', url: pending.request.url, receipt })
        if (receipt.status === 'SERVED')
          config.onPayment?.({
            url: pending.request.url,
            price: consumed > consumedBefore ? consumed - consumedBefore : 0n,
            cumulative: pending.cumulative,
            certificateId: h.cert.id,
            chainId: h.chainId,
            receipt,
          })
        return res
      }
      if (res.status >= 500) {
        lastErr = `HTTP ${res.status}`
        await res.text().catch(() => {})
        emit({ type: 'retry', url: pending.request.url, requestId: pending.requestId, attempt, error: lastErr })
        if (backoffMs) await new Promise((r) => setTimeout(r, backoffMs * attempt))
        continue
      }
      // A rejection without a receipt means the note was never admitted (DECISIONS D3): clear pending,
      // keep accepted/consumed unchanged. No obligation grew, so C1 holds.
      const reason = res.headers.get('Flying-Money-Reason')
      const body = await res.text().catch(() => '')
      const cur = local.get(h.key) ?? (await load(h.key))
      await save(h.key, { accepted: cur.accepted, consumed: cur.consumed, reserved: cur.reserved })
      emit({ type: 'rejected', url: pending.request.url, status: res.status, reason })
      if (reason === 'insufficient') await refreshOne(h)
      throw new PaymentRejectedError(res.status, reason, body)
    }
    throw new PendingUnresolvedError(h.cert.id)
  }

  async function resolvePendingFor(h: Held) {
    const s = await load(h.key)
    if (s.pending) {
      const res = await sendPending(h, s.pending)
      await res.body?.cancel().catch(() => {})
    }
  }

  async function resolvePending() {
    for (const h of held.values()) {
      await withLock(h.key, () => resolvePendingFor(h)).catch(() => {})
    }
  }

  const ready = (async () => {
    await discover()
    await resolvePending()
  })()

  function pick(offer: Offer): Held | null {
    const prefs = config.preferredChains ?? []
    const candidates: Array<{ h: Held; rank: number }> = []
    for (const acc of offer.accepts) {
      for (const h of held.values()) {
        if (
          h.chainId !== acc.chainId ||
          !sameAddress(h.contract, acc.contract) ||
          !sameAddress(h.cert.payee, acc.payee)
        )
          continue
        if (h.cert.closed || h.cert.expiresAt - nowS() < BigInt(offer.minRemainingLifetime)) continue
        const s = local.get(h.key) ?? { accepted: 0n, consumed: 0n, reserved: 0n }
        const credit = s.accepted - s.consumed - s.reserved
        const need = offer.price > credit ? offer.price - credit : 0n
        if (h.cert.faceValue - s.accepted < need) continue
        const p = prefs.indexOf(h.chainKey)
        candidates.push({ h, rank: p === -1 ? prefs.length : p })
      }
    }
    candidates.sort((a, b) => a.rank - b.rank)
    return candidates[0]?.h ?? null
  }

  async function pay(h: Held, price: bigint, req: PendingRequest): Promise<Response> {
    await resolvePendingFor(h) // §6.6 step 2
    const s = await load(h.key)
    // §6.6 step 3: with the per-certificate mutex the client's own reserved is 0; `s.reserved` is the latest
    // receipt's value (other instances' in-flight requests).
    let next = maxBig(s.accepted, s.consumed + s.reserved + price)
    if (next > h.cert.faceValue) {
      await refreshOne(h)
      if (next > h.cert.faceValue) throw new InsufficientBudgetError(h.cert.id, next, h.cert.faceValue)
    }
    next = maxBig(s.accepted, s.consumed + s.reserved + price)
    const requestId = newRequestId()
    const signed = await signNote(config.spender, h.chainId, h.contract, {
      certificateId: h.cert.id,
      cumulative: next,
      memo: requestId,
    })
    point('afterSign')
    const pending: PendingRecord = {
      requestId,
      noteHeader: encodeHeader(signed),
      cumulative: next,
      request: req,
      createdAt: Date.now(),
    }
    await save(h.key, { ...s, pending }) // §6.6 step 4: durably save BEFORE sending
    point('afterSave')
    emit({ type: 'sealed', url: req.url, certificateId: h.cert.id, cumulative: next, requestId })
    return sendPending(h, pending)
  }

  async function fetchPaid(input: string | URL, init: RequestInit = {}): Promise<Response> {
    await ready
    const url = String(input)
    if (init.body !== undefined && init.body !== null && typeof init.body !== 'string')
      throw new Error('flying-money client: only string request bodies can be replayed safely')
    const headers: Record<string, string> = {}
    new Headers(init.headers).forEach((v, k) => {
      headers[k] = v
    })
    const req: PendingRequest = {
      url,
      method: (init.method ?? 'GET').toUpperCase(),
      headers,
      ...(typeof init.body === 'string' ? { body: init.body } : {}),
    }
    emit({ type: 'request', url })
    const { url: u, ...plain } = buildRequest(req)
    const first = await doFetch(u, plain)
    if (first.status !== 402) return first
    let offer: Offer
    try {
      const oh = first.headers.get(OFFER_HEADER)
      offer = oh ? decodeOffer(oh) : parseOffer((await first.clone().json()) as Record<string, unknown>)
    } catch {
      return first // a 402 that is not a flying-money offer
    }
    await first.body?.cancel().catch(() => {})
    emit({ type: 'offer', url, offer })
    if (offer.price > config.maxPricePerRequest) throw new PriceTooHighError(offer, config.maxPricePerRequest)
    const h = pick(offer)
    if (!h) throw new NoCertificateError(offer)
    return withLock(h.key, () => pay(h, offer.price, req))
  }

  function status(): CertificateStatus[] {
    return [...held.values()].map((h) => {
      const s = local.get(h.key) ?? { accepted: 0n, consumed: 0n, reserved: 0n }
      return {
        id: h.cert.id,
        chain: h.chainKey,
        chainId: h.chainId,
        payee: h.cert.payee,
        faceValue: h.cert.faceValue,
        spentLocal: s.accepted,
        consumed: s.consumed,
        credit: s.accepted - s.consumed - s.reserved,
        redeemedOnChain: h.cert.redeemed,
        remaining: h.cert.faceValue - s.accepted,
        expiresAt: h.cert.expiresAt,
        pending: Boolean(s.pending),
      }
    })
  }

  async function refresh() {
    await ready
    for (const h of held.values()) await refreshOne(h)
  }

  // ───────── budget requests (§21.4, link channel) ─────────
  const reqs = new Map<string, BudgetRequest & { fromBlock: bigint }>()
  const toRecord = (r: BudgetRequest & { fromBlock: bigint }): BudgetRequestRecord => ({
    requestId: r.requestId,
    chain: r.chain,
    status: r.status,
    link: r.link,
    fromBlock: r.fromBlock.toString(),
    ...(r.certificateId ? { certificateId: r.certificateId } : {}),
  })
  const persist = async () => {
    await config.requestStore?.save([...reqs.values()].map(toRecord))
  }

  async function requestBudget(o: Parameters<FlyingMoneyClient['requestBudget']>[0]): Promise<BudgetRequest> {
    if (!config.owner) throw new Error('no owner configured (FM_OWNER): cannot ask for a budget')
    // chain + payee: from the offer when given, else explicit
    let chainKey = o.chain
    let payee = o.payee
    if (o.offer) {
      const prefs = [...(config.preferredChains ?? []), ...config.chains]
      const acc = prefs
        .map((k) => o.offer!.accepts.find((a) => a.chainId === getChain(k).chain.id))
        .find((a) => a !== undefined)
      if (!acc) throw new Error('the offer accepts none of the configured chains')
      chainKey = config.chains.find((k) => getChain(k).chain.id === acc.chainId)!
      payee = acc.payee
    }
    if (!chainKey || !payee) throw new Error('requestBudget needs an offer, or a payee and a chain')
    const validFor = BigInt(Math.round(o.days * 86_400))
    if (validFor < REQUEST_MIN_VALID_FOR) throw new Error('a budget request must be for at least one day')
    const ch = getChain(chainKey)
    const signed = await signSpendRequest(config.spender, ch.chain.id, {
      owner: config.owner,
      payee,
      amount: o.amount,
      validFor,
      certificateId: o.certificateId ?? ZERO_ID,
      requestId: newRequestId(),
      createdAt: nowS(),
      reason: o.reason,
      origin: o.origin ?? '',
    })
    const fromBlock = config.readCertificate ? 0n : await pubFor(chainKey).getBlockNumber()
    const base = (config.requestLinkBase ?? '').replace(/\/$/, '')
    const r = {
      requestId: signed.request.requestId,
      chain: chainKey,
      status: 'asked' as const,
      link: `${base}/app/requests/new#${encodeSpendRequest(signed)}`,
      request: signed.request,
      fromBlock,
    }
    reqs.set(r.requestId.toLowerCase(), r)
    await persist()
    return r
  }

  async function requestStatus(requestId: Hex): Promise<BudgetRequest> {
    const r = reqs.get(requestId.toLowerCase())
    if (!r) throw new Error(`unknown request ${requestId}`)
    if (r.status !== 'asked') return r
    const ch = getChain(r.chain)
    const pub = pubFor(r.chain)
    let found: Held | null = null
    if (r.request.certificateId !== ZERO_ID) {
      // a top-up request: approved once the certificate is funded above what it was when we asked
      found = await adopt(r.chain, r.request.certificateId)
      if (found && !sameAddress(found.cert.payee, r.request.payee)) found = null
    } else {
      const logs = await pub.getLogs({
        address: ch.flyingMoney,
        event: {
          type: 'event',
          name: 'CertificateIssued',
          inputs: [
            { name: 'id', type: 'bytes32', indexed: true },
            { name: 'funder', type: 'address', indexed: true },
            { name: 'payee', type: 'address', indexed: true },
            { name: 'spender', type: 'address', indexed: false },
            { name: 'faceValue', type: 'uint256', indexed: false },
            { name: 'expiresAt', type: 'uint64', indexed: false },
          ],
        },
        args: { funder: r.request.owner, payee: r.request.payee },
        fromBlock: r.fromBlock,
      })
      for (const log of logs) {
        const a = log.args as { id: Hex; spender: Hex; faceValue: bigint }
        if (!sameAddress(a.spender, config.spender.address) || a.faceValue <= 0n) continue
        // R2: re-read the certificate itself; the log alone is not trusted
        const h = await adopt(r.chain, a.id)
        if (
          h &&
          sameAddress(h.cert.payee, r.request.payee) &&
          sameAddress(h.cert.funder, r.request.owner) &&
          !h.cert.closed
        ) {
          found = h
          break
        }
      }
    }
    if (found) {
      Object.assign(r, {
        status: 'approved',
        certificateId: found.cert.id,
        faceValue: found.cert.faceValue,
        expiresAt: found.cert.expiresAt,
      })
      await persist()
    } else if (nowS() > r.request.createdAt + REQUEST_TTL_SECONDS) {
      r.status = 'expired'
      await persist()
    }
    return r
  }

  return {
    fetch: fetchPaid,
    status,
    resolvePending,
    refresh,
    ready,
    requestBudget,
    requestStatus,
    requests: () => [...reqs.values()],
  }
}
