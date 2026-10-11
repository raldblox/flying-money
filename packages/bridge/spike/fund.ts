// Plays the owner: funds a bridge's float and/or issues a budget on Base Sepolia from DEMO_FUNDER_KEY (test money).
//   tsx spike/fund.ts float <bridgeAddress> <usdc>
//   tsx spike/fund.ts budget <payee> <spenderAddress> <usdc> <days>
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { flyingMoneyAbi } from '@flying-money/abi'
import { getChain } from '@flying-money/chains'
import { createPublicClient, createWalletClient, erc20Abi, type Hex, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

function envKey(name: string): Hex {
  if (process.env[name]) return process.env[name] as Hex
  const f = path.resolve('../../.env')
  const m = existsSync(f) ? readFileSync(f, 'utf8').match(new RegExp(`^s*${name}s*=s*"?([^"\r\n]+)"?`, 'm')) : null
  if (!m) throw new Error(`${name} missing`)
  return (m[1] as string).trim() as Hex
}
const chain = getChain('base-sepolia')
const pub = createPublicClient({ chain: chain.chain, transport: http() })
const owner = privateKeyToAccount(envKey('DEMO_FUNDER_KEY'))
const wallet = createWalletClient({ account: owner, chain: chain.chain, transport: http() })
const [mode, a, b, c, d] = process.argv.slice(2)
const wait = (h: Hex) => pub.waitForTransactionReceipt({ hash: h })
if (mode === 'float' && a && b) {
  const h = await wallet.writeContract({
    address: chain.usdc,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [a as Hex, parseUnits(b, 6)],
  })
  await wait(h)
  console.log('float funded', h)
} else if (mode === 'budget' && a && b && c && d) {
  const face = parseUnits(c, 6)
  await wait(
    await wallet.writeContract({
      address: chain.usdc,
      abi: erc20Abi,
      functionName: 'approve',
      args: [chain.flyingMoney as Hex, face],
    }),
  )
  await new Promise((r) => setTimeout(r, 3000))
  const { timestamp } = await pub.getBlock()
  const { result, request } = await pub.simulateContract({
    account: owner,
    address: chain.flyingMoney as Hex,
    abi: flyingMoneyAbi,
    functionName: 'issue',
    args: [a as Hex, b as Hex, face, timestamp + BigInt(Number(d)) * 86_400n],
  })
  const h = await wallet.writeContract(request)
  await wait(h)
  console.log('budget issued', result, h)
} else console.log('usage: fund.ts float <addr> <usdc> | budget <payee> <spender> <usdc> <days>')
process.exit(0)
