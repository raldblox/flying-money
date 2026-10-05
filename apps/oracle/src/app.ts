import { EventEmitter } from 'node:events'
import type { ChainKey } from '@flying-money/chains'
import {
  certKey,
  decodeReceipt,
  encodeHeader,
  type Hex,
  NOTE_HEADER,
  OFFER_HEADER,
  offerJson,
  RECEIPT_HEADER,
  SPEC_VERSION,
  X402_SIGNATURE_HEADER,
} from '@flying-money/core'
import {
  type CertificateReader,
  createIdempotency,
  createRedeemer,
  type Lock,
  type NoteStore,
  type Redeemer,
  type RedeemPolicy,
} from '@flying-money/server'
import { EXPOSE_HEADERS, flyingMoney } from '@flying-money/server/hono'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import type { LocalAccount } from 'viem'
import { CITIES, findCity, PROVERBS, route, teaPrice, utcDay } from './data.js'

/** USDC base units (6 dp) per request (§13.1). */
export const PRICES: Record<string, bigint> = {
  '/v1/tea-price': 10_000n, // 0.01
  '/v1/route': 20_000n, // 0.02
  '/v1/weather': 10_000n, // 0.01
  '/v1/proverb': 5_000n, // 0.005
}

export interface WeatherNow {
  temperature_c: number
  wind_kmh: number
  time: string
}

