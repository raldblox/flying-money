import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Hex } from 'viem'
import { generatePrivateKey } from 'viem/accounts'

/**
 * BUILD_SPEC §22.10 b: without AGENT_KEY, the server makes its own spending key on first run and keeps it in a file
 * only this user can read (mode 0600), next to its outbox. A spending key holds no money (§3.9); it can only sign
 * slips for budgets its owner funds. The key is never printed, returned by a tool, or sent anywhere.
 */
export function loadOrCreateAgentKey(file: string): { key: Hex; created: boolean } {
  if (existsSync(file)) {
    const v = readFileSync(file, 'utf8').trim()
    if (!/^0x[0-9a-fA-F]{64}$/.test(v))
      throw new Error(
        `${file} doesn't hold a spending key (0x + 64 hex). Fix or move the agent-key file; it is not replaced automatically.`,
      )
    return { key: v as Hex, created: false }
  }
  mkdirSync(dirname(file), { recursive: true })
  const key = generatePrivateKey()
  // 'wx': never overwrite a key another process just created
  try {
    writeFileSync(file, `${key}\n`, { mode: 0o600, flag: 'wx' })
  } catch {
    return loadOrCreateAgentKey(file)
  }
  return { key, created: true }
}
