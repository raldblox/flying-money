// Deploy FlyingMoney to one or more registry chains (BUILD_SPEC §7.5). Cross-platform (node + forge).
//   pnpm deploy:chain <key> [--verify] [--confirm-mainnet]
//   pnpm deploy:all  [--verify]            (all TESTNETS; mainnets are deployed one at a time with --confirm-mainnet)
//   pnpm verify:chain <key>                (re-verify the recorded deployment; no transactions)
// Secrets come only from env (.env is loaded if present): DEPLOYER_KEY, optional EXPLORER_API_KEYS. Never printed.
// Order: deploy → record in packages/chains/src/deployments.json → verify (a verification failure never loses the record).
// Verifiers tried in order (DECISIONS D16): Etherscan-family if EXPLORER_API_KEYS is set, Blockscout (keyless, from the
// registry), then Sourcify (keyless).
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseRegistry, type ChainKey, chainKeys, isChainKey, rpcUrl } from '@flying-money/chains'
import { encodeAbiParameters } from 'viem'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const contracts = join(root, 'contracts')
const deploymentsFile = join(root, 'packages', 'chains', 'src', 'deployments.json')
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'))

const args = process.argv.slice(2)
const verify = args.includes('--verify') || args.includes('--verify-only')
const verifyOnly = args.includes('--verify-only')
const confirmMainnet = args.includes('--confirm-mainnet')
const keys: ChainKey[] = args.includes('--all')
  ? chainKeys.filter((k) => !baseRegistry[k].mainnet && k !== 'anvil')
  : args
      .filter((a) => !a.startsWith('--'))
      .map((k) => {
        if (!isChainKey(k)) throw new Error(`Unknown chain key "${k}"`)
        return k
      })
if (keys.length === 0) {
  console.error(
    'usage: pnpm deploy:chain <key> [--verify] [--confirm-mainnet] | pnpm deploy:all [--verify] | pnpm verify:chain <key>',
  )
  process.exit(2)
}

const forge = (forgeArgs: string[], env: NodeJS.ProcessEnv = process.env) =>
  spawnSync('forge', forgeArgs, { cwd: contracts, env, stdio: 'inherit' }).status ?? 1

function readDeployments(): Record<string, { flyingMoney: string; deployedBlock: string }> {
  return JSON.parse(readFileSync(deploymentsFile, 'utf8'))
}

function deploy(key: ChainKey): string {
  const c = baseRegistry[key]
  if (c.mainnet && !confirmMainnet) {
    console.error(`${key} is a MAINNET. Refusing without --confirm-mainnet (explicit human approval, §0.1).`)
    process.exit(2)
  }
  const rawKey = process.env.DEPLOYER_KEY?.trim()
  if (!rawKey) {
    console.error('DEPLOYER_KEY is not set (human input H1). Put it in .env; never commit it.')
    process.exit(2)
  }
  const deployerKey = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}` // MetaMask exports keys without 0x
  if (!/^0x[0-9a-fA-F]{64}$/.test(deployerKey)) throw new Error('DEPLOYER_KEY is not a 32-byte hex private key')
  const env: NodeJS.ProcessEnv = { ...process.env, CHAIN_KEY: key, DEPLOYER_KEY: deployerKey }
  if (c.mainnet) env.FM_CONFIRM_MAINNET = key
  mkdirSync(join(contracts, 'deployments'), { recursive: true })

  console.log(`\n=== deploying to ${key} (chainId ${c.chain.id})${c.mainnet ? ' [MAINNET, capped]' : ''} ===`)
  const status = forge(
    ['script', 'script/Deploy.s.sol:Deploy', '--rpc-url', rpcUrl(key, process.env), '--broadcast'],
    env,
  )
  if (status !== 0) {
    console.error(`forge script failed for ${key} (exit ${status}). Nothing recorded.`)
    process.exit(status)
  }
  const run = JSON.parse(
    readFileSync(join(contracts, 'broadcast', 'Deploy.s.sol', String(c.chain.id), 'run-latest.json'), 'utf8'),
  ) as {
    transactions: Array<{ hash: string; contractName?: string; contractAddress?: string; transactionType: string }>
    receipts: Array<{ transactionHash: string; blockNumber: string; status: string }>
  }
  const tx = run.transactions.find((t) => t.contractName === 'FlyingMoney' && t.transactionType === 'CREATE')
  const receipt = run.receipts.find((rc) => rc.transactionHash === tx?.hash)
  if (!tx?.contractAddress || !receipt || receipt.status !== '0x1')
    throw new Error('FlyingMoney CREATE receipt not found')
  const record = { flyingMoney: tx.contractAddress, deployedBlock: BigInt(receipt.blockNumber).toString() }
  if (key === 'anvil') {
    console.log(`anvil deployment (not committed): ${JSON.stringify(record)}`)
    return record.flyingMoney
  }
  const current = readDeployments()
  current[key] = record
  const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(deploymentsFile, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(`recorded ${key}: ${JSON.stringify(record)} → packages/chains/src/deployments.json`)
  return record.flyingMoney
}

function verifyDeployment(key: ChainKey, address: string): boolean {
  const c = baseRegistry[key]
  const ctorArgs = encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint128' }, { type: 'uint128' }],
    [c.usdc, c.maxFaceValue, c.maxTotalOutstanding],
  )
  const base = [
    'verify-contract',
    address,
    'src/FlyingMoney.sol:FlyingMoney',
    '--chain-id',
    String(c.chain.id),
    '--constructor-args',
    ctorArgs,
    '--watch',
  ]
  const attempts: Array<{ name: string; args: string[]; env?: NodeJS.ProcessEnv }> = []
  if (process.env.EXPLORER_API_KEYS)
    attempts.push({
      name: 'etherscan',
      args: base,
      env: { ...process.env, ETHERSCAN_API_KEY: process.env.EXPLORER_API_KEYS },
    })
  if (c.blockscoutApi)
    attempts.push({
      name: 'blockscout',
      args: [...base, '--verifier', 'blockscout', '--verifier-url', c.blockscoutApi],
    })
  attempts.push({ name: 'sourcify', args: [...base, '--verifier', 'sourcify'] })
  let any = false
  for (const a of attempts) {
    console.log(`\n--- verifying ${address} on ${key} via ${a.name}`)
    if (forge(a.args, a.env) === 0) {
      console.log(`verified via ${a.name}`)
      any = true
      if (a.name !== 'sourcify') break // one public explorer verification is enough; keep going only on failure
    } else console.warn(`verification via ${a.name} failed`)
  }
  return any
}

for (const key of keys) {
  const address = verifyOnly ? readDeployments()[key]?.flyingMoney : deploy(key)
  if (!address) throw new Error(`no recorded deployment for ${key}`)
  if (verify && key !== 'anvil' && !verifyDeployment(key, address)) {
    console.error(`WARNING: ${key} deployment recorded but NOT verified. Retry with: pnpm verify:chain ${key}`)
    process.exitCode = 1
  }
}
