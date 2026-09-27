import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GLOSSARY, STATUS_LABEL } from '../lib/glossary'

// §22.3: the public glossary (/docs/glossary) says the same as the module the screens use.
const md = readFileSync(join(import.meta.dirname, '..', '..', '..', 'docs', 'site', 'glossary.md'), 'utf8')
const norm = (s: string) => s.replace(/[’']/g, "'").toLowerCase()

describe('the published glossary matches lib/glossary', () => {
  it('lists every term with its code name', () => {
    for (const g of GLOSSARY) {
      expect(norm(md), g.people).toContain(norm(`| ${g.people} | ${g.agents} | ${g.code} |`))
    }
  })
  it('lists every status', () => {
    for (const label of Object.values(STATUS_LABEL)) expect(md).toContain(`| ${label} |`)
  })
})
