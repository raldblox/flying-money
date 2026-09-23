import { getChain, setLocalDeployment } from '@flying-money/chains'
import { type Certificate, certificateId, encodeHeader, type Hex, newRequestId, signNote } from '@flying-money/core'
import RedisMock from 'ioredis-mock'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { memoryStore, type NoteStore, redisStore, upstashStore } from '../src/index.js'

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

/** Stores under test: memory + Redis Lua (in-process mock always; real Redis / Upstash when configured). */
export function storeFactories(): Array<[string, () => NoteStore]> {
  const f: Array<[string, () => NoteStore]> = [
    ['memory', () => memoryStore()],
    ['redis Lua (ioredis-mock)', () => redisStore(new RedisMock(), { prefix: `t:${rand()}:` })],
  ]
  if (process.env.REDIS_URL) {
    const url = process.env.REDIS_URL
    f.push(['redis Lua (real Redis, REDIS_URL)', () => redisStore(url, { prefix: `t:${rand()}:` })])
  }
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    f.push(['redis Lua (Upstash)', () => upstashStore({ url, token }, { prefix: `t:${rand()}:` })])
  }
  return f
}
