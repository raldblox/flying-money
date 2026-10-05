import { getChain, setLocalDeployment } from '@flying-money/chains'
import {
  type Certificate,
  certificateId,
  type Hex,
  NOTE_HEADER,
  X402_REQUIRED_HEADER,
  X402_RESPONSE_HEADER,
  X402_SIGNATURE_HEADER,
  x402NoteFromPayload,
} from '@flying-money/core'
import { memoryStore as sellerMemoryStore } from '@flying-money/server'
import { flyingMoney } from '@flying-money/server/hono'
import { Hono } from 'hono'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import { createFlyingMoneyClient, memoryStore } from '../src/index.js'

const CONTRACT: Hex = '0x00000000000000000000000000000000000f1f1f'
setLocalDeployment({ usdc: '0x00000000000000000000000000000000000c0c0c', flyingMoney: CONTRACT })
const CHAIN_ID = getChain('anvil').chain.id

/** A seller reachable only over x402: every Flying-Money-* header is stripped, and the fm1 note header is refused. */
function x402OnlyWorld(opts: { dropFirstResponse?: boolean } = {}) {
  const payee = privateKeyToAccount(generatePrivateKey())
  const spenderKey = generatePrivateKey()
  const funder = privateKeyToAccount(generatePrivateKey()).address
  const id = certificateId(CHAIN_ID, CONTRACT, funder, 0n)
  const cert: Certificate = {
    id,
    funder,
    payee: payee.address,
    spender: privateKeyToAccount(spenderKey).address,
    faceValue: 100n,
    redeemed: 0n,
    expiresAt: BigInt(Math.floor(Date.now() / 1000)) + 7n * 86_400n,
    closed: false,
  }
  const reader = async (_c: number, _k: Hex, q: Hex) => (q.toLowerCase() === id.toLowerCase() ? { ...cert } : null)
  let served = 0
  const app = new Hono()
  app.use(
    '/v1/*',
    flyingMoney({
      accepts: ['anvil'],
      payee: payee.address,
      store: sellerMemoryStore(),
      readCertificate: reader,
      price: () => 10n,
      x402: true,
    }),
  )
  app.get('/v1/data', (c) => {
    served++
    return c.json({ ok: true })
  })
  const signatures: string[] = []
  let dropped = false
  const fetchX402Only = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const h = new Headers(init?.headers)
    if (h.has(NOTE_HEADER)) return new Response('x402 only', { status: 400 })
    const sig = h.get(X402_SIGNATURE_HEADER)
    if (sig) signatures.push(sig)
    const res = await app.request(String(input), init)
    if (opts.dropFirstResponse && sig && !dropped) {
      dropped = true
      throw new Error('network: connection reset') // the seller served it; the buyer never heard back
    }
    const out = new Response(res.body, res)
    for (const k of [...out.headers.keys()]) if (k.toLowerCase().startsWith('flying-money-')) out.headers.delete(k)
    return out
  }) as typeof fetch
  const client = createFlyingMoneyClient({
    chains: ['anvil'],
    spender: privateKeyToAccount(spenderKey),
    store: memoryStore(),
    certificates: [id],
    maxPricePerRequest: 10n,
    readCertificate: reader,
    fetch: fetchX402Only,
    retry: { backoffMs: 0 },
  })
  return { client, signatures, served: () => served }
}

describe('client pays an x402-only seller with the flying-money scheme', () => {
  it('reads PAYMENT-REQUIRED, pays with PAYMENT-SIGNATURE, and settles from PAYMENT-RESPONSE', async () => {
    const w = x402OnlyWorld()
    for (let i = 0; i < 3; i++) {
      const res = await w.client.fetch('http://seller/v1/data')
      expect(res.status).toBe(200)
      expect(res.headers.get(X402_RESPONSE_HEADER)).toBeTruthy()
    }
    expect(w.served()).toBe(3)
    expect(w.signatures.map((s) => x402NoteFromPayload(s).cumulative)).toEqual([10n, 20n, 30n])
    expect(w.client.status()[0]).toMatchObject({ spentLocal: 30n, consumed: 30n, pending: false })
  })

  it('C1 over x402: after a lost response the SAME slip is resent, never a higher one', async () => {
    const w = x402OnlyWorld({ dropFirstResponse: true })
    const res = await w.client.fetch('http://seller/v1/data')
    expect(res.status).toBe(200)
    expect(w.signatures).toHaveLength(2)
    expect(w.signatures[1]).toBe(w.signatures[0])
    expect(w.served()).toBe(1)
    expect(w.client.status()[0]).toMatchObject({ spentLocal: 10n, consumed: 10n })
  })

  it('a 402 offering only other x402 schemes is returned untouched, and nothing is signed', async () => {
    const required = btoa(
      JSON.stringify({
        x402Version: 2,
        resource: { url: 'http://seller/v1/data' },
        accepts: [
          {
            scheme: 'exact',
            network: `eip155:${CHAIN_ID}`,
            amount: '10',
            asset: '0x00000000000000000000000000000000000c0c0c',
            payTo: '0x00000000000000000000000000000000000d0d0d',
            maxTimeoutSeconds: 60,
            extra: { name: 'USDC', version: '2' },
          },
        ],
      }),
    )
    let calls = 0
    const signer = privateKeyToAccount(generatePrivateKey())
    const client = createFlyingMoneyClient({
      chains: ['anvil'],
      spender: signer,
      store: memoryStore(),
      certificates: [],
      maxPricePerRequest: 10n,
      readCertificate: async () => null,
      fetch: (async () => {
        calls++
        return new Response('pay me', { status: 402, headers: { [X402_REQUIRED_HEADER]: required } })
      }) as typeof fetch,
    })
    const res = await client.fetch('http://seller/v1/data')
    expect(res.status).toBe(402)
    expect(calls).toBe(1)
  })
})
