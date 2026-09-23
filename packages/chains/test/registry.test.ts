import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  allChains,
  baseRegistry,
  chainKeys,
  getChain,
  getChainById,
  MAINNET_MAX_FACE_VALUE,
  MAINNET_MAX_TOTAL_OUTSTANDING,
  rpcUrl,
  setLocalDeployment,
} from '../src/index.js'

// Expected values transcribed from BUILD_SPEC §5.4 (the normative table).
const SPEC = {
  arbitrum: [42161, '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 'ETH', true],
  'arbitrum-sepolia': [421614, '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', 'ETH', false],
  monad: [143, '0x754704Bc059F8C67012fEd69BC8A327a5aafb603', 'MON', true],
  'monad-testnet': [10143, '0x534b2f3A21130d7a60830c2Df862319e593943A3', 'MON', false],
  arc: [5042, '0x3600000000000000000000000000000000000000', 'USDC', true],
  'arc-testnet': [5042002, '0x3600000000000000000000000000000000000000', 'USDC', false],
  base: [8453, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 'ETH', true],
  'base-sepolia': [84532, '0x036CbD53842c5426634e7929541eC2318f3dCF7e', 'ETH', false],
  anvil: [31337, '0x0000000000000000000000000000000000000000', 'ETH', false],
} as const

describe('chain registry (§5.4)', () => {
  it('has exactly the nine spec keys', () => {
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

  it('mainnets carry both caps (100 / 1,000 USDC); testnets are unlimited (0)', () => {
    for (const c of allChains()) {
      if (c.mainnet) {
        expect(c.maxFaceValue).toBe(100_000_000n)
        expect(c.maxTotalOutstanding).toBe(1_000_000_000n)
      } else {
        expect(c.maxFaceValue).toBe(0n)
        expect(c.maxTotalOutstanding).toBe(0n)
      }
    }
    expect(MAINNET_MAX_FACE_VALUE).toBe(100_000_000n)
    expect(MAINNET_MAX_TOTAL_OUTSTANDING).toBe(1_000_000_000n)
  })

  it('Arc has deterministic finality (confirmations 0) and USDC gas', () => {
    expect(getChain('arc').confirmations).toBe(0)
    expect(getChain('arc-testnet').confirmations).toBe(0)
  })

  it('uses spec RPCs, and RPC_<KEY> env overrides them', () => {
    expect(rpcUrl('monad-testnet')).toBe('https://testnet-rpc.monad.xyz')
    expect(rpcUrl('arc-testnet')).toBe('https://rpc.testnet.arc.io')
    expect(rpcUrl('arc')).toBe('https://rpc.mainnet.arc.io')
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
    expect(getChain('arbitrum').usdc).toBe(SPEC.arbitrum[1])
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
    return r.startsWith('packages/chains/') || r === 'pnpm-lock.yaml'
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
