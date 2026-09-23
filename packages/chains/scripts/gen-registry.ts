// Generates registry/<key>.json for contracts/script/Deploy.s.sol (Solidity cannot import TS).
// The TS registry remains the single source of truth; CI checks these files are up to date.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseRegistry, chainKeys } from '../src/registry.js'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'registry')
mkdirSync(out, { recursive: true })
for (const k of chainKeys) {
  const c = baseRegistry[k]
  const json = {
    key: k,
    chainId: c.chain.id,
    mainnet: c.mainnet,
    usdc: c.usdc,
    usdcDecimals: 6,
    maxFaceValue: Number(c.maxFaceValue),
    maxTotalOutstanding: Number(c.maxTotalOutstanding),
  }
  writeFileSync(join(out, `${k}.json`), `${JSON.stringify(json, null, 2)}\n`)
}
console.log(`wrote ${chainKeys.length} registry files to ${out}`)
