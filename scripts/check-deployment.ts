// Read-only check of a recorded deployment against the registry and the TS SDK (no transactions).
//   tsx scripts/check-deployment.ts <chainKey> [ADDRESS_ENV_VAR_TO_SHOW_USDC_BALANCE]
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { flyingMoneyAbi } from '@flying-money/abi'
import { type ChainKey, getChain, rpcUrl } from '@flying-money/chains'
import { domain, hashNote, newRequestId } from '@flying-money/core'
import { createPublicClient, erc20Abi, formatUnits, getAddress, type Hex, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const root = join(import.meta.dirname, '..')
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'))
const [key = 'arbitrum-sepolia', keyVar] = process.argv.slice(2)
const c = getChain(key as ChainKey)
if (!c.flyingMoney) throw new Error(`no deployment recorded for ${key}`)
const pub = createPublicClient({ transport: http(rpcUrl(c.key, process.env)) })
const fm = c.flyingMoney
const read = <T>(functionName: string, args: unknown[] = []) =>
  pub.readContract({
    address: fm,
    abi: flyingMoneyAbi,
    functionName: functionName as never,
    args: args as never,
  }) as Promise<T>

const [, name, version, chainId, vc] = await read<[Hex, string, string, bigint, Hex]>('eip712Domain')
const token = await read<Hex>('token')
const caps = [await read<bigint>('maxFaceValue'), await read<bigint>('maxTotalOutstanding')]
const outstanding = await read<bigint>('totalOutstanding')
const note = { certificateId: newRequestId(), cumulative: 123_456n, memo: newRequestId() }
const onchain = await read<Hex>('noteDigest', [note.certificateId, note.cumulative, note.memo])
const checks: Array<[string, boolean]> = [
  [
    'EIP-712 domain = SDK domain()',
    JSON.stringify({ name, version, chainId: Number(chainId), verifyingContract: getAddress(vc) }) ===
      JSON.stringify(domain(c.chain.id, getAddress(fm))),
  ],
  ['token = registry USDC', token.toLowerCase() === c.usdc.toLowerCase()],
  ['caps = registry caps', caps[0] === c.maxFaceValue && caps[1] === c.maxTotalOutstanding],
  ['noteDigest = SDK hashNote', onchain === hashNote(c.chain.id, fm, note)],
]
for (const [label, ok] of checks) console.log(`${ok ? 'OK ' : 'BAD'} ${label}`)
console.log(
  `contract ${fm} on ${key} · totalOutstanding ${formatUnits(outstanding, 6)} USDC · ${c.explorer}/address/${fm}`,
)
if (keyVar && process.env[keyVar]) {
  const raw = process.env[keyVar]!.trim()
  const addr = privateKeyToAccount((raw.startsWith('0x') ? raw : `0x${raw}`) as Hex).address
  const bal = await pub.readContract({ address: c.usdc, abi: erc20Abi, functionName: 'balanceOf', args: [addr] })
  console.log(`${keyVar} ${addr}: ${formatUnits(bal, 6)} USDC`)
}
process.exit(checks.every(([, ok]) => ok) ? 0 : 1)
