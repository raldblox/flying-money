import { setLocalDeployment } from '@flying-money/chains'
import { createFlyingMoneyClient, memoryStore } from '@flying-money/client'
import { type Certificate, certificateId, type Hex } from '@flying-money/core'
import { createOracle } from '@flying-money/oracle'
import { memoryStore as sellerStore } from '@flying-money/server'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { expect, it } from 'vitest'
import { createFlyingMoneyMcp } from '../src/server.js'

// One-shot `call` runs start a fresh process each time, with the payment log loaded from disk. The receipt fm_paid_fetch
// reports must be this call's price, not the running total (found by paying the live Oracle twice).
const CONTRACT: Hex = '0x00000000000000000000000000000000000f1f1f'
setLocalDeployment({ usdc: '0x00000000000000000000000000000000000c0c0c', flyingMoney: CONTRACT })

it('a fresh process reports this call’s price, with the running total from the saved log', async () => {
  const agent = privateKeyToAccount(generatePrivateKey())
  const payee = privateKeyToAccount(generatePrivateKey()).address
  const funder = privateKeyToAccount(generatePrivateKey()).address
  const cert: Certificate = {
    id: certificateId(31337, CONTRACT, funder, 0n),
    funder,
    payee,
    spender: agent.address,
    faceValue: 50_000n,
    redeemed: 0n,
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + 7 * 86_400),
    closed: false,
  }
  // reading the budget takes a network round trip in real life: the tool call arrives before it's loaded
  const reader = async (_c: number, _k: Hex, id: Hex) => {
    await new Promise((r) => setTimeout(r, 50))
    return id.toLowerCase() === cert.id.toLowerCase() ? { ...cert } : null
  }
  const oracle = createOracle({ accepts: ['anvil'], payee, store: sellerStore(), readCertificate: reader })
  const doFetch = ((u: RequestInfo | URL, init?: RequestInit) => oracle.app.fetch(new Request(u, init))) as typeof fetch
  const saved = memoryStore() // stands in for the file on disk, shared by both "processes"

  const run = async () => {
    const fm = createFlyingMoneyClient({
      chains: ['anvil'],
      spender: agent,
      store: saved,
      certificates: [cert.id],
      maxPricePerRequest: 50_000n,
      readCertificate: reader,
      fetch: doFetch,
    })
    const [a, b] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 'one-shot', version: '0' })
    await Promise.all([
      createFlyingMoneyMcp({ client: fm, maxPricePerRequest: 50_000n, fetch: doFetch }).connect(a),
      client.connect(b),
    ])
    const r = await client.callTool({
      name: 'fm_paid_fetch',
      arguments: { url: 'http://oracle.test/v1/tea-price?city=Luoyang' },
    })
    return JSON.parse((r.content as Array<{ text: string }>)[0]!.text)
  }

  expect((await run()).payment).toEqual({ price: '0.01', cumulative: '0.01' })
  expect((await run()).payment).toEqual({ price: '0.01', cumulative: '0.02' })
})
