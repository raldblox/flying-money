import { beforeEach, describe, expect, it } from 'vitest'
import { budgetLinkForShop, forgetTill, listTills, rememberTill, sellerFromLink } from '@/lib/shop-links'

const payee = '0x8dB423F3b8991865030BcE381F7A50EC517c7c50'

// BUILD_SPEC §22.10 e: a shop can hand customers a "get a budget for this shop" link; tills are remembered locally.
describe('get a budget for this shop', () => {
  it('opens the gift form pre-filled with this seller', () => {
    expect(budgetLinkForShop('https://example.test/', 'arbitrum-sepolia', payee, 'Tea & Co')).toBe(
      `https://example.test/app/give?for=person&chain=arbitrum-sepolia&seller=${payee}&name=Tea+%26+Co`,
    )
  })
  it('a seller read from a link is unverified, and bad input is ignored', () => {
    const q = new URLSearchParams(`seller=${payee}&name=Tea%20%26%20Co`)
    expect(sellerFromLink(q)).toEqual({ address: payee, name: 'Tea & Co', verified: false })
    expect(sellerFromLink(new URLSearchParams('seller=0x123&name=x'))).toBeUndefined()
    expect(sellerFromLink(new URLSearchParams(`seller=${payee}`))?.name).toBe('A shop from a link')
    expect(sellerFromLink(new URLSearchParams(`seller=${payee}&name=${'x'.repeat(200)}`))?.name.length).toBe(60)
  })
})

describe('your tills', () => {
  const mem = new Map<string, string>()
  beforeEach(() => {
    mem.clear()
    globalThis.localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    } as Storage
  })
  it('are remembered on this device, newest first, once each', () => {
    rememberTill({ chain: 'arbitrum-sepolia', payee, name: 'Tea' })
    rememberTill({ chain: 'arbitrum-sepolia', payee: payee.toLowerCase(), name: 'Tea house' })
    expect(listTills()).toHaveLength(1)
    expect(listTills()[0]?.name).toBe('Tea house')
    forgetTill('arbitrum-sepolia', payee)
    expect(listTills()).toEqual([])
  })
  it('survive a damaged store', () => {
    mem.set('fm-tills', '{nope')
    expect(listTills()).toEqual([])
  })
})
