import { describe, expect, it } from 'vitest'
import { anvilAvailable } from '../src/anvil.js'
import { runLocalDemo } from '../src/local.js'
import { merchantPlan } from '../src/merchant.js'

describe.runIf(anvilAvailable())('§17 Phase 4 (local): Oracle + Merchant on anvil', () => {
  it('~20 paid calls, ≥ 1 on-chain redemption, payee paid exactly what was served', async () => {
    const lines: string[] = []
    const r = await runLocalDemo({ log: (l) => lines.push(l), offlineWeather: true })
    expect(merchantPlan()).toHaveLength(20)
    expect(r.merchant.calls).toBe(20)
    expect(r.merchant.served).toBe(20)
    expect(r.redemptions.length).toBeGreaterThanOrEqual(1)
    // 8×0.01 + 4×0.01 + 6×0.02 + 2×0.005 = 0.25 USDC
    expect(r.served).toBe(250_000n)
    expect(r.onchainRedeemed).toBe(250_000n)
    expect(r.payeeReceived).toBe(250_000n)
    expect(r.faceValue - r.onchainRedeemed).toBe(250_000n) // returns to the funder after expiry
    expect(r.merchant.bestTrade?.margin).toBeGreaterThan(0)
    expect(lines.some((l) => l.includes('redeemed on-chain'))).toBe(true)
  }, 120_000)
})
