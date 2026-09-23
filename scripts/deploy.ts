// Deploy FlyingMoney to one or more registry chains (BUILD_SPEC §7.5). Cross-platform (node + forge).
//   pnpm deploy:chain <key> [--verify] [--confirm-mainnet]
//   pnpm deploy:all  [--verify]          (all TESTNETS; mainnets are deployed one at a time with --confirm-mainnet)
// Secrets come only from env (.env is loaded if present): DEPLOYER_KEY, EXPLORER_API_KEYS. They are never printed.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseRegistry, type ChainKey, chainKeys, isChainKey, rpcUrl } from '@flying-money/chains'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const contracts = join(root, 'contracts')
const deploymentsFile = join(root, 'packages', 'chains', 'src', 'deployments.json')
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'))

const args = process.argv.slice(2)
const verify = args.includes('--verify')
const confirmMainnet = args.includes('--confirm-mainnet')
const all = args.includes('--all')
const keys: ChainKey[] = all
  ? chainKeys.filter((k) => !baseRegistry[k].mainnet && k !== 'anvil')
  : args
      .filter((a) => !a.startsWith('--'))
      .map((k) => {
        if (!isChainKey(k)) throw new Error(`Unknown chain key "${k}"`)
        return k
      })
if (keys.length === 0) {
  console.error('usage: pnpm deploy:chain <key> [--verify] [--confirm-mainnet] | pnpm deploy:all [--verify]')
  process.exit(2)
}
if (!process.env.DEPLOYER_KEY) {
  console.error('DEPLOYER_KEY is not set (human input H1). Put it in .env; never commit it.')
  process.exit(2)
}

for (const key of keys) {
  const c = baseRegistry[key]
  if (c.mainnet && !confirmMainnet) {
    console.error(`${key} is a MAINNET. Refusing without --confirm-mainnet (explicit human approval, §0.1).`)
    process.exit(2)
  }
  mkdirSync(join(contracts, 'deployments'), { recursive: true })
  const forgeArgs = ['script', 'script/Deploy.s.sol:Deploy', '--rpc-url', rpcUrl(key, process.env), '--broadcast']
  const env: NodeJS.ProcessEnv = { ...process.env, CHAIN_KEY: key }
  if (c.mainnet) env.FM_CONFIRM_MAINNET = key
  if (verify && key !== 'anvil') {
    if (!process.env.EXPLORER_API_KEYS) throw new Error('EXPLORER_API_KEYS not set (human input H4)')
    forgeArgs.push('--verify')
    env.ETHERSCAN_API_KEY = process.env.EXPLORER_API_KEYS
  }
  console.log(`\n=== deploying to ${key} (chainId ${c.chain.id})${c.mainnet ? ' [MAINNET, capped]' : ''} ===`)
  const r = spawnSync('forge', forgeArgs, { cwd: contracts, env, stdio: 'inherit' })
  if (r.status !== 0) {
    console.error(`forge script failed for ${key} (exit ${r.status}). Nothing recorded.`)
    process.exit(r.status ?? 1)
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
    console.log(`anvil deployment (not committed): ${JSON.stringify(record)} — see contracts/deployments/anvil.json`)
    continue
  }
  const current = JSON.parse(readFileSync(deploymentsFile, 'utf8')) as Record<string, unknown>
  current[key] = record
  const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(deploymentsFile, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(`recorded ${key}: ${JSON.stringify(record)} → packages/chains/src/deployments.json`)
}
