// Prints the PUBLIC address and gas balance for a key in .env (never the key). Usage: tsx scripts/whoami.ts DEPLOYER_KEY arbitrum-sepolia
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { type ChainKey, getChain, rpcUrl } from '@flying-money/chains'
import { createPublicClient, formatEther, type Hex, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const root = join(import.meta.dirname, '..')
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'))
const [varName = 'DEPLOYER_KEY', chainKey = 'arbitrum-sepolia'] = process.argv.slice(2)
const raw = process.env[varName]?.trim()
if (!raw) throw new Error(`${varName} is not set`)
const key = (raw.startsWith('0x') ? raw : `0x${raw}`) as Hex
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error(`${varName} is not a 32-byte hex private key`)
const address = privateKeyToAccount(key).address
const c = getChain(chainKey as ChainKey)
const pub = createPublicClient({ transport: http(rpcUrl(c.key, process.env)) })
const bal = await pub.getBalance({ address })
console.log(`${varName} → ${address}`)
console.log(`${c.key}: ${formatEther(bal)} ${c.gasToken} (chainId ${await pub.getChainId()})`)
