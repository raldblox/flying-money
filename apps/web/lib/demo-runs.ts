import { type RedisEval, redisFromEnv } from '@flying-money/server'
import type { DemoEvent } from './demo-story'

const TTL_SECONDS = 86_400
export type DemoRun = { createdAt: number; events: DemoEvent[]; status: 'running' | 'done' | 'error' | 'interrupted' }
export interface DemoRuns {
  create(id: string): Promise<boolean>
  append(id: string, event: DemoEvent): Promise<void>
  read(id: string): Promise<DemoRun | null>
}
export const validRunId = (id: unknown): id is string =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)
function snapshot(createdAt: number, events: DemoEvent[], now: number): DemoRun {
  const terminal = [...events].reverse().find((e) => e.type === 'done' || e.type === 'error')
  return {
    createdAt,
    events,
    status:
      terminal?.type === 'done'
        ? 'done'
        : terminal?.type === 'error'
          ? 'error'
          : now - createdAt > 300_000
            ? 'interrupted'
            : 'running',
  }
}
export function memoryDemoRuns(now = Date.now): DemoRuns {
  const runs = new Map<string, { createdAt: number; events: DemoEvent[] }>()
  return {
    async create(id) {
      for (const [key, value] of runs) if (now() - value.createdAt > TTL_SECONDS * 1000) runs.delete(key)
      if (runs.has(id)) return false
      runs.set(id, { createdAt: now(), events: [] })
      return true
    },
    async append(id, event) {
      const run = runs.get(id)
      if (!run) throw new Error('Run record expired')
      run.events.push(event)
    },
    async read(id) {
      const run = runs.get(id)
      if (!run || now() - run.createdAt > TTL_SECONDS * 1000) return null
      return snapshot(run.createdAt, [...run.events], now())
    },
  }
}
export function redisDemoRuns(redis: RedisEval, prefix: string): DemoRuns {
  const key = (id: string) => `${prefix}demo-run:${id}`
  return {
    async create(id) {
      return (
        Number(
          await redis.eval(
            `if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end redis.call('RPUSH', KEYS[1], ARGV[1]) redis.call('EXPIRE', KEYS[1], ARGV[2]) return 1`,
            [key(id)],
            [String(Date.now()), String(TTL_SECONDS)],
          ),
        ) === 1
      )
    },
    async append(id, event) {
      const ok = await redis.eval(
        `if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end redis.call('RPUSH', KEYS[1], ARGV[1]) return 1`,
        [key(id)],
        [JSON.stringify(event)],
      )
      if (Number(ok) !== 1) throw new Error('Run record expired')
    },
    async read(id) {
      const rows = (await redis.eval("return redis.call('LRANGE', KEYS[1], 0, -1)", [key(id)], [])) as string[]
      if (!rows.length) return null
      return snapshot(
        Number(rows[0]),
        rows.slice(1).map((row) => JSON.parse(row) as DemoEvent),
        Date.now(),
      )
    },
  }
}
let local: DemoRuns | undefined
export function demoRunsFromEnv(env: Record<string, string | undefined>): DemoRuns | null {
  const conn = redisFromEnv(env)
  if (conn) return redisDemoRuns(conn.redis, conn.prefix)
  if (env.VERCEL) return null
  local ??= memoryDemoRuns()
  return local
}
