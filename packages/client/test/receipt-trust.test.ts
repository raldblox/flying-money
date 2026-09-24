import { getChain, setLocalDeployment } from '@flying-money/chains'
import {
  type Certificate,
  certificateId,
  decodeReceipt,
  encodeHeader,
  type Hex,
  RECEIPT_HEADER,
} from '@flying-money/core'
import { memoryStore as sellerMemoryStore } from '@flying-money/server'
import { flyingMoney } from '@flying-money/server/hono'
import { Hono } from 'hono'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import { type ClientEvent, createFlyingMoneyClient, memoryStore } from '../src/index.js'

const CONTRACT: Hex = '0x00000000000000000000000000000000000f1f1f'
setLocalDeployment({ usdc: '0x00000000000000000000000000000000000c0c0c', flyingMoney: CONTRACT })
const CHAIN_ID = getChain('anvil').chain.id

/** An honest §6.5 seller behind a man-in-the-middle that may rewrite every receipt. */
function world(face: bigint, forge: (r: ReturnType<typeof decodeReceipt>) => ReturnType<typeof decodeReceipt>) {
  const payee = privateKeyToAccount(generatePrivateKey())
  const spenderKey = generatePrivateKey()
  const funder = privateKeyToAccount(generatePrivateKey()).address
  const id = certificateId(CHAIN_ID, CONTRACT, funder, 0n)
  const cert: Certificate = {
    id,
    funder,
    payee: payee.address,
    spender: privateKeyToAccount(spenderKey).address,
    faceValue: face,
    redeemed: 0n,
    expiresAt: BigInt(Math.floor(Date.now() / 1000)) + 7n * 86_400n,
    closed: false,
  }
  const reader = async (_c: number, _k: Hex, q: Hex) => (q.toLowerCase() === id.toLowerCase() ? { ...cert } : null)
  const app = new Hono()
  app.use(
    '/v1/*',
    flyingMoney({
      accepts: ['anvil'],
      payee: payee.address,
      store: sellerMemoryStore(),
      readCertificate: reader,
      price: () => 1n,
    }),
  )
  app.get('/v1/data', (c) => c.text('ok'))
  const evil = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await app.request(String(input), init)
    const rh = res.headers.get(RECEIPT_HEADER)
    if (!rh) return res
    const out = new Response(res.body, res)
    out.headers.set(RECEIPT_HEADER, encodeHeader(forge(decodeReceipt(rh))))
    return out
  }) as typeof fetch
  const signed: bigint[] = []
  const spender = privateKeyToAccount(spenderKey)
  const spy = {
    ...spender,
    signTypedData: async (p: Parameters<typeof spender.signTypedData>[0]) => {
      signed.push((p.message as { cumulative: bigint }).cumulative)
      return spender.signTypedData(p)
    },
  } as typeof spender
  const events: ClientEvent[] = []
  const client = createFlyingMoneyClient({
    chains: ['anvil'],
    spender: spy,
    store: memoryStore(),
    certificates: [id],
    maxPricePerRequest: 1n,
    readCertificate: reader,
    fetch: evil,
    onEvent: (e) => events.push(e),
  })
  return { client, signed, events, cert }
}

describe('F2 (D33): the client never trusts receipt numbers beyond what it signed', () => {
  it('a receipt claiming accepted = faceValue does not make the next note sign the whole budget', async () => {
    const face = 100_000_000n
    const w = world(face, (r) => ({ ...r, accepted: face, consumed: 0n, reserved: 0n }))
    for (let i = 0; i < 3; i++) await w.client.fetch('http://oracle.test/v1/data').catch(() => {})
    expect(w.signed.length).toBeGreaterThan(1)
    // with a cap of 1 per request, the n-th note is at most n
    for (const [i, c] of w.signed.entries()) expect(c).toBeLessThanOrEqual(BigInt(i + 1))
    expect(w.events.some((e) => e.type === 'suspicious-receipt')).toBe(true)
  })

  it('property: under random forged receipts, every note is ≤ the highest earlier note + one price', async () => {
    for (let run = 0; run < 5; run++) {
      const face = 1_000_000n
      const rnd = () => (Math.random() < 0.3 ? 0n : BigInt(Math.floor(Math.random() * 400_000)))
      const w = world(face, (r) => ({ ...r, accepted: rnd(), consumed: rnd(), reserved: rnd() }))
      for (let i = 0; i < 30; i++) await w.client.fetch('http://oracle.test/v1/data').catch(() => {})
      let high = 0n
      for (const c of w.signed) {
        expect(c).toBeLessThanOrEqual(high + 1n)
        if (c > high) high = c
      }
    }
  })

  it('a receipt for a different certificate is refused and changes nothing', async () => {
    const other = `0x${'ee'.repeat(32)}` as Hex
    const w = world(1_000n, (r) => ({ ...r, certificateId: other, accepted: 1_000n }))
    await expect(w.client.fetch('http://oracle.test/v1/data')).rejects.toThrow(/certificate/i)
    expect(w.client.status()[0]).toMatchObject({ pending: true })
    await w.client.fetch('http://oracle.test/v1/data').catch(() => {})
    expect(w.signed.every((c) => c <= 1n)).toBe(true) // the pending note was resent, never re-signed
  })
})
