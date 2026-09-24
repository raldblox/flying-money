import { getChainById } from '@flying-money/chains'
import {
  type FlyingMoneyClient,
  InsufficientBudgetError,
  NoCertificateError,
  PaymentRejectedError,
  PendingUnresolvedError,
  PriceTooHighError,
} from '@flying-money/client'
import { decodeOffer, OFFER_HEADER } from '@flying-money/core'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { formatUnits, parseUnits } from 'viem'
import { z } from 'zod'

export interface FlyingMoneyMcpConfig {
  /** A configured buyer client (its spending key never leaves it; no tool reads or returns it). */
  client: FlyingMoneyClient
  /** The same per-request cap the client enforces, reported to the model. */
  maxPricePerRequest: bigint
  /** Response bodies are truncated to this many characters. */
  maxBodyChars?: number
  fetch?: typeof fetch
}

/** USDC base units → "0.05" (display only). */
export const usdc = (v: bigint) => {
  const [i = '0', f = ''] = formatUnits(v, 6).split('.')
  return `${i}.${f.replace(/0+$/, '').padEnd(2, '0')}`
}

const text = (s: string, isError = false) => ({
  content: [{ type: 'text' as const, text: s }],
  ...(isError ? { isError } : {}),
})
const json = (o: unknown, isError = false) => text(JSON.stringify(o, null, 2), isError)

function httpUrl(u: string): URL {
  const url = new URL(u)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('only http(s) URLs can be fetched')
  return url
}

/**
 * The Flying Money MCP server (BUILD_SPEC §8.4): lets any MCP agent (Claude, Hermes, …) pay APIs with its
 * certificate. Four tools; none can issue or top up a certificate (that is the funder's job in the Counting House),
 * and none returns the spending key.
 */
