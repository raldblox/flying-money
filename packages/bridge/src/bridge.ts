import { getChainById } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import {
  createIdempotency,
  type FlyingMoneyServerConfig,
  memoryRateLimiter,
  type NoteStore,
  type RateLimiter,
} from '@flying-money/server'
import { flyingMoney } from '@flying-money/server/hono'
import { x402Client, x402HTTPClient } from '@x402/core/client'
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types'
import { registerExactEvmScheme } from '@x402/evm/exact/client'
import { type Context, Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { LocalAccount } from 'viem'
import { guardedFetch } from './net-guard.js'
import { type Delivered, memoryOutcomes, type OutcomeStore } from './outcomes.js'
import { assertPublicTarget, BlockedTargetError, type TargetPolicy } from './ssrf.js'

export interface BridgeConfig {
  /** Flying Money chains whose budgets this bridge accepts (registry keys). */
  accepts: FlyingMoneyServerConfig['accepts']
  /** Pays upstream endpoints. Also the budgets' payee, so collecting a budget refills the float. */
  float: LocalAccount
  store: NoteStore
  env?: Record<string, string | undefined>
  readCertificate?: FlyingMoneyServerConfig['readCertificate']
  /** CAIP-2 networks the bridge will pay on (the float must hold USDC there). */
  upstreamNetworks: string[]
  /** Refuse any single upstream payment above this (USDC base units). */
  maxUpstreamAmount: bigint
  /** Added to the upstream price, in basis points (0 = pass-through). */
  feeBps?: number
  /** How long a quote stays valid (ms). Default 60 s. */
  quoteTtlMs?: number
  target?: TargetPolicy
  /** Free quote calls per client per minute (each can reach a site). Default 60. */
  quoteLimitPerMinute?: number
  rateLimiter?: RateLimiter
  /** Trust X-Forwarded-For for the client id (only behind your own proxy). */
  trustProxy?: boolean
  /** The float's USDC balance on a network (base units). When set, a quote is refused while the float can't cover it. */
  floatBalance?: (network: string) => Promise<bigint>
  /** Durable record of what each request returned, so a restart never pays a site twice. Default: memory. */
  outcomes?: OutcomeStore
  /** Test hook: replaces the guarded upstream fetch. */
  fetch?: typeof fetch
  /** Unix milliseconds. */
  now?: () => number
  minRemainingLifetime?: number
}

interface Quote {
  paymentRequired: PaymentRequired
  accepted: PaymentRequirements
  upstream: bigint
  price: bigint
  expires: number
}

const FORWARD_HEADERS = ['accept', 'content-type', 'accept-language']
const MAX_BODY = 1_000_000

const refuse = (error: string, reason: string, status: 422 | 429 | 502 | 503 = 422): never => {
  throw new HTTPException(status, { res: Response.json({ error, reason }, { status }) })
}

export function createBridge(config: BridgeConfig) {
  // Upstream calls dial only public addresses, checked again at connect time (DNS rebinding); redirects are never followed.
  const doFetch = config.fetch ?? (config.target?.allowLocal ? fetch : guardedFetch())
  const limiter = config.rateLimiter ?? memoryRateLimiter()
  const outcomes = config.outcomes ?? memoryOutcomes()
  const quoteLimit = config.quoteLimitPerMinute ?? 60
  const MAX_QUOTES = 500
  const ttl = config.quoteTtlMs ?? 60_000
  const now = config.now ?? (() => Date.now())
  const jobs = createIdempotency()
  const quotes = new Map<string, Quote>()

  const x402 = new x402Client()
  registerExactEvmScheme(x402, { signer: config.float as never })
  const http = new x402HTTPClient(x402)

  const usdcFor = (network: string) => {
    const id = /^eip155:(\d+)$/.exec(network)?.[1]
    return id ? getChainById(Number(id))?.usdc : undefined
  }
  const fee = (amount: bigint) => (amount * BigInt(config.feeBps ?? 0) + 9_999n) / 10_000n

  /** Calls the target; follows no redirects (a redirect could point at an internal address). */
  async function upstream(
    method: string,
    url: URL,
    headers: Headers,
    body: Uint8Array,
    extra?: Record<string, string>,
  ) {
    const h = new Headers()
    for (const k of FORWARD_HEADERS) {
      const v = headers.get(k)
      if (v) h.set(k, v)
    }
    for (const [k, v] of Object.entries(extra ?? {})) h.set(k, v)
    return doFetch(url, {
      method,
      headers: h,
      ...(body.length > 0 ? { body: body as unknown as BodyInit } : {}),
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    })
  }

  async function readBody(req: Request) {
    const raw = new Uint8Array(await req.clone().arrayBuffer())
    if (raw.length > MAX_BODY) throw new HTTPException(413, { message: 'request body too large' })
    return raw
  }

  async function target(url: string | undefined): Promise<URL> {
    if (!url) throw new HTTPException(400, { message: 'missing ?url=' })
    try {
      return await assertPublicTarget(url, config.target)
    } catch (e) {
      if (e instanceof BlockedTargetError) return refuse(e.message, 'target-refused')
      throw e
    }
  }

  /** The price of a call is what the target asks (read from its own 402) plus the fee. */
  async function quote(
    method: string,
    url: URL,
    headers: Headers,
    body: Uint8Array,
    client: string,
  ): Promise<Quote | null> {
    const key = `${method} ${url.href}`
    const hit = quotes.get(key)
    if (hit && hit.expires > now()) return hit
    // every quote that misses the cache calls the site: limit them per client
    const rl = await limiter.hit('bridge-quote', client, quoteLimit, 60)
    if (!rl.ok) return refuse('too many quotes; slow down', 'rate-limited', 429)
    const res = await upstream(method, url, headers, body)
    if (res.status !== 402) return null
    let required: PaymentRequired
    try {
      const json = await res
        .clone()
        .json()
        .catch(() => undefined)
      required = http.getPaymentRequiredResponse((n) => res.headers.get(n), json)
    } catch {
      return refuse('the target answered 402 but not in a form the bridge understands', 'upstream-402-unparsable', 502)
    }
    // only the real USDC of a network we list: never an arbitrary token a site names
    const payable = required.accepts.filter(
      (a) =>
        a.scheme === 'exact' &&
        config.upstreamNetworks.includes(a.network) &&
        usdcFor(a.network)?.toLowerCase() === a.asset.toLowerCase(),
    )
    const accepted = payable.find((a) => BigInt(a.amount) <= config.maxUpstreamAmount)
    if (!accepted) {
      return refuse(
        payable.length > 0
          ? 'the target asks for more than this bridge will pay'
          : 'the target does not accept a scheme and network this bridge can pay',
        payable.length > 0 ? 'upstream-too-expensive' : 'upstream-unsupported',
      )
    }
    const upstreamAmount = BigInt(accepted.amount)
    if (config.floatBalance && (await config.floatBalance(accepted.network)) < upstreamAmount)
      return refuse('this bridge’s float is too low to pay that right now; tell its owner', 'float-low', 503)
    const q: Quote = {
      paymentRequired: required,
      accepted,
      upstream: upstreamAmount,
      price: upstreamAmount + fee(upstreamAmount),
      expires: now() + ttl,
    }
    if (quotes.size >= MAX_QUOTES) quotes.delete(quotes.keys().next().value as string)
    quotes.set(key, q)
    return q
  }

  const paid = flyingMoney({
    accepts: config.accepts,
    payee: config.float.address,
    store: config.store,
    ...(config.env ? { env: config.env } : {}),
    ...(config.readCertificate ? { readCertificate: config.readCertificate } : {}),
    ...(config.minRemainingLifetime !== undefined ? { minRemainingLifetime: config.minRemainingLifetime } : {}),
    requestStatus: async (rid) => {
      const s = jobs.status(rid)
      return s === 'not-started' && (await outcomes.get(rid)) ? 'done' : s
    },
    price: async (c) => {
      const url = await target(c.req.query('url'))
      const q = await quote(c.req.method, url, c.req.raw.headers, await readBody(c.req.raw), clientId(c))
      return q ? q.price : 0n // a target that asks for nothing is relayed free of charge
    },
  })

  const clientId = (c: Context) =>
    config.trustProxy
      ? (c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'proxy')
      : ((c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming?.socket
          ?.remoteAddress ?? 'local')

  const app = new Hono()
  app.onError((e, c) => {
    if (e instanceof HTTPException) return e.getResponse()
    return c.json({ error: 'bridge error', reason: 'internal' }, 500)
  })

  // what an owner (or an agent) needs to know before funding a budget for this bridge
  app.get('/', (c) =>
    c.json({
      name: 'Flying Money x402 bridge',
      what: 'Pays ordinary x402 sites on behalf of an agent, from a Flying Money budget whose payee is this bridge.',
      payee: config.float.address,
      budgetChains: config.accepts,
      upstreamNetworks: config.upstreamNetworks,
      maxPerCall: config.maxUpstreamAmount.toString(),
      feeBps: config.feeBps ?? 0,
      use: 'GET /fetch?url=<x402 site>, paying with a Flying Money note (Flying-Money-Note) for the quoted price',
      limits:
        'Only the exact USDC scheme. A budget for this payee can be spent only here; unspent money returns to its funder after the end date.',
    }),
  )

  app.all('/fetch', paid, async (c) => {
    const url = await target(c.req.query('url'))
    const method = c.req.method
    const body = await readBody(c.req.raw)
    const ctx = c.get('flyingMoney') as { requestId?: Hex } | undefined
    const run = async (): Promise<Delivered> => {
      const q = await quote(method, url, c.req.raw.headers, body, clientId(c))
      if (!q) {
        const r = await upstream(method, url, c.req.raw.headers, body)
        return { status: r.status, type: r.headers.get('content-type'), text: await r.text(), settle: null }
      }
      // pay exactly what was quoted: the agent signed the price, and this upstream amount is bound to it
      const payload = await http.createPaymentPayload({ ...q.paymentRequired, accepts: [q.accepted] })
      const r = await upstream(method, url, c.req.raw.headers, body, http.encodePaymentSignatureHeader(payload))
      return {
        status: r.status,
        type: r.headers.get('content-type'),
        text: await r.text(),
        settle: r.headers.get('payment-response') ?? r.headers.get('x-payment-response'),
      }
    }
    // one upstream payment per requestId, however often the agent resends the same note (S1)
    const rid = ctx?.requestId
    const out =
      (rid ? await outcomes.get(rid) : undefined) ??
      (rid
        ? await jobs.runOnce(rid, async () => {
            const d = await run()
            if (d.status >= 200 && d.status < 300) await outcomes.set(rid, d)
            return d
          })
        : await run())
    if (out.status < 200 || out.status >= 300) {
      // a failed purchase is not charged: the Flying Money server turns a >=400 answer into credit (S3)
      return c.json({ error: 'the target did not deliver', upstreamStatus: out.status, reason: 'upstream-failed' }, 502)
    }
    return new Response(out.text, {
      status: 200,
      headers: {
        ...(out.type ? { 'content-type': out.type } : {}),
        ...(out.settle ? { 'x-upstream-payment-response': out.settle } : {}),
      },
    })
  })

  return { app, server: paid.server, float: config.float.address }
}
