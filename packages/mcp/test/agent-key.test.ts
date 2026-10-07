import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getChain } from '@flying-money/chains'
import { afterEach, describe, expect, it } from 'vitest'
import { loadOrCreateAgentKey } from '../src/agent-key.js'
import { configFromEnv, deployedChains } from '../src/config.js'

// BUILD_SPEC §22.10 b: the MCP server makes and keeps its own spending key, so nobody runs a terminal command.
const dirs: string[] = []
const fresh = () => {
  const d = mkdtempSync(join(tmpdir(), 'fm-key-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('an agent never reaches real money by default', () => {
  it('defaults to test networks; a mainnet is used only when named in AGENT_CHAINS', () => {
    const defaults = deployedChains()
    expect(defaults.length).toBeGreaterThan(0)
    for (const k of defaults) expect(getChain(k).mainnet).toBe(false)
    expect(defaults).not.toContain('arc-mainnet')
    // naming it is allowed (an explicit opt-in); the server starts with it
    const store = join(fresh(), 'outbox.json')
    expect(() => configFromEnv({ AGENT_CHAINS: 'arc-mainnet', FM_STORE: store })).not.toThrow()
  })
})

describe('the MCP server keeps its own spending key (§22.10 b)', () => {
  it('creates a key on first run and reuses it after', () => {
    const file = join(fresh(), 'agent-key')
    const a = loadOrCreateAgentKey(file)
    expect(a.created).toBe(true)
    expect(a.key).toMatch(/^0x[0-9a-f]{64}$/)
    const b = loadOrCreateAgentKey(file)
    expect(b.created).toBe(false)
    expect(b.key).toBe(a.key)
    if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600)
  })

  it('refuses a damaged key file instead of silently replacing it', () => {
    const file = join(fresh(), 'agent-key')
    writeFileSync(file, 'not a key')
    expect(() => loadOrCreateAgentKey(file)).toThrow(/agent-key/)
    expect(readFileSync(file, 'utf8')).toBe('not a key')
  })

  it('FM_OWNER alone is enough to start; the key is kept next to the outbox and never exposed', () => {
    const dir = fresh()
    const cfg = configFromEnv({
      FM_OWNER: '0x8dB423F3b8991865030BcE381F7A50EC517c7c50',
      FM_STORE: join(dir, 'outbox.json'),
      AGENT_CHAINS: 'arbitrum-sepolia',
    })
    const key = readFileSync(join(dir, 'agent-key'), 'utf8').trim()
    expect(cfg.spendingAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(
      JSON.stringify({ ...cfg, client: undefined, fetch: undefined }, (_, v) =>
        typeof v === 'bigint' ? String(v) : v,
      ),
    ).not.toContain(key.slice(2))
    // same address on the next start
    expect(
      configFromEnv({ FM_OWNER: '0x8dB423F3b8991865030BcE381F7A50EC517c7c50', FM_STORE: join(dir, 'outbox.json') })
        .spendingAddress,
    ).toBe(cfg.spendingAddress)
  })

  it('an explicit AGENT_KEY still wins', () => {
    const dir = fresh()
    const cfg = configFromEnv({
      AGENT_KEY: `0x${'11'.repeat(32)}`,
      FM_OWNER: '0x8dB423F3b8991865030BcE381F7A50EC517c7c50',
      FM_STORE: join(dir, 'outbox.json'),
    })
    expect(cfg.spendingAddress.toLowerCase()).toBe('0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a')
  })
})
