// Extracts every ```ts block from docs/site/*.md and README.md into samples/, one module per block, so `tsc`
// typechecks them against the workspace packages. Blocks that are signatures (e.g. `interface …`) typecheck too.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const root = join(import.meta.dirname, '..', '..')
const out = join(import.meta.dirname, 'samples')
rmSync(out, { recursive: true, force: true })
mkdirSync(out)

const sources = [
  ...readdirSync(join(root, 'docs', 'site'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(root, 'docs', 'site', f)),
  join(root, 'README.md'),
]
let n = 0
for (const file of sources) {
  const md = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  let i = 0
  for (const m of md.matchAll(/```ts\n([\s\S]*?)```/g)) {
    const code = m[1]!
    // a module per block; `export {}` keeps top-level await and names local to the sample
    writeFileSync(join(out, `${basename(file, '.md')}-${++i}.ts`), `${code}\nexport {}\n`)
    n++
  }
}
console.log(`extracted ${n} TypeScript samples`)
