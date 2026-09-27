import { getChainById, rpcUrl } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import {
  createInbox,
  type Inbox,
  InboxError,
  memoryInboxStore,
  onChainApproval,
  redisFromEnv,
  redisInboxStore,
} from '@flying-money/server'
import { createPublicClient, http, type PublicClient } from 'viem'
import { E2E, e2eMode } from '@/lib/e2e'

/**
 * The request relay inbox behind /api/requests (§21.4.2). Server only. Durable on Upstash; on Vercel it refuses to
 * run without a durable store (§21.5). Local development without store variables uses memory.
 */
// one instance per process: each route is bundled on its own, and a memory store (local development) must be shared
const g = globalThis as { __fmInbox?: Inbox }
const clients = new Map<number, PublicClient>()

export const SESSION_COOKIE = 'fm_inbox'

function servedChain(chainId: number) {
  const c = getChainById(chainId)
  if (!c?.flyingMoney) return undefined
  if (c.key === 'anvil' && !e2eMode) return undefined
  return c
}

export function getInbox(): Inbox {
  if (g.__fmInbox) return g.__fmInbox
  // the local browser e2e (a private anvil) never writes to the real inbox
  const conn = e2eMode ? null : redisFromEnv(process.env)
  if (!conn && process.env.VERCEL) throw new InboxError(503, 'unavailable', 'the request inbox needs a durable store')
  const store = conn ? redisInboxStore(conn.redis, conn.prefix) : memoryInboxStore()
  // self-verifying session cookies (valid on every serverless instance): a dedicated secret if set, else one derived
  // from the store's own server secret; local development without either uses a fixed dev-only secret
  const secret =
    process.env.FM_INBOX_SECRET ??
    process.env.KV_REST_API_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    (process.env.VERCEL ? undefined : 'local-development-only')
  const inbox = createInbox({
    store,
    sessionSecret: secret,
    isChain: (id) => Boolean(servedChain(id)),
    checkApproval: onChainApproval((chainId) => {
      const c = servedChain(chainId)
      if (!c) return undefined
      let pub = clients.get(chainId)
      if (!pub) {
        const url = c.key === 'anvil' && E2E.rpc ? E2E.rpc : rpcUrl(c.key, process.env)
        pub = createPublicClient({ chain: c.chain, transport: http(url) }) as PublicClient
        clients.set(chainId, pub)
      }
      return { pub, contract: c.flyingMoney as Hex }
    }),
  })
  g.__fmInbox = inbox
  return inbox
}

export function inboxErrorResponse(e: unknown): Response {
  const headers = { 'cache-control': 'no-store' }
  // by shape, not only instanceof: the cached inbox may come from another copy of the module (route bundles, dev
  // recompiles), whose InboxError is a different class
  const ie = e as { name?: unknown; status?: unknown; code?: unknown; message?: unknown } | null
  if (
    e instanceof InboxError ||
    (ie?.name === 'InboxError' && typeof ie.status === 'number' && typeof ie.code === 'string')
  )
    return Response.json({ error: ie!.code, message: ie!.message }, { status: ie!.status as number, headers })
  console.error('inbox', e)
  return Response.json({ error: 'internal' }, { status: 500, headers })
}

const cookieValue = (req: Request, name: string) =>
  req.headers
    .get('cookie')
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1)

/** The signed-in owner (§21.4.2 owner session), or a 401. */
export async function sessionOwner(req: Request): Promise<Hex> {
  const owner = await getInbox().owner(cookieValue(req, SESSION_COOKIE))
  if (!owner) throw new InboxError(401, 'sign-in', 'sign in to your inbox first')
  return owner
}

/** Mutations with the session cookie must come from this site (the cookie is also SameSite=Strict). */
export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin')
  if (!origin) return
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  let originHost = ''
  try {
    originHost = new URL(origin).host
  } catch {}
  if (!host || originHost !== host) throw new InboxError(403, 'origin', 'cross-site request refused')
}

export const sessionCookie = (value: string, maxAge: number) =>
  `${SESSION_COOKIE}=${value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${
    process.env.NODE_ENV === 'production' ? '; Secure' : ''
  }`
