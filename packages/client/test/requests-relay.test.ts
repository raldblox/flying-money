import { getChain, setLocalDeployment } from '@flying-money/chains'
import {
  type Certificate,
  certificateId,
  encodeRequestGrant,
  grantTypedData,
  type Hex,
  newRequestId,
  type RequestGrant,
} from '@flying-money/core'
import { createInbox, memoryInboxStore } from '@flying-money/server'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import { createFlyingMoneyClient, memoryRequestStore, memoryStore } from '../src/index.js'

// §21.4.5: with an owner grant configured, requestBudget goes to the relay inbox (no link to pass around); the owner's
// decision comes back through requestStatus, and "approved" is still only believed after reading the chain (R2).
const CONTRACT: Hex = '0x00000000000000000000000000000000000f1f1f'
setLocalDeployment({ usdc: '0x00000000000000000000000000000000000c0c0c', flyingMoney: CONTRACT })
const CHAIN_ID = getChain('anvil').chain.id
const RELAY = 'https://site.test/api/requests'

function world() {
  const owner = privateKeyToAccount(generatePrivateKey())
  const agent = privateKeyToAccount(generatePrivateKey())
  const payee = privateKeyToAccount(generatePrivateKey()).address
  let approval: string | null = null
  const inbox = createInbox({
    store: memoryInboxStore(),
    isChain: (id) => id === CHAIN_ID,
    checkApproval: async () => approval,
  })
  const certs = new Map<string, Certificate>()
  // the relay's HTTP surface, in-process
  const relayFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    try {
      if (url.pathname === '/api/requests' && init?.method === 'POST')
        return Response.json(await inbox.submit(JSON.parse(String(init.body))), { status: 201 })
      const m = /^\/api\/requests\/(0x[0-9a-fA-F]{64})$/.exec(url.pathname)
      if (m) {
        const s = await inbox.status(m[1]!)
        return s ? Response.json(s) : Response.json({ error: 'not-found' }, { status: 404 })
      }
    } catch (e) {
      const err = e as { status?: number; code?: string }
      return Response.json({ error: err.code }, { status: err.status ?? 500 })
    }
    return new Response('not found', { status: 404 })
  }) as typeof fetch
  const grant = async (g: Partial<RequestGrant> = {}) => {
    const gr: RequestGrant = {
      owner: owner.address,
      requester: agent.address,
      maxAmountPerRequest: 1_000_000n,
      expiresAt: BigInt(Math.floor(Date.now() / 1000) + 30 * 86_400),
      grantId: newRequestId(),
      ...g,
    }
    return encodeRequestGrant({
      grant: gr,
      chainId: CHAIN_ID,
      sig: await owner.signTypedData(grantTypedData(CHAIN_ID, gr)),
    })
  }
  const requestStore = memoryRequestStore()
  const client = (ownerGrant?: string) =>
    createFlyingMoneyClient({
      chains: ['anvil'],
      spender: agent,
      store: memoryStore(),
      certificates: [],
      maxPricePerRequest: 50_000n,
      owner: owner.address,
      requestLinkBase: 'https://site.test',
      requestStore,
      fetch: relayFetch,
      readCertificate: async (_c, _k, id) => certs.get(id.toLowerCase()) ?? null,
      ...(ownerGrant ? { ownerGrant, relayUrl: RELAY } : {}),
    })
  return {
    owner,
    agent,
    payee,
    inbox,
    grant,
    client,
    certs,
    allowApproval: (r: string | null) => {
      approval = r
    },
  }
}

describe('budget requests through the relay inbox (§21.4.5)', () => {
  it('with a grant, the request lands in the owner’s inbox and no link is handed out', async () => {
    const w = world()
    const c = w.client(await w.grant())
    await c.ready
    const r = await c.requestBudget({ payee: w.payee, chain: 'anvil', amount: 500_000n, days: 7, reason: 'Tea prices' })
    expect(r.via).toBe('relay')
    expect(r.link).toBeUndefined()
    expect(r.status).toBe('asked')
    const inbox = await w.inbox.list(w.owner.address)
    expect(inbox.map((x) => x.requestId)).toEqual([r.requestId.toLowerCase()])
  })

  it('without a grant it falls back to the link channel', async () => {
    const w = world()
    const c = w.client()
    await c.ready
    const r = await c.requestBudget({ payee: w.payee, chain: 'anvil', amount: 500_000n, days: 7, reason: 'x' })
    expect(r.via).toBe('link')
    expect(r.link).toMatch(/#fm1\./)
  })

  it('refuses before sending: more than the grant allows', async () => {
    const w = world()
    const c = w.client(await w.grant({ maxAmountPerRequest: 100_000n }))
    await c.ready
    await expect(
      c.requestBudget({ payee: w.payee, chain: 'anvil', amount: 500_000n, days: 7, reason: 'x' }),
    ).rejects.toThrow(/grant allows/)
  })

  it('a decline comes back through requestStatus; the request survives a restart', async () => {
    const w = world()
    const g = await w.grant()
    const c = w.client(g)
    await c.ready
    const r = await c.requestBudget({ payee: w.payee, chain: 'anvil', amount: 500_000n, days: 7, reason: 'x' })
    await w.inbox.decide(w.owner.address, r.requestId, { declined: { note: 'not now' } })
    const restarted = w.client(g)
    await restarted.ready
    expect((await restarted.requestStatus(r.requestId)).status).toBe('declined')
  })

  it('"approved" from the relay is believed only after reading the budget itself (R2)', async () => {
    const w = world()
    const c = w.client(await w.grant())
    await c.ready
    const r = await c.requestBudget({ payee: w.payee, chain: 'anvil', amount: 500_000n, days: 7, reason: 'x' })
    // the relay says approved, but the budget on-chain is for another spender: not adopted
    const id = certificateId(CHAIN_ID, CONTRACT, w.owner.address, 0n)
    const cert: Certificate = {
      id,
      funder: w.owner.address,
      payee: w.payee,
      spender: privateKeyToAccount(generatePrivateKey()).address,
      faceValue: 500_000n,
      redeemed: 0n,
      expiresAt: BigInt(Math.floor(Date.now() / 1000) + 7 * 86_400),
      closed: false,
    }
    w.certs.set(id.toLowerCase(), cert)
    await w.inbox.decide(w.owner.address, r.requestId, { approved: { certificateId: id, txHash: newRequestId() } })
    expect((await c.requestStatus(r.requestId)).status).toBe('asked')
    // the real one: spendable by this agent, payable to the payee, funded by the owner
    w.certs.set(id.toLowerCase(), { ...cert, spender: w.agent.address })
    const ok = await c.requestStatus(r.requestId)
    expect(ok).toMatchObject({ status: 'approved', certificateId: id })
    expect(c.status().some((s) => s.id.toLowerCase() === id.toLowerCase())).toBe(true)
  })
})
