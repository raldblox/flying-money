import { describe, expect, it } from 'vitest'
import { hasBrowserWallet, walletAppLinks } from '@/lib/wallet-apps'

// BUILD_SPEC §22.10 d: no dead end without a wallet; phone users can reopen the page inside a wallet app.
describe('wallet app links', () => {
  it('reopen the same page, path and query included', () => {
    const [mm, cb] = walletAppLinks('https://example.test/app/give?for=person')
    expect(mm?.href).toBe('https://metamask.app.link/dapp/example.test/app/give?for=person')
    expect(cb?.href).toBe('https://go.cb-w.com/dapp?cb_url=https%3A%2F%2Fexample.test%2Fapp%2Fgive%3Ffor%3Dperson')
  })
  it('detect an injected wallet', () => {
    expect(hasBrowserWallet({})).toBe(false)
    expect(hasBrowserWallet({ ethereum: undefined })).toBe(false)
    expect(hasBrowserWallet({ ethereum: {} })).toBe(true)
    expect(hasBrowserWallet(undefined)).toBe(false)
  })
})
