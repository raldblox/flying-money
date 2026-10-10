import { mockUsdcAbi } from '@flying-money/abi'
import { setLocalDeployment } from '@flying-money/chains'
import { createWalletClient, erc20Abi, http } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { anvil as anvilChain } from 'viem/chains'
import { describe, expect, it } from 'vitest'
import { anvilAccount, anvilAvailable, deployLocal, startAnvil } from '../src/anvil.js'
import { type LiveEvent, runLiveDemo } from '../src/live.js'

// §13.3 scenario buttons, run live on anvil: every outcome is a real check, nothing is faked.
describe.runIf(anvilAvailable())('/demo scenarios on anvil', () => {
  it('cut the network: payments keep flowing, then one transaction collects; a thief with the key gets nothing', async () => {
    const node = await startAnvil()
    try {
      const { pub, usdc, flyingMoney, wait } = await deployLocal(node.url)
      setLocalDeployment({ usdc, flyingMoney })
      const funder = anvilAccount(1)
      const fw = createWalletClient({ account: funder, chain: anvilChain, transport: http(node.url) })
      await wait(await fw.writeContract({ address: usdc, abi: mockUsdcAbi, functionName: 'faucet' }))
      const payee = privateKeyToAccount(generatePrivateKey()).address
      const events: LiveEvent[] = []
      const done = await runLiveDemo({
        chain: 'anvil',
        funder,
        agent: privateKeyToAccount(generatePrivateKey()),
        redeemer: anvilAccount(2),
        payee,
        faceValue: 300_000n,
        env: { RPC_ANVIL: node.url },
        transport: 'in-process',
        scenarios: { cutNetwork: true, stealKey: true },
        fetchWeather: async () => ({ temperature_c: 20, wind_kmh: 5, time: new Date().toISOString() }),
        onEvent: (e) => events.push(e),
      })

      // cut and restore happened, and notes were accepted while the seller's chain connection was down
      const downAt = events.findIndex((e) => e.type === 'network' && e.down)
      const upAt = events.findIndex((e) => e.type === 'network' && !e.down)
      expect(downAt).toBeGreaterThan(0)
      expect(upAt).toBeGreaterThan(downAt)
      expect(events.slice(downAt, upAt).filter((e) => e.type === 'accepted').length).toBeGreaterThan(3)
      expect(events.slice(downAt, upAt).some((e) => e.type === 'redeemed')).toBe(false)

      // the thief's three attempts are all refused
      const thief = events.filter((e): e is Extract<LiveEvent, { type: 'thief' }> => e.type === 'thief')
      expect(thief).toHaveLength(3)
      expect(thief.every((t) => t.refused)).toBe(true)
      expect(thief[1]!.detail).toContain('ExceedsFaceValue')
      expect(thief[2]!.detail).toContain('wrong-payee')

      // and the payee received exactly what was served
      expect(done.served).toBe(19)
      expect(events.filter((e) => e.type === 'answer')).toHaveLength(19)
      const paid = await pub.readContract({ address: usdc, abi: erc20Abi, functionName: 'balanceOf', args: [payee] })
      expect(paid.toString()).toBe(done.consumed)
      expect(done.redeemed).toBe(done.consumed)
    } finally {
      node.stop()
    }
  }, 180_000)
})
