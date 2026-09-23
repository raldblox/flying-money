#!/usr/bin/env node
// npx @flying-money/client keygen [--out .env]
// Creates an agent (spender) key locally, appends AGENT_KEY=… to the env file, and prints ONLY the address.
import { appendFileSync, chmodSync, existsSync, readFileSync } from 'node:fs'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const [cmd, ...rest] = process.argv.slice(2)
if (cmd !== 'keygen') {
  console.error('usage: flying-money keygen [--out .env] [--var AGENT_KEY]')
  process.exit(2)
}
const flag = (name: string, dflt: string) => {
  const i = rest.indexOf(name)
  return i >= 0 && rest[i + 1] ? rest[i + 1]! : dflt
}
const out = flag('--out', '.env')
const varName = flag('--var', 'AGENT_KEY')
if (existsSync(out) && new RegExp(`^${varName}=`, 'm').test(readFileSync(out, 'utf8'))) {
  console.error(`${out} already contains ${varName}; refusing to overwrite an existing key.`)
  process.exit(1)
}
const key = generatePrivateKey()
const address = privateKeyToAccount(key).address
const prefix = existsSync(out) && !readFileSync(out, 'utf8').endsWith('\n') ? '\n' : ''
appendFileSync(out, `${prefix}${varName}=${key}\n`, { mode: 0o600 })
try {
  chmodSync(out, 0o600)
} catch {}
console.log(address)
console.error(`Saved ${varName} to ${out} (keep it secret; it only signs notes and holds no funds).`)
