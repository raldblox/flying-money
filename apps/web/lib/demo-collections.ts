import { redisFromEnv } from '@flying-money/server'
import type { Hex } from 'viem'

export interface DemoCollection {
  hash?: Hex
  startedAt: number
}
const local = new Map<string, DemoCollection>()
/** Claim before sending. An interrupted sender is never silently replaced by a new send. */
export function demoCollectionsFromEnv(env: Record<string, string | undefined>) {
  const connection = redisFromEnv(env)
  if (!connection && env.VERCEL) return null
  const key = (id: string) => `${connection?.prefix ?? ''}demo-collection:${id}`
  return {
    async read(id: string): Promise<DemoCollection | null> {
      if (!connection) return local.get(id) ?? null
      const raw = await connection.redis.eval("return redis.call('GET', KEYS[1])", [key(id)], [])
      return typeof raw === 'string' ? JSON.parse(raw) : null
    },
    async claim(id: string): Promise<boolean> {
      const record = { startedAt: Date.now() }
      if (!connection) {
        if (local.has(id)) return false
        local.set(id, record)
        return true
      }
      return (
        (await connection.redis.eval(
          "return redis.call('SET', KEYS[1], ARGV[1], 'NX')",
          [key(id)],
          [JSON.stringify(record)],
        )) === 'OK'
      )
    },
    async submitted(id: string, hash: Hex) {
      const record = { startedAt: Date.now(), hash }
      if (!connection) {
        local.set(id, record)
        return
      }
      await connection.redis.eval("return redis.call('SET', KEYS[1], ARGV[1])", [key(id)], [JSON.stringify(record)])
    },
  }
}
