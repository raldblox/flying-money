// `pnpm verify` (BUILD_SPEC §21.1): the single local gate before any deploy or submission. There is no hosted CI.
//   1 lint · 2 build · 3 typecheck (incl. doc samples) · 4 tests (C1, S1–S4 incl. Upstash when configured, forge
//   unit + invariants, e2e-on-anvil agent tests) · 5 secret scan · 6 public-surface check · 7 --e2e (Playwright)
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { checkPublicSurface } from '../public-surface/check.js'
import { scanSecrets } from './secrets.js'

const root = join(import.meta.dirname, '..', '..')
const e2e = process.argv.includes('--e2e')

// Only the store variables from .env reach the tests (so S4 also runs against Upstash); never the keys.
const env = { ...process.env }
const dotenv = join(root, '.env')
if (existsSync(dotenv))
  for (const line of readFileSync(dotenv, 'utf8').split(/\r?\n/)) {
    const m =
      /^(KV_REST_API_URL|KV_REST_API_TOKEN|UPSTASH_REDIS_REST_URL|UPSTASH_REDIS_REST_TOKEN|REDIS_URL)=\s*(\S+)/.exec(
        line,
      )
    // values may be quoted in .env ("…" or '…'), as Vercel's own `env pull` writes them
    if (m && !env[m[1]!]) env[m[1]!] = m[2]!.replace(/^(["'])(.*)\1$/, '$2')
  }

const steps: Array<[string, () => boolean]> = [
  ['lint (biome)', () => run('pnpm', ['lint'])],
  [
    'build (clean site build, so the public-surface check never sees stale chunks)',
    () => {
      // keep .next/cache (downloaded fonts, compiler cache); drop every other build artefact
      const next = join(root, 'apps', 'web', '.next')
      if (existsSync(next))
        for (const name of readdirSync(next))
          if (name !== 'cache') rmSync(join(next, name), { recursive: true, force: true })
      return run('pnpm', ['build'])
    },
  ],
  ['typecheck (incl. doc samples)', () => run('pnpm', ['typecheck'])],
  ['tests (C1, S1–S4, forge unit + invariants, agent e2e on anvil)', () => run('pnpm', ['test'])],
  ['secret scan', () => report(scanSecrets())],
  ['public-surface check', () => report(checkPublicSurface())],
  ...(e2e ? ([['Playwright e2e (anvil)', () => run('pnpm', ['--filter', '@flying-money/web', 'e2e'])]] as const) : []),
]

function run(cmd: string, args: string[]): boolean {
  const r = spawnSync(cmd, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' })
  return r.status === 0
}
function report(findings: string[]): boolean {
  for (const f of findings) console.error(`  ✗ ${f}`)
  return findings.length === 0
}

const upstash = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL
console.log(`pnpm verify${e2e ? ' --e2e' : ''} · S4 on Upstash: ${upstash ? 'yes' : 'no (no store env)'}\n`)
const started = Date.now()
for (const [i, [name, step]] of steps.entries()) {
  console.log(`\n── ${i + 1}/${steps.length} ${name}`)
  const t = Date.now()
  if (!step()) {
    console.error(`\n✗ verify FAILED at: ${name}`)
    process.exit(1)
  }
  console.log(`✓ ${name} (${((Date.now() - t) / 1000).toFixed(0)} s)`)
}
console.log(`\n✓ verify passed in ${((Date.now() - started) / 1000).toFixed(0)} s`)
