// Read-only check (§0.1 stop-and-ask, §5.4): each public chain's eth_chainId and USDC decimals()/symbol()
// must match the registry. Exit code 1 on any mismatch. Usage: pnpm --filter @flying-money/chains check [key...]
import { createPublicClient, erc20Abi, http } from 'viem'
import { baseRegistry, type ChainKey, chainKeys, rpcUrl } from '../src/registry.js'

const keys = (
  process.argv.slice(2).length ? process.argv.slice(2) : chainKeys.filter((k) => k !== 'anvil')
) as ChainKey[]
let bad = 0
for (const key of keys) {
  const c = baseRegistry[key]
  const url = rpcUrl(key, process.env)
  const client = createPublicClient({ transport: http(url, { timeout: 15_000, retryCount: 1 }) })
  try {
    const id = await client.getChainId()
    const [decimals, symbol] = await Promise.all([
      client.readContract({ address: c.usdc, abi: erc20Abi, functionName: 'decimals' }),
      client.readContract({ address: c.usdc, abi: erc20Abi, functionName: 'symbol' }),
    ])
    const ok = id === c.chain.id && decimals === 6
    if (!ok) bad++
    console.log(
      `${ok ? 'OK      ' : 'MISMATCH'} ${key.padEnd(17)} chainId=${id} (want ${c.chain.id}) USDC ${symbol} decimals=${decimals} rpc=${url}`,
    )
  } catch (e) {
    bad++
    console.log(`UNREACHABLE ${key.padEnd(14)} rpc=${url}: ${(e as Error).message.split('\n')[0]}`)
  }
}
process.exit(bad ? 1 : 0)
