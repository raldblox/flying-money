// Generates fresh random TESTNET wallets into .env (git-ignored) and prints ONLY their addresses.
// Never overwrites an existing variable. Usage: tsx scripts/gen-test-wallets.ts
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const envPath = join(import.meta.dirname, '..', '.env')
const current = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
const has = (name: string) => new RegExp(`^${name}=.+`, 'm').test(current)
const lines: string[] = []
const addr = (k: string) => privateKeyToAccount(k as `0x${string}`).address

const wallets: Array<{ name: string; role: string }> = [
  { name: 'DEMO_FUNDER_KEY', role: 'funder: needs testnet USDC + a little ETH (approve + issue)' },
  { name: 'REDEEMER_KEY', role: 'payee + redeemer: needs a little ETH (redeem gas); receives the USDC payments' },
  { name: 'DEMO_AGENT_KEY', role: 'agent (spender): needs NOTHING, it only signs notes' },
]
const out: Array<[string, string, string]> = []
for (const w of wallets) {
  if (has(w.name)) {
    const m = current.match(new RegExp(`^${w.name}=(.+)$`, 'm'))![1]!.trim()
    out.push([w.name, addr(m.startsWith('0x') ? m : `0x${m}`), `${w.role} (already in .env)`])
    continue
  }
  const k = generatePrivateKey()
  lines.push(`${w.name}=${k}`)
  out.push([w.name, addr(k), w.role])
}
const redeemer = out.find(([n]) => n === 'REDEEMER_KEY')![1]
if (!has('PAYEE_ADDRESS')) lines.push(`PAYEE_ADDRESS=${redeemer}`)
if (lines.length) {
  const sep = current && !current.endsWith('\n') ? '\n' : ''
  appendFileSync(envPath, `${sep}# testnet demo wallets (generated ${new Date().toISOString()}); never use on mainnet\n${lines.join('\n')}\n`)
}
for (const [name, a, role] of out) console.log(`${name.padEnd(16)} ${a}  ${role}`)
console.log(`PAYEE_ADDRESS    ${has('PAYEE_ADDRESS') ? '(already set)' : redeemer}`)
