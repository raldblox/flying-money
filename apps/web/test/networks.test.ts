import { describe, expect, it } from 'vitest'
import { liveNetworks } from '@/lib/networks'
import { deployedChains } from '@/lib/wagmi'

describe('live networks copy', () => {
  it('names every deployed network once, alphabetically, so no chain is featured over another', () => {
    const s = liveNetworks()
    for (const c of deployedChains()) expect(s).toContain(c.brand)
    expect(s).toMatch(/ and /)
    expect(s).not.toMatch(/Sepolia|Testnet/)
  })
})
