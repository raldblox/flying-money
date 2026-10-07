import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { allChains, baseRegistry, chainKeys, getChain, getChainById, rpcUrl, setLocalDeployment } from '../src/index.js'

// Expected values transcribed from BUILD_SPEC §5.4 (the normative table).
const SPEC = {
  'arbitrum-sepolia': [421614, '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', 'ETH', false],
  'monad-testnet': [10143, '0x534b2f3A21130d7a60830c2Df862319e593943A3', 'MON', false],
  'arc-testnet': [5042002, '0x3600000000000000000000000000000000000000', 'USDC', false],
  'arc-mainnet': [5042, '0x3600000000000000000000000000000000000000', 'USDC', true],
  'base-sepolia': [84532, '0x036CbD53842c5426634e7929541eC2318f3dCF7e', 'ETH', false],
  'ethereum-sepolia': [11155111, '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', 'ETH', false],
  'tempo-testnet': [42431, '0x20c0000000000000000000006a37da5c996874be', 'USD', false],
  anvil: [31337, '0x0000000000000000000000000000000000000000', 'ETH', false],
} as const

describe('chain registry (§5.4)', () => {
  it('has exactly the registered keys', () => {
    expect(chainKeys.sort()).toEqual(Object.keys(SPEC).sort())
  })

  for (const [key, [id, usdc, gas, mainnet]] of Object.entries(SPEC)) {
    it(`${key}: chain id, USDC, gas token, mainnet flag match the spec`, () => {
      const c = getChain(key)
      expect(c.chain.id).toBe(id)
      expect(c.usdc).toBe(usdc)
      expect(c.gasToken).toBe(gas)
      expect(c.mainnet).toBe(mainnet)
    })
  }

  it('the contract is unaudited: test networks are uncapped, and the only mainnet is capped (100 / 1,000 USDC)', () => {
    for (const c of allChains()) {
      if (c.mainnet) {
        expect(c.key).toBe('arc-mainnet')
        expect(c.maxFaceValue).toBe(100_000_000n)
        expect(c.maxTotalOutstanding).toBe(1_000_000_000n)
      } else {
        expect(c.maxFaceValue).toBe(0n)
        expect(c.maxTotalOutstanding).toBe(0n)
      }
    }
  })

  it('Arc has deterministic finality (confirmations 0) and USDC gas', () => {
    expect(getChain('arc-testnet').confirmations).toBe(0)
    expect(getChain('arc-mainnet').confirmations).toBe(0)
  })

  it('uses spec RPCs, and RPC_<KEY> env overrides them', () => {
    expect(rpcUrl('monad-testnet')).toBe('https://testnet-rpc.monad.xyz')
    expect(rpcUrl('arc-testnet')).toBe('https://rpc.testnet.arc.io')
    expect(rpcUrl('arc-mainnet')).toBe('https://rpc.mainnet.arc.io')
    expect(rpcUrl('arbitrum-sepolia', { RPC_ARBITRUM_SEPOLIA: 'http://x' })).toBe('http://x')
    for (const k of chainKeys) expect(rpcUrl(k)).toMatch(/^https?:\/\//)
  })

  it('every public chain has an explorer', () => {
    for (const c of allChains()) if (c.key !== 'anvil') expect(c.explorer).toMatch(/^https:\/\//)
  })

  it('getChainById round-trips; unknown keys throw', () => {
    for (const k of chainKeys) expect(getChainById(baseRegistry[k].chain.id)?.key).toBe(k)
    expect(() => getChain('solana')).toThrow()
  })

  it('only anvil can be registered at runtime', () => {
    setLocalDeployment({
      usdc: '0x00000000000000000000000000000000000000aa',
      flyingMoney: '0x00000000000000000000000000000000000000bb',
    })
    expect(getChain('anvil').usdc).toBe('0x00000000000000000000000000000000000000aa')
    expect(getChain('anvil').flyingMoney).toBe('0x00000000000000000000000000000000000000bb')
    expect(getChain('arbitrum-sepolia').usdc).toBe(SPEC['arbitrum-sepolia'][1])
  })

  it('generated Solidity registry files are up to date', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'registry')
    for (const k of chainKeys) {
      const j = JSON.parse(readFileSync(join(dir, `${k}.json`), 'utf8'))
      const c = baseRegistry[k]
      expect(j.chainId).toBe(c.chain.id)
      expect(j.usdc).toBe(c.usdc)
      expect(BigInt(j.maxFaceValue)).toBe(c.maxFaceValue)
      expect(BigInt(j.maxTotalOutstanding)).toBe(c.maxTotalOutstanding)
    }
  })
})

// Rule: no other code may hard-code a chain ID, RPC or USDC address (§5.4).
describe('no hard-coded chain values outside @flying-money/chains', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  const skipDirs = new Set([
    'node_modules',
    'dist',
    '.next',
    'out',
    'lib',
    'cache',
    'broadcast',
    '.git',
    '.turbo',
    '.legacy',
  ])
  const exts = /\.(ts|tsx|js|mjs|cjs|sol|json)$/
  const files: string[] = []
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      if (skipDirs.has(name)) continue
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (exts.test(name)) files.push(p)
    }
  }
  walk(root)
  const allowed = (p: string) => {
    const r = relative(root, p).split(sep).join('/')
    // contracts/deployments/ is git-ignored forge output that echoes registry values back
    return r.startsWith('packages/chains/') || r.startsWith('contracts/deployments/') || r === 'pnpm-lock.yaml'
  }
  const needles = Object.values(SPEC)
    .map(([, usdc]) => usdc.toLowerCase())
    .filter((u) => !/^0x0+$/.test(u))
  const rpcs = ['testnet-rpc.monad.xyz', 'rpc.testnet.arc.io', 'rpc.mainnet.arc.io']

  it('USDC addresses and spec RPCs appear only in the registry package', () => {
    const offenders: string[] = []
    for (const f of files) {
      if (allowed(f)) continue
      const s = readFileSync(f, 'utf8').toLowerCase()
      for (const n of [...needles, ...rpcs]) if (s.includes(n)) offenders.push(`${relative(root, f)}: ${n}`)
    }
    expect(offenders).toEqual([])
  })
})
