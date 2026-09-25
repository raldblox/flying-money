import { describe, expect, it } from 'vitest'
import { placeFromScan, verificationFor } from '../lib/contacts'

// Audit F4: a place is "✓ Scanned" only when its code was read by the camera in person. A pasted code or link is
// unverified, a shop-page link counts only from this site, and a shop's name never comes from a link.
const payee = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const own = 'useflyingmoney.vercel.app'

describe('F4: places from a scan or a paste', () => {
  it('reads a shop page link from this site, without taking the name from it', () => {
    const f = placeFromScan(`https://${own}/shop/arbitrum-sepolia/${payee}?name=Lantern%20Caf%C3%A9`, own)
    expect(f).toEqual({ chain: 'arbitrum-sepolia', payee })
    expect(f).not.toHaveProperty('name')
  })

  it('refuses a shop-page-shaped link on any other host', () => {
    expect(
      placeFromScan(`https://evil.example/shop/arbitrum-sepolia/${payee}?name=Lantern%20Caf%C3%A9`, own),
    ).toBeNull()
    expect(placeFromScan(`https://${own}.evil.example/shop/arbitrum-sepolia/${payee}`, own)).toBeNull()
  })

  it('only a camera scan earns "scanned"; a paste is unverified', () => {
    expect(verificationFor('camera')).toBe('scanned')
    expect(verificationFor('paste')).toBe('unverified')
  })
})
