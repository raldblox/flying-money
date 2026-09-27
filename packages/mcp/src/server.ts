import { getChainById } from '@flying-money/chains'
import {
  type FlyingMoneyClient,
  InsufficientBudgetError,
  NoCertificateError,
  PaymentRejectedError,
  PendingUnresolvedError,
  PriceTooHighError,
} from '@flying-money/client'
import { decodeOffer, type Hex, OFFER_HEADER, type Offer, parseOffer } from '@flying-money/core'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { formatUnits, parseUnits } from 'viem'
import { z } from 'zod'
import { guardedFetch } from './net-guard.js'

export interface FlyingMoneyMcpConfig {
  /** A configured buyer client (its spending key never leaves it; no tool reads or returns it). */
  client: FlyingMoneyClient
  /** The same per-request cap the client enforces, reported to the model. */
  maxPricePerRequest: bigint
  /** Response bodies are truncated to this many characters. */
  maxBodyChars?: number
  /** An owner is configured: the agent may ask for budgets (§21.4). */
  canRequest?: boolean
  /** The site where the owner reviews requests (FM_REQUEST_LINK_BASE), for URL-mode elicitation of inbox requests */
  approvalBase?: string
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
 * The Flying Money MCP server (BUILD_SPEC §8.4, §21.4.5): lets any MCP agent (Claude, Hermes, …) pay APIs from a
 * budget, and ask its owner for one. Six tools; none can approve, issue or top up a budget (that is the owner's own
 * on-chain action in the web app, R3), and none returns the spending key.
 */
export function createFlyingMoneyMcp(cfg: FlyingMoneyMcpConfig): McpServer {
  const fm = cfg.client
  // public internet only unless the caller supplies its own fetch (audit F6)
  const doFetch = cfg.fetch ?? guardedFetch()
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
        'Your Flying Money budgets: chain, the one seller each can pay, amount, spent, remaining and end date (USDC). Read-only.',
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
        return `- Budget ${c.id} on ${ch}: you can pay ONLY ${c.payee}, up to ${usdc(c.remaining)} USDC more (of ${usdc(c.faceValue)}), until ${new Date(Number(c.expiresAt) * 1000).toISOString()}. It can't be cancelled early; after the end date your owner can take back what's left.`
      })
      return text(
        [
          'You pay APIs with Flying Money budgets. Rules:',
          ...(lines.length
            ? lines
            : [
                '- You have no usable budget. Ask your owner for one with fm_request_budget (or on the Flying Money site).',
              ]),
          `- A single request may cost at most ${usdc(cfg.maxPricePerRequest)} USDC.`,
          '- You can only pay the seller named on a budget, never anyone else, and never more than its amount.',
          '- Use fm_quote to see a price before paying, and fm_paid_fetch to pay. Failed requests are not charged.',
          '- You cannot raise your own budget. Only your owner can top up or extend it.',
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
        const res = await doFetch(httpUrl(url), { redirect: 'manual' })
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
        'Fetch a URL from a Flying Money paid API, paying with a signed payment slip from your budget. Refuses prices above max_price (USDC) or the per-request cap. Returns the response body and the payment receipt.',
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
          redirect: 'manual',
          ...(body ? { body, headers: { 'content-type': 'application/json' } } : {}),
        }
        // max_price is enforced by the client on the offer it signs, not on a separate quote (§22.2 A2)
        const maxPrice = max_price !== undefined ? parseUnits(max_price, 6) : undefined
        let payment: { price: bigint; cumulative: bigint } | undefined
        const before = new Map(fm.status().map((c) => [c.id, c.spentLocal]))
        const res = await fm.fetch(target, init, maxPrice !== undefined ? { maxPrice } : {})
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
            ? 'Not paid: this would go past the budget’s amount. Your budget is used up; ask your owner to top it up.'
            : e instanceof PriceTooHighError
              ? `Not paid: the price (${usdc(e.offer.price)} USDC) is above ${
                  max_price !== undefined && e.max < cfg.maxPricePerRequest ? 'your max_price' : 'your per-request cap'
                } of ${usdc(e.max)} USDC. Nothing was signed.`
              : e instanceof NoCertificateError
                ? 'Not paid: none of your budgets can pay this seller (wrong seller or chain, or not enough time or money left).'
                : e instanceof PaymentRejectedError
                  ? `Not paid: the seller refused the note (${e.reason ?? e.status}).`
                  : e instanceof PendingUnresolvedError
                    ? 'A previous payment is still being confirmed; it will be resent, never re-signed. Try again shortly.'
                    : `Request failed: ${(e as Error).message}`
        if (e instanceof NoCertificateError) return noCertificate(e.offer, target(url))
        return text(msg, true)
      }
    },
  )

  const target = (u: string) => {
    try {
      return new URL(u).origin
    } catch {
      return u
    }
  }

  /** §21.3: a structured error the model can act on, instead of prose. */
  function noCertificate(offer: Offer, service: string) {
    const acc = offer.accepts[0]
    return json(
      {
        error: 'no_certificate',
        service,
        chain: acc ? (getChainById(acc.chainId)?.key ?? String(acc.chainId)) : undefined,
        payee: acc?.payee,
        price: usdc(offer.price),
        suggestedAmount: offer.suggestedFaceValue !== undefined ? usdc(offer.suggestedFaceValue) : undefined,
        canRequest: Boolean(cfg.canRequest),
        next: cfg.canRequest
          ? 'You may call fm_request_budget once for this service, then wait for your owner. Never retry payment in a loop.'
          : 'No owner is configured. Tell the user this service needs a Flying Money budget.',
      },
      true,
    )
  }

  const describe = (r: Awaited<ReturnType<FlyingMoneyClient['requestStatus']>>) => ({
    requestId: r.requestId,
    status: r.status,
    chain: r.chain,
    service: r.request.origin || r.request.payee,
    amount: usdc(r.request.amount),
    days: Number(r.request.validFor / 86_400n),
    via: r.via,
    ...(r.status === 'asked' && r.via === 'relay'
      ? {
          next: 'Sent to your owner’s Flying Money inbox. Tell them a budget request is waiting (Account → Requests on the site); they review it and fund it with their own wallet. Then call fm_request_status. Do not ask again.',
        }
      : {}),
    ...(r.status === 'asked' && r.via === 'link'
      ? {
          link: r.link,
          next: 'Give this link to your owner (the human). They review it and fund the budget with their own wallet. Then call fm_request_status. Do not ask again.',
        }
      : {}),
    ...(r.status === 'declined'
      ? { next: 'Your owner declined this request. Don’t ask again for this service unless they tell you to.' }
      : {}),
    ...(r.status === 'expired'
      ? { next: 'The request expired unanswered (7 days). Ask again only if still needed.' }
      : {}),
    ...(r.status === 'approved'
      ? {
          certificateId: r.certificateId,
          // a top-up reports what was actually added, never the amount asked for (§22.2 A4)
          granted: r.added !== undefined ? usdc(r.added) : r.faceValue !== undefined ? usdc(r.faceValue) : undefined,
          expiresAt: r.expiresAt !== undefined ? new Date(Number(r.expiresAt) * 1000).toISOString() : undefined,
          next: 'Verified on the blockchain. You can pay this service now with fm_paid_fetch.',
        }
      : {}),
  })

  /**
   * §22.6: where the client supports URL-mode elicitation, offer the owner the approval page directly (the client
   * shows the full URL and asks before opening it). Approval still happens only in the web app, never in chat (R3).
   * Never blocks the tool: a client that doesn't answer within a few seconds just gets the text result.
   */
  async function offerApproval(r: Awaited<ReturnType<FlyingMoneyClient['requestBudget']>>) {
    const caps = server.server.getClientCapabilities() as { elicitation?: { url?: object } } | undefined
    if (!caps?.elicitation?.url) return
    const url = r.link ?? (cfg.approvalBase ? `${cfg.approvalBase.replace(/\/$/, '')}/app/requests` : undefined)
    if (!url) return
    const ask = server.server
      .elicitInput({
        mode: 'url',
        elicitationId: r.requestId,
        url,
        message: `Your assistant asks you for a budget of ${usdc(r.request.amount)} USDC. Open this page to review it; only you can fund it, from your own wallet.`,
      })
      .catch(() => null)
    await Promise.race([ask, new Promise((res) => setTimeout(res, 5000))])
  }

  server.registerTool(
    'fm_request_budget',
    {
      title: 'Flying Money: ask your owner for a budget',
      description:
        'Ask your owner (the human who funds you) for a budget for one paid service. Signs a request with your spending key and sends it to your owner’s inbox (or, without an inbox permission, returns a link for your owner). Moves no money: only the owner can fund it, from their own wallet. Call it once per service, only after fm_paid_fetch returned no_certificate with canRequest true, then wait. The reason you give is shown to the owner as unverified text.',
      inputSchema: {
        url: z.string().describe('A URL of the paid service (its 402 offer tells the seller and chain)'),
        amount: z.string().describe('USDC to ask for, e.g. "0.50"'),
        days: z
          .number()
          .min(1)
          .max(365)
          .describe('How long the budget should last, in days (at least 1; 3 or more recommended)'),
        reason: z.string().max(280).describe('One short sentence for your owner: what you need it for'),
      },
    },
    async ({ url, amount, days, reason }) => {
      if (!cfg.canRequest) return text('No owner is configured (FM_OWNER), so no budget can be requested.', true)
      try {
        const probe = await doFetch(httpUrl(url), { method: 'GET' })
        if (probe.status !== 402) return text(`That URL did not ask for payment (HTTP ${probe.status}).`, true)
        const h = probe.headers.get(OFFER_HEADER)
        const offer = h ? decodeOffer(h) : parseOffer((await probe.json()) as Record<string, unknown>)
        const r = await fm.requestBudget({
          offer,
          amount: parseUnits(amount, 6),
          days,
          reason,
          origin: target(url),
        })
        await offerApproval(r)
        return json(describe(r))
      } catch (e) {
        return text(`Could not create the request: ${(e as Error).message}`, true)
      }
    },
  )

  server.registerTool(
    'fm_request_status',
    {
      title: 'Flying Money: check a budget request',
      description:
        'Check whether your owner funded a budget you asked for. Approval is verified on the blockchain (funded by your owner, spendable by your key, payable to that service); once approved you can pay right away.',
      inputSchema: { requestId: z.string().describe('The requestId from fm_request_budget') },
    },
    async ({ requestId }) => {
      try {
        return json(describe(await fm.requestStatus(requestId as Hex)))
      } catch (e) {
        return text(`Could not check the request: ${(e as Error).message}`, true)
      }
    },
  )

  return server
}
