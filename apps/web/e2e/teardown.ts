import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/** Stops the e2e anvil and removes the git-ignored e2e files. */
export default function teardown() {
  const root = join(import.meta.dirname, '..')
  const state = join(root, '.e2e-state.json')
  if (existsSync(state)) {
    const { anvilPid } = JSON.parse(readFileSync(state, 'utf8')) as { anvilPid?: number }
    try {
      if (anvilPid) process.kill(anvilPid)
    } catch {}
  }
  rmSync(state, { force: true })
  rmSync(join(root, '.env.development.local'), { force: true })
}
