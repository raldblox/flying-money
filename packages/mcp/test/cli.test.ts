import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

// The binary's one-shot modes: an agent checks its setup before a restart, and agents without MCP (any language) run
// the same tools as commands. Runs the source with tsx, so no build is needed; no network is touched.
const bin = join(__dirname, '..', 'src', 'bin.ts')
const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function run(args: string[], env: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'fm-cli-'))
  dirs.push(dir)
  const r = spawnSync(process.execPath, ['--import', 'tsx', bin, ...args], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', FM_STORE: join(dir, 'outbox.json'), ...env },
    timeout: 30_000,
  })
  return { code: r.status, out: r.stdout, err: r.stderr }
}

const OWNER = { FM_OWNER: '0x8dB423F3b8991865030BcE381F7A50EC517c7c50' }

describe('flying-money-mcp one-shot modes', { timeout: 60_000 }, () => {
  it('--help lists the modes and every tool', () => {
    const r = run(['--help'])
    expect(r.code).toBe(0)
    for (const s of ['--check', 'call <tool>', '--http', 'fm_paid_fetch', 'fm_request_budget', 'FM_OWNER'])
      expect(r.out).toContain(s)
  })

  it('--check lists the tools and prints fm_status, never the key', () => {
    const r = run(['--check'], OWNER)
    expect(r.code).toBe(0)
    const j = JSON.parse(r.out)
    expect(j.ok).toBe(true)
    expect(j.tools).toEqual(expect.arrayContaining(['fm_status', 'fm_quote', 'fm_paid_fetch', 'fm_request_budget']))
    expect(j.fm_status.spendingAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(r.out + r.err).not.toMatch(/0x[0-9a-fA-F]{64}/)
  })

  it('call runs one tool and prints its result on stdout', () => {
    const r = run(['call', 'fm_explain'], OWNER)
    expect(r.code).toBe(0)
    expect(r.out).toMatch(/You pay APIs with Flying Money budgets/)
  })

  it('call refuses an unknown tool or input that is not JSON, with exit code 2', () => {
    expect(run(['call', 'fm_nope'], OWNER).code).toBe(2)
    expect(run(['call', 'fm_quote', 'not json'], OWNER).code).toBe(2)
  })

  it('starts without an owner and says what to ask for; a malformed owner is a one-line error', () => {
    const r = run(['--check'])
    expect(r.code).toBe(0)
    expect(JSON.parse(r.out).fm_status.next).toMatch(/no owner yet/i)
    const bad = run(['--check'], { FM_OWNER: '0x123' })
    expect(bad.code).toBe(1)
    expect(bad.err.trim().split(/\r?\n/)).toHaveLength(1)
    expect(bad.err).toMatch(/FM_OWNER/)
  })
})
