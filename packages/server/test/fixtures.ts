import { getChain, setLocalDeployment } from '@flying-money/chains'
import { type Certificate, certificateId, encodeHeader, type Hex, newRequestId, signNote } from '@flying-money/core'
import { Redis as UpstashRedis } from '@upstash/redis'
import RedisMock from 'ioredis-mock'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { afterAll } from 'vitest'
import { memoryStore, type NoteStore, redisStore, type StoreSnapshot, upstashEnv, upstashStore } from '../src/index.js'

/** Test prefixes created on Upstash in this run; deleted afterwards (§21.1). */
const upstashPrefixes = new Set<string>()
afterAll(async () => {
  const up = upstashEnv()
  if (!up || upstashPrefixes.size === 0) return
  const r = new UpstashRedis(up)
  for (const prefix of upstashPrefixes) {
    let cursor = '0'
    do {
      const [next, keys] = await r.scan(cursor, { match: `${prefix}*`, count: 500 })
      if (keys.length) await r.del(...keys)
      cursor = String(next)
    } while (cursor !== '0')
  }
}, 300_000) // one SCAN/DEL round trip per page and prefix over HTTPS

/**
 * The shop till's store: memoryStore persisted through onCommit (IndexedDB in the browser). To prove nothing lives
 * only in memory, every call runs on a store freshly re-opened from the last saved JSON (a "restart" per call).
 */
export function reopenedStore(): NoteStore {
  let saved: string | undefined
  const open = () =>
    memoryStore({
      ...(saved ? { initial: JSON.parse(saved) as StoreSnapshot } : {}),
      onCommit: async (snap) => {
        saved = JSON.stringify(snap)
      },
    })
  return new Proxy({} as NoteStore, {
    get:
      (_t, prop) =>
      (...args: unknown[]) =>
        (open() as unknown as Record<string, (...a: unknown[]) => unknown>)[prop as string]!(...args),
  })
}

export const CONTRACT: Hex = '0x00000000000000000000000000000000000f1f1f'
export const USDC: Hex = '0x00000000000000000000000000000000000c0c0c'
setLocalDeployment({ usdc: USDC, flyingMoney: CONTRACT })
export const CHAIN_ID = getChain('anvil').chain.id

export const payee = privateKeyToAccount(generatePrivateKey())
export const funder = privateKeyToAccount(generatePrivateKey())

/** A fake chain: certificates the server "reads", mutable by tests (topUp, redeem, expiry). */
export class FakeChain {
  certs = new Map<string, Certificate>()
  reads = 0
  down = false
  private nonce = 0n

  issue(opts: { faceValue: bigint; expiresAt: bigint; payee?: Hex; spender: Hex }): Certificate {
    const id = certificateId(CHAIN_ID, CONTRACT, funder.address, this.nonce++)
    const c: Certificate = {
      id,
      funder: funder.address,
      payee: opts.payee ?? payee.address,
      spender: opts.spender,
      faceValue: opts.faceValue,
      redeemed: 0n,
      expiresAt: opts.expiresAt,
      closed: false,
    }
    this.certs.set(id.toLowerCase(), c)
    return c
  }

  reader = async (_chainId: number, _contract: Hex, id: Hex): Promise<Certificate | null> => {
    if (this.down) throw new Error('RPC down')
    this.reads++
    const c = this.certs.get(id.toLowerCase())
    return c ? { ...c } : null
  }
}

export class Clock {
  constructor(public t = 1_800_000_000) {}
  now = () => this.t
}

export async function note(spenderKey: Hex, id: Hex, cumulative: bigint, memo: Hex = newRequestId()) {
  const s = await signNote(privateKeyToAccount(spenderKey), CHAIN_ID, CONTRACT, { certificateId: id, cumulative, memo })
  return { signed: s, header: encodeHeader(s) }
}

const rand = () => Math.random().toString(36).slice(2)

/** Remote stores (real Redis, Upstash over HTTPS) pay a network round trip per call: allow them more time. */
export const remoteTimeout = (name: string) => (/Upstash|real Redis/.test(name) ? 120_000 : 5_000)

/** Stores under test: memory + Redis Lua (in-process mock always; real Redis / Upstash when configured). */
export function storeFactories(): Array<[string, () => NoteStore]> {
  const f: Array<[string, () => NoteStore]> = [
    ['memory', () => memoryStore()],
    ['memory, persisted and re-opened on every call (shop till)', reopenedStore],
    ['redis Lua (ioredis-mock)', () => redisStore(new RedisMock(), { prefix: `t:${rand()}:` })],
  ]
  if (process.env.REDIS_URL) {
    const url = process.env.REDIS_URL
    f.push(['redis Lua (real Redis, REDIS_URL)', () => redisStore(url, { prefix: `t:${rand()}:` })])
  }
  const up = upstashEnv()
  if (up) {
    f.push([
      'redis Lua (Upstash)',
      () => {
        const prefix = `fm:test:${rand()}:`
        upstashPrefixes.add(prefix)
        return upstashStore(up, { prefix })
      },
    ])
  }
  return f
}
