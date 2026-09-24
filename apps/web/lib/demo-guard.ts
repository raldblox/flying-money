import {
  type Lock,
  memoryLock,
  memoryRateLimiter,
  type RateLimiter,
  rateLimiter,
  redisFromEnv,
  redisLock,
} from '@flying-money/server'

/** Most testnet USDC the demo may lock per UTC day, across every visitor and instance (audit F9, D28). */
export const DEMO_DAILY_CAP = 6_000_000n // 6 USDC = 20 runs at 0.30
const PER_VISITOR_SECONDS = 120 // §13.3: one run per visitor every 2 minutes
const LOCK_MS = 270_000 // longer than the run timeout, so a hung run can never hold it forever

export interface DemoGuardDeps {
  lock: Lock
  limits: RateLimiter
}

export type Admission = { ok: true; release: () => Promise<void> } | { ok: false; status: 403 | 429; error: string }

// One set per server process for development without Redis (a single process by definition).
let local: DemoGuardDeps | undefined

/**
 * Shared limits from Upstash (`{p}lock:demo`, `{p}rl:*`, §21.5). On Vercel, with no store configured, returns null: the
 * demo stays paused rather than falling back to per-instance memory, which is what let parallel instances drain it.
 */
export function demoGuardFromEnv(env: Record<string, string | undefined>): DemoGuardDeps | null {
  const conn = redisFromEnv(env)
  if (conn) return { lock: redisLock(conn.redis, conn.prefix), limits: rateLimiter(conn.redis, conn.prefix) }
  if (env.VERCEL) return null
  local ??= { lock: memoryLock(), limits: memoryRateLimiter() }
  return local
}

const sameOrigin = (req: Request) => {
  const origin = req.headers.get('origin')
  if (!origin) return false
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? new URL(req.url).host
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

const visitor = (req: Request) =>
  req.headers.get('x-real-ip') ?? (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0]!.trim()

/** Admits one demo run: same origin, the shared run lock, one run per visitor per 2 minutes, and the daily cap. */
export async function admitDemoRun(req: Request, deps: DemoGuardDeps, face: bigint): Promise<Admission> {
  if (!sameOrigin(req)) return { ok: false, status: 403, error: 'Start the demo from the demo page.' }
  const token = await deps.lock.acquire('demo', LOCK_MS)
  if (!token) return { ok: false, status: 429, error: 'Another visitor’s demo is running. Try again in a minute.' }
  const release = () => deps.lock.release('demo', token)
  const seen = await deps.limits.hit('demo-visitor', visitor(req), 1, PER_VISITOR_SECONDS)
  if (!seen.ok) {
    await release()
    return { ok: false, status: 429, error: 'One run per visitor every 2 minutes. Try again shortly.' }
  }
  const day = new Date().toISOString().slice(0, 10)
  const budget = await deps.limits.spend('demo-usdc', day, face, DEMO_DAILY_CAP, 86_400)
  if (!budget.ok) {
    await release()
    return { ok: false, status: 429, error: 'Today’s demo budget is used up. It resets at midnight UTC.' }
  }
  return { ok: true, release }
}
