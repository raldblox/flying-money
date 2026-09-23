// Test helper: spawn a private anvil on a free port (anvil ships with Foundry, which CI installs).
import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'

export const anvilAvailable = spawnSync('anvil', ['--version']).status === 0

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.listen(0, () => {
      const a = s.address()
      const port = typeof a === 'object' && a ? a.port : 0
      s.close(() => resolve(port))
    })
    s.on('error', reject)
  })
}

export async function startAnvil(): Promise<{ url: string; stop: () => void; proc: ChildProcess }> {
  const port = await freePort()
  const proc = spawn('anvil', ['--port', String(port), '--silent'], { stdio: 'ignore' })
  const url = `http://127.0.0.1:${port}`
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      })
      if (r.ok) return { url, proc, stop: () => proc.kill() }
    } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }
  proc.kill()
  throw new Error('anvil did not start')
}

/** Anvil's well-known PUBLIC dev mnemonic (test-only accounts; never hold real funds). */
export const ANVIL_MNEMONIC = 'test test test test test test test test test test test junk'
