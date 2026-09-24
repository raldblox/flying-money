// Public-surface check for `pnpm verify` (BUILD_SPEC §21.2): after a production build of the site, no served HTML,
// markdown, llms file, route body, OG metadata, manifest, public asset or client/server bundle may contain an event
// term from denylist.txt.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dirname, '..', '..')
const web = join(root, 'apps', 'web')

export function denylist(): string[] {
  return readFileSync(join(import.meta.dirname, 'denylist.txt'), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
}

function* walk(dir: string): Generator<string> {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (name === 'cache' || name === 'dev' || name === 'types') continue
      yield* walk(p)
    } else yield p
  }
}

const SERVED = /\.(html|body|rsc|meta|json|js|css|txt|md|xml|webmanifest|svg)$/i

export function checkPublicSurface(): string[] {
  const next = join(web, '.next')
  if (!existsSync(join(next, 'BUILD_ID'))) return ['no production build found: run `pnpm build` first']
  const terms = denylist().map((t) => [t, t.toLowerCase()] as const)
  const targets = [join(next, 'server'), join(next, 'static'), join(web, 'public'), join(root, 'docs', 'site')]
  const findings: string[] = []
  for (const dir of targets)
    for (const f of walk(dir)) {
      if (!SERVED.test(f) || f.endsWith('.map') || f.endsWith('.nft.json')) continue
      const text = readFileSync(f, 'utf8').toLowerCase()
      for (const [term, lower] of terms) if (text.includes(lower)) findings.push(`${relative(root, f)}: "${term}"`)
    }
  return findings
}

if (process.argv[1]?.endsWith('check.ts')) {
  const f = checkPublicSurface()
  if (f.length) {
    console.error(`public-surface check: ${f.length} finding(s)\n${f.join('\n')}`)
    process.exit(1)
  }
  console.log('public-surface check: clean')
}
