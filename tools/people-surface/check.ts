// People-surface check for `pnpm verify` (BUILD_SPEC §22.3): the words people read on the account area, the wallet,
// the shop and till, and the landing page use the one vocabulary. It reads the source of those surfaces and checks
// only what a visitor sees: JSX text and sentence-like string literals (never identifiers, class names or comments).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(import.meta.dirname, '..', '..')
const web = join(root, 'apps', 'web')

/** Retired or banned on people surfaces (§22.3, §22.4). Code, docs and protocol pages keep their terms. */
export const DENIED = [
  'certificate',
  'certificates',
  'redeem',
  'redeemed',
  'gas',
  'holder',
  'holders',
  'giver',
  'givers',
  'sealed',
  'counting house',
  'dashboard',
  'guaranteed',
  'safe',
  'secure',
  'risk-free',
  'insured',
  'interest',
  'yield',
  'earn',
  'audited',
]
/** Honest phrases that contain a denied word. */
const ALLOWED = [
  /\bnot audited\b/gi,
  /\bunaudited\b/gi,
  /\bnot been audited\b/gi,
  /\bnot yet audited\b/gi,
  /\bsomewhere safe\b/gi,
  // the history of 飛錢 names the historical instrument
  /\ba certificate that paid out\b/gi,
]
/** Code shown to developers keeps the SDK's names, and code that slipped past the JSX-text rule isn't text. */
const isCode = (s: string) =>
  /\bimport\b|\bprocess\.env\b|: \[|=>|\bconst\b|\breturn\b|===|useState|\d+n\b|\bif \(/.test(s)

/** The people-facing surfaces (§22.3): paths relative to apps/web. */
export const SCOPE = [
  'app/app',
  'app/wallet',
  'app/shop',
  'app/page.tsx',
  'components/hero.tsx',
  'components/door.tsx',
  'components/step-explorer.tsx',
  'components/account',
  'components/app',
  'components/grant-summary.tsx',
  'components/test-note.tsx',
  'components/art/live-tally.tsx',
  'components/art/money-flow.tsx',
  'components/art/tally.tsx',
]

function* files(p: string): Generator<string> {
  if (!existsSync(p)) return
  if (statSync(p).isFile()) {
    if (/\.tsx?$/.test(p)) yield p
    return
  }
  for (const name of readdirSync(p)) yield* files(join(p, name))
}

/** A string that is only CSS classes or a path/identifier is not something people read. */
const looksLikeCode = (s: string) =>
  /^[\s]*$/.test(s) ||
  s.split(/\s+/).every((t) => /^[a-z0-9:[\]/.\-_%#()!,&>*=+'"]*$/.test(t) && (/[-:[/]/.test(t) || t === '')) ||
  /^[@./]/.test(s) ||
  /^[a-zA-Z0-9_.$-]+$/.test(s)

/** What a visitor reads in one source file. */
export function visibleText(src: string): string[] {
  // comments never render
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
  const out: string[] = []
  // string literals that read like words (not class lists, paths or keys)
  for (const m of code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
    const s = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' ')
    if (/[A-Za-z]/.test(s) && !looksLikeCode(s) && !isCode(s)) out.push(s)
  }
  // JSX text between tags
  for (const m of code.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)(?=[<{])/g)) {
    const s = m[1]!.trim()
    if (s && !/^[)\]};,]|=>|&&|\|\|/.test(s) && !isCode(s)) out.push(s)
  }
  return out
}

export function findDenied(text: string): string[] {
  let t = text
  for (const a of ALLOWED) t = t.replace(a, ' ')
  const hits: string[] = []
  for (const w of DENIED) if (new RegExp(`(^|[^a-z-])${w.replace(/-/g, '\\-')}([^a-z-]|$)`, 'i').test(t)) hits.push(w)
  return hits
}

export function checkPeopleSurface(): string[] {
  const findings: string[] = []
  for (const s of SCOPE)
    for (const f of files(join(web, s))) {
      const lines = readFileSync(f, 'utf8')
      for (const text of visibleText(lines))
        for (const w of findDenied(text)) findings.push(`${relative(root, f)}: "${w}" in “${text.slice(0, 90)}”`)
    }
  return findings
}

if (process.argv[1]?.endsWith('check.ts')) {
  const f = checkPeopleSurface()
  if (f.length) {
    console.error(`people-surface check: ${f.length} finding(s)\n${f.join('\n')}`)
    process.exit(1)
  }
  console.log('people-surface check: clean')
}