/** Real current weather from Open-Meteo (free, non-commercial, attribution required). */
export async function openMeteo(lat: number, lon: number): Promise<WeatherNow> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m`
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!r.ok) throw new Error(`open-meteo ${r.status}`)
  const j = (await r.json()) as { current: { temperature_2m: number; wind_speed_10m: number; time: string } }
  return { temperature_c: j.current.temperature_2m, wind_kmh: j.current.wind_speed_10m, time: j.current.time }
}

export interface OracleConfig {
  accepts: ChainKey[]
  payee: Hex
  store: NoteStore
  env?: Record<string, string | undefined>
  readCertificate?: CertificateReader
  fetchWeather?: (lat: number, lon: number) => Promise<WeatherNow>
  docsUrl?: string
  /** Seconds a certificate must still have left to be accepted (§6.7; default 3600, hosted on Hobby: 36 h, D27). */
  minRemainingLifetime?: number
  /** Start a redeemer (needs gas on each chain). Demo policy (§13.1): 0.10 USDC or 60 s. */
  redeemer?: {
    account: LocalAccount
    /** Cross-instance lock (§21.5 `{p}lock:redeemer:{chainId}`): required when several instances share the store. */
    lock?: Lock
    policy?: Partial<RedeemPolicy>
    intervalMs?: number
    pollingIntervalMs?: number
  }
  corsOrigin?: string | string[]
}

export type OracleEvent =
  | {
      type: 'note'
      chainId?: number
      certificateId: Hex
      requestId: Hex
      path: string
      price: string
      status: 'SERVED' | 'FAILED_CREDITED'
      accepted: string
      consumed: string
      credit: string
      at: number
    }
  | { type: 'redeemed'; chainId: number; txHash: Hex; certificateId: Hex; cumulative: string; paid: string; at: number }

export function createOracle(config: OracleConfig) {
  const events = new EventEmitter()
  events.setMaxListeners(1000)
  const jobs = createIdempotency()
  const fetchWeather = config.fetchWeather ?? openMeteo

  const paid = flyingMoney({
    accepts: config.accepts,
    payee: config.payee,
    store: config.store,
    ...(config.env ? { env: config.env } : {}),
    ...(config.readCertificate ? { readCertificate: config.readCertificate } : {}),
    suggestedFaceValue: 500_000n,
    ...(config.docsUrl ? { docs: config.docsUrl } : {}),
    ...(config.minRemainingLifetime !== undefined ? { minRemainingLifetime: config.minRemainingLifetime } : {}),
    price: (c) => PRICES[c.req.path] ?? 0n,
    requestStatus: async (rid) => jobs.status(rid),
    // x402 V2 transport too: x402 tools can discover the offer, and pay with the flying-money scheme
    x402: true,
  })
  const server = paid.server

  let redeemer: Redeemer | undefined
  if (config.redeemer) {
    redeemer = createRedeemer({
      chains: config.accepts,
      store: config.store,
      redeemerAccount: config.redeemer.account,
      ...(config.redeemer.lock ? { lock: config.redeemer.lock } : {}),
      ...(config.env ? { env: config.env } : {}),
      ...(config.redeemer.pollingIntervalMs ? { pollingIntervalMs: config.redeemer.pollingIntervalMs } : {}),
      policy: { minAmount: 100_000n, maxAgeSeconds: 60, safetyBeforeExpiry: 1800, ...config.redeemer.policy },
      onRedeemed: (e) =>
        events.emit('redeemed', {
          type: 'redeemed',
          chainId: e.chainId,
          txHash: e.txHash,
          certificateId: e.certificateId,
          cumulative: e.cumulative.toString(),
          paid: e.paid.toString(),
          at: Date.now(),
        } satisfies OracleEvent),
      onError: (e, chainId) => events.emit('error', { chainId, message: e.message }),
    })
  }

  const app = new Hono()
  app.use(
    '*',
    cors({
      origin: config.corsOrigin ?? '*',
      allowHeaders: ['content-type', NOTE_HEADER, X402_SIGNATURE_HEADER],
      exposeHeaders: EXPOSE_HEADERS,
    }),
  )

  // Observe outcomes for the demo stream (runs around the payment middleware).
  app.use('/v1/*', async (c, next) => {
    await next()
    const rh = c.res.headers.get(RECEIPT_HEADER)
    if (!rh) return
    const r = decodeReceipt(rh)
    const ctx = c.get('flyingMoney') as { chainId?: number } | undefined
    events.emit('note', {
      type: 'note',
      ...(ctx?.chainId !== undefined ? { chainId: ctx.chainId } : {}),
      certificateId: r.certificateId,
      requestId: r.requestId,
      path: c.req.path,
      price: (PRICES[c.req.path] ?? 0n).toString(),
      status: r.status,
      accepted: r.accepted.toString(),
      consumed: r.consumed.toString(),
      credit: r.credit.toString(),
      at: Date.now(),
    } satisfies OracleEvent)
  })
  app.use('/v1/*', paid)

  // ───────── paid endpoints (§13.1) ─────────
  app.get('/v1/tea-price', (c) => {
    const city = findCity(c.req.query('city'))
    if (!city) return c.json({ error: 'unknown city', cities: CITIES.map((x) => x.name) }, 400)
    return c.json(teaPrice(city, utcDay()))
  })

  app.get('/v1/route', (c) => {
    const from = findCity(c.req.query('from'))
    const to = findCity(c.req.query('to'))
    if (!from || !to || from === to)
      return c.json({ error: 'need two different known cities', cities: CITIES.map((x) => x.name) }, 400)
    return c.json(route(from, to))
  })

  app.get('/v1/weather', async (c) => {
    const lat = Number(c.req.query('lat'))
    const lon = Number(c.req.query('lon'))
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
      return c.json({ error: 'lat/lon required' }, 400)
    const { requestId } = c.get('flyingMoney')
    // side effect (an upstream call) is idempotent on requestId (§6.5 S1)
    const w = await jobs.runOnce(requestId, () => fetchWeather(lat, lon))
    return c.json({
      lat,
      lon,
      ...w,
      illustrative: false,
      source: 'Weather data by Open-Meteo.com (CC BY 4.0), non-commercial demo use',
    })
  })

  app.get('/v1/proverb', (c) => {
    const { requestId } = c.get('flyingMoney')
    const p = PROVERBS[Number.parseInt(requestId.slice(-4), 16) % PROVERBS.length]!
    return c.json(p)
  })

  // ───────── free endpoints ─────────
  const pricesJson = () => Object.fromEntries(Object.entries(PRICES).map(([k, v]) => [k, v.toString()]))
  const offer = () => offerJson(server.offer(0n))

  app.get('/health', (c) => c.json({ ok: true, chains: server.accepts.map((a) => a.chainId) }))

  app.get('/fm/prices', (c) =>
    c.json({ currency: 'USDC', decimals: 6, prices: pricesJson(), accepts: offer().accepts }),
  )

  // Seller discovery (§10.7): agents can learn pricing without a 402 round-trip.
  app.get('/.well-known/flying-money.json', (c) =>
    c.json({
      scheme: 'flying-money',
      v: 1,
      spec: SPEC_VERSION,
      seller: 'Silk Road Oracle',
      accepts: offer().accepts,
      prices: pricesJson(),
      currency: 'USDC',
      decimals: 6,
      minRemainingLifetime: server.offer(0n).minRemainingLifetime,
      headers: { note: NOTE_HEADER, offer: OFFER_HEADER, receipt: RECEIPT_HEADER },
      ...(config.docsUrl ? { docs: config.docsUrl } : {}),
    }),
  )

  // Payee view (§12.3): the highest note with cumulative ≤ consumed (redeem-only-served, §6.5).
  app.get('/fm/redeemable/:id', async (c) => {
    const id = c.req.param('id') as Hex
    if (!/^0x[0-9a-fA-F]{64}$/.test(id)) return c.json({ error: 'bad certificate id' }, 400)
    for (const acc of server.accepts) {
      const key = certKey(acc.chainId, id)
      const st = await config.store.state(key)
      if (!st) continue
      const note = await config.store.bestNote(key, st.consumed)
      return c.json({
        chainId: acc.chainId,
        certificateId: id,
        state: {
          accepted: st.accepted.toString(),
          consumed: st.consumed.toString(),
          reserved: st.reserved.toString(),
          credit: (st.accepted - st.consumed - st.reserved).toString(),
          status: st.status,
        },
        note: note ? encodeHeader(note) : null,
      })
    }
    return c.json({ error: 'no notes for this certificate' }, 404)
  })

  // Demo stream (§13.1): accepted notes and redemptions.
  app.get('/fm/stream', (c) =>
    streamSSE(c, async (stream) => {
      const send = (e: OracleEvent) => void stream.writeSSE({ event: e.type, data: JSON.stringify(e) })
      events.on('note', send)
      events.on('redeemed', send)
      stream.onAbort(() => {
        events.off('note', send)
        events.off('redeemed', send)
      })
      while (!stream.aborted) {
        await stream.writeSSE({ event: 'ping', data: String(Date.now()) })
        await stream.sleep(15_000)
      }
    }),
  )

  app.get('/openapi.json', (c) => c.json(openapi()))

  return { app, server, redeemer, events }
}

function openapi() {
  const payment402 = {
    description: `Payment Required: a flying-money offer. The ${OFFER_HEADER} header carries fm1.<base64url(JSON)>; the body is the same offer as JSON.`,
    headers: { [OFFER_HEADER]: { schema: { type: 'string' } } },
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['scheme', 'v', 'price', 'minRemainingLifetime', 'accepts'],
          properties: {
            scheme: { const: 'flying-money' },
            v: { const: 1 },
            price: { type: 'string', description: 'USDC base units (6 decimals)' },
            minRemainingLifetime: { type: 'integer' },
            suggestedFaceValue: { type: 'string' },
            accepts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  chainId: { type: 'string' },
                  contract: { type: 'string' },
                  token: { type: 'string' },
                  payee: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }
  const paidOp = (summary: string, params: Array<[string, string]>) => ({
    get: {
      summary,
      parameters: [
        ...params.map(([name, type]) => ({ name, in: 'query', required: true, schema: { type } })),
        {
          name: NOTE_HEADER,
          in: 'header',
          required: false,
          schema: { type: 'string' },
          description: 'fm1 sealed note',
        },
      ],
      responses: {
        '200': { description: `Served. ${RECEIPT_HEADER} header carries the receipt.` },
        '400': { description: 'Bad input (not charged: the price becomes credit)' },
        '401': { description: 'Bad note signature' },
        '402': payment402,
      },
    },
  })
  return {
    openapi: '3.1.0',
    info: {
      title: 'Silk Road Oracle',
      version: '1.0.0',
      description:
        'Flying Money demo seller. Tea and route data are fictional game data; weather is real (Open-Meteo).',
    },
    paths: {
      '/v1/tea-price': paidOp('Tea price in a historical city (illustrative) — 0.01 USDC', [['city', 'string']]),
      '/v1/route': paidOp('Caravan route between two cities (illustrative) — 0.02 USDC', [
        ['from', 'string'],
        ['to', 'string'],
      ]),
      '/v1/weather': paidOp('Current weather (Open-Meteo) — 0.01 USDC', [
        ['lat', 'number'],
        ['lon', 'number'],
      ]),
      '/v1/proverb': paidOp('A public-domain proverb — 0.005 USDC', []),
      '/fm/prices': { get: { summary: 'Price table (free)', responses: { '200': { description: 'OK' } } } },
      '/fm/redeemable/{id}': {
        get: {
          summary: 'Highest redeemable (served) note for a certificate (free)',
          responses: { '200': { description: 'OK' } },
        },
      },
    },
  }
}
