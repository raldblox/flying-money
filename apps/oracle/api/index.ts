// Vercel entry for the hosted Oracle (§21.6). Every path is rewritten here (vercel.json); the Hono app routes it.
// Built output is imported (the build step runs `pnpm turbo run build` for this app and its workspace packages).
import { RECEIPT_HEADER } from '@flying-money/core'
import { waitUntil } from '@vercel/functions'
import { hostedOracleFromEnv } from '../dist/hosted.js'

type Hosted = ReturnType<typeof hostedOracleFromEnv>
let hosted: Hosted | undefined
let startupError: string | undefined
try {
  hosted = hostedOracleFromEnv(process.env, { hosted: true })
} catch (e) {
  // §21.5: refuse to serve without a durable store (or other required config); say why, never serve on memory
  startupError = (e as Error).message
}

async function handler(req: Request): Promise<Response> {
  if (!hosted) return Response.json({ error: `Oracle not started: ${startupError}` }, { status: 503 })
  const res = await hosted.app.fetch(req)
  // §21.6 step 1: after a paid response, sweep and redeem in the background (lock-guarded across instances)
  if (res.headers.has(RECEIPT_HEADER)) waitUntil(hosted.afterServe())
  return res
}

export const GET = handler
export const POST = handler
export const HEAD = handler
export const OPTIONS = handler
