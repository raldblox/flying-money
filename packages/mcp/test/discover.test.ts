import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { setLocalDeployment } from '@flying-money/chains'
import { createFlyingMoneyClient, memoryStore } from '@flying-money/client'
import type { Hex } from '@flying-money/core'
import { createOracle } from '@flying-money/oracle'
import { announceSeller, memoryStore as sellerStore } from '@flying-money/server'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { afterAll, expect, it } from 'vitest'
import { guardedFetch } from '../src/net-guard.js'
import { createFlyingMoneyMcp } from '../src/server.js'

// The local-network carrier: a seller announces itself over mDNS (`_flying-money._tcp`), an agent finds it with
// fm_discover, and only then may pay it, although it's a private address. Real multicast DNS on this machine.
setLocalDeployment({
  usdc: '0x00000000000000000000000000000000000c0c0c',
  flyingMoney: '0x00000000000000000000000000000000000f1f1f',
})
const payee = privateKeyToAccount(generatePrivateKey()).address
const oracle = createOracle({ accepts: ['anvil'], payee, store: sellerStore(), readCertificate: async () => null })
const http = createServer(async (req, res) => {
  const r = await oracle.app.fetch(new Request(`http://local${req.url}`, { method: req.method }))
  res.writeHead(r.status, Object.fromEntries(r.headers))
  res.end(Buffer.from(await r.arrayBuffer()))
})
await new Promise<void>((ok) => http.listen(0, ok))
const port = (http.address() as AddressInfo).port
const name = `Test Oracle ${Math.random().toString(36).slice(2, 8)}`
const announcement = announceSeller({ name, port, payee, chainIds: [31337], path: '/v1' })
afterAll(async () => {
  await announcement.stop()
  http.close()
})

it('an agent finds a seller on the local network, and may pay it only after finding it', {
  timeout: 20_000,
}, async () => {
  const fetch = guardedFetch()
  const fm = createFlyingMoneyClient({
    chains: ['anvil'],
    spender: privateKeyToAccount(generatePrivateKey()),
    store: memoryStore(),
    certificates: [],
    maxPricePerRequest: 50_000n,
    readCertificate: async () => null,
    fetch,
  })
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'local-agent', version: '0' })
  await Promise.all([
    createFlyingMoneyMcp({ client: fm, maxPricePerRequest: 50_000n, fetch }).connect(a),
    client.connect(b),
  ])
  const call = async (n: string, args: Record<string, unknown> = {}) => {
    const r = await client.callTool({ name: n, arguments: args })
    return { error: Boolean(r.isError), text: (r.content as Array<{ text: string }>)[0]!.text }
  }

  const found = JSON.parse((await call('fm_discover', { seconds: 3 })).text) as {
    sellers: Array<{ name: string; url: string; payee: Hex; networks: string[] }>
  }
  const mine = found.sellers.find((s) => s.name === name)
  expect(mine).toBeDefined()
  expect(mine).toMatchObject({ payee, networks: ['anvil'] })
  expect(mine!.url).toMatch(new RegExp(`^http://[^/]+:${port}/v1$`))

  // found, so reachable for this session: the quote comes back from the private address
  const q = await call('fm_quote', { url: `${mine!.url}/tea-price?city=Luoyang` })
  expect(q.error).toBe(false)
  expect(JSON.parse(q.text)).toMatchObject({ price: '0.01' })

  // a fresh session that never discovered it is still refused: private addresses stay blocked by default
  const fresh = guardedFetch()
  await expect(fresh(`${mine!.url}/tea-price?city=Luoyang`)).rejects.toThrow(/private, local or reserved/)
})
