import { encodeHeader, NOTE_HEADER, OFFER_HEADER, offerJson, RECEIPT_HEADER } from '@flying-money/core'
import type { Context, MiddlewareHandler } from 'hono'
import { requestHash } from './request-hash.js'
import {
  createFlyingMoneyServer,
  type ExecResult,
  type FlyingMoneyServer,
  type FlyingMoneyServerConfig,
  type HandleResult,
  type PaymentContext,
} from './server.js'

export const REASON_HEADER = 'Flying-Money-Reason'
/** Headers a browser client must be able to read (add to CORS `exposeHeaders`). */
export const EXPOSE_HEADERS = [OFFER_HEADER, RECEIPT_HEADER, REASON_HEADER]

declare module 'hono' {
  interface ContextVariableMap {
    flyingMoney: PaymentContext
  }
}

export interface HonoFlyingMoneyConfig extends FlyingMoneyServerConfig {
  /** Price in USDC base units for this request; 0n = free (no payment required). */
  price: (c: Context) => bigint | Promise<bigint>
  /** Largest response body stored for replays of SERVED requests (bytes). Larger ones re-run the idempotent handler. */
  maxStoredResponseBytes?: number
}

interface StoredResponse {
  status: number
  contentType: string | null
  body: string
}

/**
 * Hono middleware implementing §6.5 around a paid route. Handlers read `c.get('flyingMoney')` and MUST make
 * side effects idempotent on `requestId` (S1). A handler response with status ≥ 400 counts as a failed service:
 * the reservation is released and the price becomes credit (S3).
 */
export function flyingMoney(config: HonoFlyingMoneyConfig): MiddlewareHandler & { server: FlyingMoneyServer } {
  const server = createFlyingMoneyServer(config)
  const maxBytes = config.maxStoredResponseBytes ?? 64 * 1024

  const withReceipt = (res: Response, r: HandleResult & { receipt: unknown }) => {
    const out = new Response(res.body, res)
    out.headers.set(RECEIPT_HEADER, encodeHeader(r.receipt as never))
    return out
  }

  const mw: MiddlewareHandler = async (c, next) => {
    const price = await config.price(c)
    if (price === 0n) return next()

    let fresh: Response | undefined
    const execute = async (ctx: PaymentContext): Promise<ExecResult> => {
      c.set('flyingMoney', ctx)
      await next()
      fresh = c.res
      const ok = c.res.status < 400 && !c.error
      if (!ok) return { ok: false }
      const body = await c.res.clone().text()
      if (body.length > maxBytes) return { ok: true }
      const stored: StoredResponse = { status: c.res.status, contentType: c.res.headers.get('content-type'), body }
      return { ok: true, responseRef: JSON.stringify(stored) }
    }

    const respond = async (r: HandleResult): Promise<Response> => {
      switch (r.kind) {
        case 'offer':
          return new Response(JSON.stringify(offerJson(r.offer)), {
            status: 402,
            headers: {
              'content-type': 'application/json',
              [OFFER_HEADER]: encodeHeader(r.offer),
              [REASON_HEADER]: r.reason,
            },
          })
        case 'error':
          return new Response(JSON.stringify({ error: r.error }), {
            status: r.status,
            headers: {
              'content-type': 'application/json',
              ...(r.status === 409 ? { [REASON_HEADER]: 'memo-reused' } : {}),
              ...(r.status === 410 ? { [REASON_HEADER]: 'outcome-expired' } : {}),
            },
          })
        case 'served': {
          if (!r.replay && fresh) return withReceipt(fresh, r)
          if (r.result.responseRef) {
            const s = JSON.parse(r.result.responseRef) as StoredResponse
            const headers: Record<string, string> = s.contentType ? { 'content-type': s.contentType } : {}
            return withReceipt(new Response(s.body, { status: s.status, headers }), r)
          }
          // large response not stored: re-run the idempotent handler without charging again
          c.set('flyingMoney', r.ctx)
          await next()
          return withReceipt(c.res, r)
        }
        case 'failed': {
          if (!r.replay && fresh) return withReceipt(fresh, r)
          const msg = JSON.stringify({ error: 'service failed; the price was credited to your certificate' })
          return withReceipt(new Response(msg, { status: 502, headers: { 'content-type': 'application/json' } }), r)
        }
      }
    }

    // D32: bind the note's requestId to this exact request (method, path, sorted query, body)
    const body = new Uint8Array(await c.req.raw.clone().arrayBuffer())
    const hash = requestHash(c.req.method, new URL(c.req.url), body)
    const r = await server.handle({ noteHeader: c.req.header(NOTE_HEADER), price, requestHash: hash }, execute)
    // After next() has run, Hono only honours a response assigned to c.res (a returned one is ignored).
    const out = await respond(r)
    c.res = out
    return c.res
  }
  return Object.assign(mw, { server })
}