export function createFlyingMoneyMcp(cfg: FlyingMoneyMcpConfig): McpServer {
  const fm = cfg.client
  const doFetch = cfg.fetch ?? fetch
  const maxBody = cfg.maxBodyChars ?? 8000
  const server = new McpServer({ name: 'flying-money', version: '0.1.0' })

  const certificates = () =>
    fm.status().map((c) => ({
      id: c.id,
      chain: c.chain,
      payee: c.payee,
      faceValue: usdc(c.faceValue),
      spent: usdc(c.spentLocal),
      credit: usdc(c.credit),
      remaining: usdc(c.remaining),
      redeemedOnChain: usdc(c.redeemedOnChain),
      expiresAt: new Date(Number(c.expiresAt) * 1000).toISOString(),
      pendingPayment: c.pending,
    }))

  server.registerTool(
    'fm_status',
    {
      title: 'Flying Money: budget status',
      description:
        'Your Flying Money certificates: chain, the one payee each can pay, face value, spent, remaining and expiry (USDC). Read-only.',
      inputSchema: {},
    },
    async () => {
      await fm.ready
      return json({ certificates: certificates(), maxPricePerRequest: usdc(cfg.maxPricePerRequest) })
    },
  )

  server.registerTool(
    'fm_explain',
    {
      title: 'Flying Money: the rules',
      description:
        'Plain-language rules for spending: who you can pay, how much, until when. Call this before planning paid work.',
      inputSchema: {},
    },
    async () => {
      await fm.ready
      const lines = fm.status().map((c) => {
        const ch = getChainById(c.chainId)?.chain.name ?? c.chain
        return `- Certificate ${c.id} on ${ch}: you can pay ONLY ${c.payee}, up to ${usdc(c.remaining)} USDC more (of ${usdc(c.faceValue)}), until ${new Date(Number(c.expiresAt) * 1000).toISOString()}.`
      })
      return text(
        [
          'You pay APIs with Flying Money certificates. Rules:',
          ...(lines.length
            ? lines
            : ['- You have no usable certificate. Ask your funder to issue one in the Counting House.']),
          `- A single request may cost at most ${usdc(cfg.maxPricePerRequest)} USDC.`,
          '- You can only pay the payee named on a certificate, never anyone else, and never more than its face value.',
          '- Use fm_quote to see a price before paying, and fm_paid_fetch to pay. Failed requests are not charged.',
          '- You cannot raise your own budget. Only the funder can top up or extend a certificate.',
        ].join('\n'),
      )
    },
  )

  server.registerTool(
    'fm_quote',
    {
      title: 'Flying Money: get a price',
      description:
        'Ask a URL for its price without paying. Returns the price in USDC and which chains and payee it accepts.',
      inputSchema: { url: z.string().describe('Absolute http(s) URL') },
    },
    async ({ url }) => {
      try {
        const res = await doFetch(httpUrl(url))
        if (res.status !== 402)
          return json({ paid: false, price: '0.00', status: res.status, note: 'No payment needed.' })
        const h = res.headers.get(OFFER_HEADER)
        if (!h) return json({ paid: false, status: 402, note: 'Payment required, but not with Flying Money.' }, true)
        const o = decodeOffer(h)
        return json({
          paid: false,
          price: usdc(o.price),
          accepts: o.accepts.map((a) => ({
            chain: getChainById(a.chainId)?.key ?? a.chainId,
            payee: a.payee,
          })),
          payable: fm
            .status()
            .some((c) =>
              o.accepts.some((a) => a.chainId === c.chainId && a.payee.toLowerCase() === c.payee.toLowerCase()),
            ),
        })
      } catch (e) {
        return text(`Could not quote: ${(e as Error).message}`, true)
      }
    },
  )

  server.registerTool(
    'fm_paid_fetch',
    {
      title: 'Flying Money: paid fetch',
      description:
        'Fetch a URL from a Flying Money paid API, paying with a sealed note from your certificate. Refuses prices above max_price (USDC) or the per-request cap. Returns the response body and the payment receipt.',
      inputSchema: {
        url: z.string().describe('Absolute http(s) URL'),
        method: z.enum(['GET', 'POST']).optional().describe('HTTP method (default GET)'),
        body: z.string().optional().describe('Request body for POST (JSON string)'),
        max_price: z.string().optional().describe('Most you will pay for this request, in USDC, e.g. "0.02"'),
      },
    },
    async ({ url, method, body, max_price }) => {
      try {
        const target = httpUrl(url)
        const init: RequestInit = {
          method: method ?? 'GET',
          ...(body ? { body, headers: { 'content-type': 'application/json' } } : {}),
        }
        if (max_price !== undefined) {
          const limit = parseUnits(max_price, 6)
          const probe = await doFetch(target, init)
          const h = probe.status === 402 ? probe.headers.get(OFFER_HEADER) : null
          if (h) {
            const price = decodeOffer(h).price
            if (price > limit)
              return text(`Not paid: the price is ${usdc(price)} USDC, above your max_price of ${usdc(limit)}.`, true)
          }
        }
        let payment: { price: bigint; cumulative: bigint } | undefined
        const before = new Map(fm.status().map((c) => [c.id, c.spentLocal]))
        const res = await fm.fetch(target, init)
        for (const c of fm.status()) {
          const prev = before.get(c.id) ?? 0n
          if (c.spentLocal > prev) payment = { price: c.spentLocal - prev, cumulative: c.spentLocal }
        }
        const t = await res.text()
        return json(
          {
            status: res.status,
            body: t.length > maxBody ? `${t.slice(0, maxBody)}…` : t,
            ...(payment ? { payment: { price: usdc(payment.price), cumulative: usdc(payment.cumulative) } } : {}),
            budget: certificates().map((c) => ({ id: c.id, remaining: c.remaining })),
          },
          res.status >= 400,
        )
      } catch (e) {
        const msg =
          e instanceof InsufficientBudgetError
            ? 'Not paid: this would go past the certificate’s face value. Your budget is used up; ask the funder to top it up.'
            : e instanceof PriceTooHighError
              ? `Not paid: the price is above your per-request cap of ${usdc(cfg.maxPricePerRequest)} USDC.`
              : e instanceof NoCertificateError
                ? 'Not paid: none of your certificates can pay this seller (wrong payee or chain, or not enough time or budget left).'
                : e instanceof PaymentRejectedError
                  ? `Not paid: the seller refused the note (${e.reason ?? e.status}).`
                  : e instanceof PendingUnresolvedError
                    ? 'A previous payment is still being confirmed; it will be resent, never re-signed. Try again shortly.'
                    : `Request failed: ${(e as Error).message}`
        return text(msg, true)
      }
    },
  )

  return server
}
