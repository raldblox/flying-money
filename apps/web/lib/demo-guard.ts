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

/** Most testnet USDC the slip and counter demos may lock per UTC day (8 USDC: about 50 counter visitors). */
export const SLIP_DAILY_CAP = 8_000_000n
const SLIP_PER_VISITOR_SECONDS = 60

/**
 * Admits one slip (or one counter-demo wallet): same origin, one per visitor a minute, and the slip demos' own daily
 * cap, shared by both. The funding
 * transaction itself is serialised per network by the caller (one funder, one nonce sequence).
 */
export async function admitSlip(
  req: Request,
  deps: DemoGuardDeps,
  face: bigint,
  kind: 'slip' | 'counter' = 'slip',
): Promise<{ ok: true } | { ok: false; status: 403 | 429; error: string }> {
  if (!sameOrigin(req)) return { ok: false, status: 403, error: 'Start it from the demo page.' }
  const seen = await deps.limits.hit(`${kind}-visitor`, visitor(req), 1, SLIP_PER_VISITOR_SECONDS)
  if (!seen.ok)
    return {
      ok: false,
      status: 429,
      error: kind === 'slip' ? 'One slip per visitor a minute. Try again shortly.' : 'One wallet per visitor a minute.',
    }
  const day = new Date().toISOString().slice(0, 10)
  const budget = await deps.limits.spend('slip-usdc', day, face, SLIP_DAILY_CAP, 86_400)
  if (!budget.ok) return { ok: false, status: 429, error: 'Today’s slips are used up. They reset at midnight UTC.' }
  return { ok: true }
}

/** Advisory only: reads never reserve a slot or consume the visitor allowance. POST still admits atomically. */
export async function inspectDemoRun(req: Request, deps: DemoGuardDeps, face: bigint) {
  if (await deps.lock.isHeld('demo'))
    return {
      available: false,
      reason: 'busy',
      message: 'Another visitor’s agent is shopping. Check again shortly, or watch the illustration.',
    }
  const day = new Date().toISOString().slice(0, 10)
  if ((await deps.limits.read('demo-usdc', day)) + face > DEMO_DAILY_CAP)
    return {
      available: false,
      reason: 'exhausted',
      message:
        'Today’s sponsored demo budget is used up. It resets at midnight UTC. The illustration is still available.',
    }
  if ((await deps.limits.read('demo-visitor', visitor(req))) >= 1n)
    return {
      available: false,
      reason: 'cooldown',
      message: 'You can start one sponsored run every two minutes. Your existing run is still available.',
    }
  return { available: true, reason: 'ready', message: 'Sponsorship is available. Nothing starts until you approve.' }
}

export async function inspectCounter(req: Request, deps: DemoGuardDeps, face: bigint, chain: string) {
  if (await deps.lock.isHeld(`slip:${chain}`))
    return {
      available: false,
      reason: 'busy',
      message: 'Another visitor’s budget is being funded. Check again shortly.',
    }
  if ((await deps.limits.read('counter-visitor', visitor(req))) >= 1n)
    return {
      available: false,
      reason: 'cooldown',
      message: 'You can claim one demo wallet per minute. Check again shortly.',
    }
  if ((await deps.limits.read('slip-usdc', new Date().toISOString().slice(0, 10))) + face > SLIP_DAILY_CAP)
    return {
      available: false,
      reason: 'exhausted',
      message: 'Today’s sponsored counter budget is used up. It resets at midnight UTC.',
    }
  return {
    available: true,
    reason: 'ready',
    message: 'Your sponsored budget is available. Claim it when you’re ready.',
  }
}
