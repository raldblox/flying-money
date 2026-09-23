import type { FlyingMoneyClient } from './client.js'

/**
 * Tool-calling adapter for LLM agents (§8.2): one tool, `paid_fetch`. The budget is enforced by the certificate
 * and the client's maxPricePerRequest, never by the prompt.
 */
export function paidFetchTool(fm: FlyingMoneyClient, opts: { maxBodyChars?: number } = {}) {
  const maxBody = opts.maxBodyChars ?? 4000
  return {
    name: 'paid_fetch' as const,
    description:
      'Fetch a URL from a Flying Money paid API. Payment is automatic with a sealed note from your certificate; ' +
      'you can only pay the certificate’s payee and never more than its face value. Returns the response body and payment receipt.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Absolute URL to fetch' },
        method: { type: 'string', enum: ['GET', 'POST'], description: 'HTTP method (default GET)' },
        body: { type: 'string', description: 'Request body for POST (JSON string)' },
      },
      required: ['url'],
      additionalProperties: false,
    },
    async execute(args: { url: string; method?: 'GET' | 'POST'; body?: string }) {
      try {
        const res = await fm.fetch(args.url, {
          method: args.method ?? 'GET',
          ...(args.body ? { body: args.body, headers: { 'content-type': 'application/json' } } : {}),
        })
        const text = await res.text()
        const s = fm.status()
        return {
          status: res.status,
          body: text.length > maxBody ? `${text.slice(0, maxBody)}…` : text,
          budget: s.map((c) => ({
            certificate: c.id,
            chain: c.chain,
            spent: c.spentLocal.toString(),
            remaining: c.remaining.toString(),
          })),
        }
      } catch (e) {
        return { error: (e as Error).message }
      }
    },
  }
}
