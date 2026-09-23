// Local e2e helper for the Counting House (no real keys involved):
//   tsx scripts/e2e-anvil.ts setup           → starts anvil, deploys, funds anvil account #1, writes .env.development.local (git-ignored)
//   tsx scripts/e2e-anvil.ts sign <id> <cum> → prints a sealed note for <id> signed by the e2e spender key
//   tsx scripts/e2e-anvil.ts issue <payee> <usdc> → issues a certificate (funder: anvil #1) to the e2e spender key
//   tsx scripts/e2e-anvil.ts sign-order <id> <cum> <orderId> → a counter note (memo = keccak256(orderId), §6.8)
// Anvil dev accounts are PUBLIC test accounts; the e2e spender key is generated fresh and kept in a temp file.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { flyingMoneyAbi, mockUsdcAbi } from '@flying-money/abi'
import { anvilAccount, deployLocal } from '@flying-money/agent/anvil'
import { counterRequestId, encodeHeader, type Hex, newRequestId, signNote } from '@flying-money/core'
import { createPublicClient, createWalletClient, http, parseEventLogs, parseUnits } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { anvil as anvilChain } from 'viem/chains'

const PORT = 8545 // the mock connector sends wallet requests to the chain default RPC (anvil: 8545)
const url = `http://127.0.0.1:${PORT}`
const stateFile = join(import.meta.dirname, '..', '.e2e-state.json')
const [cmd, ...args] = process.argv.slice(2)

if (cmd === 'setup') {
  const proc = spawn('anvil', ['--port', String(PORT), '--silent'], { stdio: 'ignore', detached: true })
  proc.unref()
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}',
      })
      if (r.ok) break
    } catch {}
    await new Promise((r) => setTimeout(r, 200))
  }
  const { usdc, flyingMoney, wait } = await deployLocal(url)
  const funder = anvilAccount(1)
  const w = createWalletClient({ account: funder, chain: anvilChain, transport: http(url) })
  await wait(await w.writeContract({ address: usdc, abi: mockUsdcAbi, functionName: 'faucet' }))
  const spenderKey = generatePrivateKey()
  writeFileSync(stateFile, JSON.stringify({ spenderKey, usdc, flyingMoney, anvilPid: proc.pid }))
  writeFileSync(
    join(import.meta.dirname, '..', '.env.development.local'),
    `NEXT_PUBLIC_FM_E2E_ANVIL=${url}\nNEXT_PUBLIC_FM_E2E_USDC=${usdc}\nNEXT_PUBLIC_FM_E2E_CONTRACT=${flyingMoney}\nNEXT_PUBLIC_FM_E2E_ACCOUNT=${funder.address}\n`,
  )
  console.log(
    JSON.stringify({ usdc, flyingMoney, funder: funder.address, spender: privateKeyToAccount(spenderKey).address }),
  )
} else if (cmd === 'sign') {
  if (!existsSync(stateFile)) throw new Error('run setup first')
  const s = JSON.parse(readFileSync(stateFile, 'utf8')) as { spenderKey: Hex; flyingMoney: Hex }
  const [id, cum] = args as [Hex, string]
  const n = await signNote(privateKeyToAccount(s.spenderKey), anvilChain.id, s.flyingMoney, {
    certificateId: id,
    cumulative: BigInt(cum),
    memo: newRequestId(),
  })
  console.log(encodeHeader(n))
} else if (cmd === 'issue') {
  const s = JSON.parse(readFileSync(stateFile, 'utf8')) as { spenderKey: Hex; flyingMoney: Hex; usdc: Hex }
  const [payee, amount] = args as [Hex, string]
  const face = parseUnits(amount, 6)
  const funder = anvilAccount(1)
  const w = createWalletClient({ account: funder, chain: anvilChain, transport: http(url) })
  const p = createPublicClient({ chain: anvilChain, transport: http(url) })
  await p.waitForTransactionReceipt({
    hash: await w.writeContract({
      address: s.usdc,
      abi: mockUsdcAbi,
      functionName: 'approve',
      args: [s.flyingMoney, face],
    }),
  })
  const block = await p.getBlock()
  const hash = await w.writeContract({
    address: s.flyingMoney,
    abi: flyingMoneyAbi,
    functionName: 'issue',
    args: [payee, privateKeyToAccount(s.spenderKey).address, face, block.timestamp + 7n * 86_400n],
  })
  const logs = parseEventLogs({ abi: flyingMoneyAbi, logs: (await p.waitForTransactionReceipt({ hash })).logs })
  const ev = logs.find((l) => l.eventName === 'CertificateIssued') as { args: { id: Hex } } | undefined
  console.log(ev?.args.id)
} else if (cmd === 'sign-order') {
  const s = JSON.parse(readFileSync(stateFile, 'utf8')) as { spenderKey: Hex; flyingMoney: Hex }
  const [id, cum, orderId] = args as [Hex, string, string]
  const n = await signNote(privateKeyToAccount(s.spenderKey), anvilChain.id, s.flyingMoney, {
    certificateId: id,
    cumulative: parseUnits(cum, 6),
    memo: counterRequestId(orderId),
  })
  console.log(encodeHeader(n))
} else {
  console.error(
    'usage: e2e-anvil.ts setup | sign <id> <cumulative> | issue <payee> <usdc> | sign-order <id> <usdc> <orderId>',
  )
  process.exit(2)
}
