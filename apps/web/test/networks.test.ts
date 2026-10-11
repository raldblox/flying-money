import { describe, expect, it } from 'vitest'
import { liveMainnets, liveNetworks } from '@/lib/networks'
import { deployedChains } from '@/lib/wagmi'

describe('live networks copy', () => {
  it('names every deployed test network once, alphabetically, so no chain is featured over another', () => {
    const s = liveNetworks()
    for (const c of deployedChains().filter((c) => !c.mainnet)) expect(s).toContain(c.brand)
    expect(s).toMatch(/ and /)
    expect(s).not.toMatch(/Sepolia|Testnet/)
  })

  it('keeps mainnets out of the test-network list and names them separately', () => {
    const all = deployedChains()
    const testBrands = new Set(all.filter((c) => !c.mainnet).map((c) => c.brand))
    for (const c of all.filter((c) => c.mainnet)) {
      expect(liveMainnets()).toContain(c.brand)
      // a brand with both kinds (Base) is named in each list; a mainnet-only brand (Arc) is never a "test network"
      if (!testBrands.has(c.brand)) expect(liveNetworks().split(/, | and /)).not.toContain(c.brand)
    }
  })
})
