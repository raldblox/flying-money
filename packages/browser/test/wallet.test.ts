import { prepareCounterPayment } from '@flying-money/client/counter'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { openWalletRepository, toCounterCert } from '../src/wallet.js'
import 'fake-indexeddb/auto'
import { getChain, setLocalDeployment } from '@flying-money/chains'
import { certKey, type Hex } from '@flying-money/core'
import { expect, it, vi } from 'vitest'
import { idbKV } from '../src/idb.js'
import { createWalletRepository } from '../src/wallet.js'

it('confirms a pending payment and its history together, exactly once across concurrent receipts', async () => {
  const db = idbKV(crypto.randomUUID())
  const repo = createWalletRepository({ db, readCertificate: async () => null })
  const id = `0x${'11'.repeat(32)}` as Hex
  const memo = `0x${'22'.repeat(32)}` as Hex
  const chain = getChain('anvil')
  const certificate = { chainId: chain.chain.id, id }
  await repo.walletStore().save(certificate, {
    accepted: 0n,
    consumed: 0n,
    pending: { orderId: 'order', requestId: memo, noteQr: 'saved payload', cumulative: 5n, price: 5n, createdAt: 1 },
  })
  const payment = {
    id: memo,
    certificateId: id,
    chain: 'anvil' as const,
    at: 1,
    price: '5',
    status: 'CONFIRMED' as const,
  }
  await Promise.all([repo.confirmPayment(certificate, payment), repo.confirmPayment(certificate, payment)])
  expect(await repo.walletStore().load(certificate)).toEqual({ accepted: 5n, consumed: 5n })
  expect(JSON.parse((await db.get('history'))!)).toHaveLength(1)
  expect(await db.get(`state:${certKey(chain.chain.id, id)}`)).toBeDefined()
})

it('rejects a malformed restore without touching existing storage', async () => {
  const db = idbKV(crypto.randomUUID())
  const repo = createWalletRepository({ db, readCertificate: async () => null })
  await db.set('pin-check', 'original')
  await expect(
    repo.importBackup(
      JSON.stringify({ kind: 'flying-money-wallet-backup', v: 1, data: { 'pin-check': '{}', 'cert:bad': '{}' } }),
    ),
  ).rejects.toThrow()
  expect(await db.get('pin-check')).toBe('original')
  expect(await db.keys('cert:')).toEqual([])
})

it('restores the legacy v1 schema and encrypted v2 backups with the exact pending signed payload', async () => {
  setLocalDeployment({ usdc: `0x${'aa'.repeat(20)}`, flyingMoney: `0x${'bb'.repeat(20)}` })
  const network = getChain('anvil')
  const key = generatePrivateKey()
  const spender = privateKeyToAccount(key)
  const id = `0x${'77'.repeat(32)}` as Hex
  const payee = `0x${'88'.repeat(20)}` as Hex
  const db = idbKV(crypto.randomUUID())
  const repo = createWalletRepository({
    db,
    readCertificate: async () => ({
      id,
      funder: payee,
      payee,
      spender: spender.address,
      faceValue: 100n,
      redeemed: 0n,
      expiresAt: 2_000_000_000n,
      closed: false,
    }),
  })
  await repo.setPin('123456')
  const entry = await repo.addCertificate({ chain: 'anvil', id, key, pin: '123456' })
  const certificate = toCounterCert(entry)
  const payment = await prepareCounterPayment({
    store: repo.walletStore(),
    spender,
    certificate,
    offer: {
      scheme: 'flying-money',
      v: 1,
      price: 5n,
      minRemainingLifetime: 0,
      memoHint: 'legacy-order',
      accepts: [{ chainId: network.chain.id, contract: entry.contract, token: network.usdc, payee }],
    },
    now: () => 1_800_000_000,
  })
  const data = await db.atomic((records) => Object.fromEntries(records))
  const legacy = JSON.stringify({ kind: 'flying-money-wallet-backup', v: 1, data })
  const encrypted = await repo.exportBackup('a long backup passphrase')
  for (const text of [legacy, encrypted]) {
    const restored = createWalletRepository({ db: idbKV(crypto.randomUUID()), readCertificate: async () => null })
    await restored.importBackup(text, 'a long backup passphrase')
    await restored.initialize()
    expect(await restored.checkPin('123456')).toBe(true)
    expect((await restored.walletStore().load(certificate))?.pending?.noteQr).toBe(payment.noteQr)
    expect((await restored.listEntries())[0]?.vault).toEqual(entry.vault)
  }
}, 30_000)

it('keeps ownership until an in-flight wallet mutation drains and refuses late writes', async () => {
  let unlocked = false
  vi.stubGlobal('navigator', {
    locks: {
      request: async (_name: string, _options: unknown, callback: (lock: object) => Promise<void>) => {
        await callback({})
        unlocked = true
      },
    },
  })
  let finish!: () => void
  const gate = new Promise<void>((resolve) => {
    finish = resolve
  })
  const db = idbKV(crypto.randomUUID())
  const original = db.set
  db.set = async (...args) => {
    await gate
    return original(...args)
  }
  try {
    const repository = await openWalletRepository({ db, readCertificate: async () => null }, crypto.randomUUID())
    const write = repository.kv().set('pending', 'signed')
    const close = repository.release()
    await Promise.resolve()
    expect(unlocked).toBe(false)
    await expect(repository.kv().set('pending', 'different')).rejects.toThrow('closed')
    finish()
    await write
    await close
    expect(await db.get('pending')).toBe('signed')
  } finally {
    finish()
    vi.unstubAllGlobals()
  }
})
