// Vercel entry for the hosted x402 bridge. Every path is rewritten here (vercel.json); the Hono app routes it.
// The bridge's built output is imported (the build step runs `pnpm turbo run build` for the bridge package).

import { hostedBridgeFromEnv } from '@flying-money/bridge'
import { RECEIPT_HEADER } from '@flying-money/core'
import { waitUntil } from '@vercel/functions'

type Hosted = ReturnType<typeof hostedBridgeFromEnv>
let hosted: Hosted | undefined
let startupError: string | undefined
try {
  hosted = hostedBridgeFromEnv(process.env, { hosted: true })
} catch (e) {
  // never serve without a durable store or the key: say why
  startupError = (e as Error).message
}

async function handler(req: Request): Promise<Response> {
  if (!hosted) return Response.json({ error: `Bridge not started: ${startupError}` }, { status: 503 })
  const res = await hosted.app.fetch(req)
  // after a paid response, sweep and collect in the background (lock-guarded across instances)
  if (res.headers.has(RECEIPT_HEADER)) waitUntil(hosted.afterServe())
  return res
}

export const GET = handler
export const POST = handler
export const HEAD = handler
export const OPTIONS = handler
