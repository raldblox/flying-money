import 'fake-indexeddb/auto'
import { getChain } from '@flying-money/chains'
import { certKey, type Hex } from '@flying-money/core'
import { expect, it } from 'vitest'
import { idbKV } from '../src/idb.js'
import { settlementJournal } from '../src/settlement.js'

const payee = `0x${'11'.repeat(20)}` as Hex
const hash = `0x${'22'.repeat(32)}` as Hex
const key = certKey(getChain('anvil').chain.id, `0x${'33'.repeat(32)}`)
it('persists intent before broadcast, prevents overlapping collection and resumes a saved hash', async () => {
  const db = idbKV(crypto.randomUUID())
  const a = settlementJournal(db)
  const job = await a.prepare({ chain: 'anvil', payee, keys: [key] })
  await expect(a.prepare({ chain: 'anvil', payee, keys: [key] })).rejects.toThrow('already')
  await a.submitted(job.id, hash)
  const reopened = settlementJournal(db)
  expect((await reopened.list())[0]).toMatchObject({ hash, state: 'submitted' })
  await reopened.observe(job.id, { hash, blockHash: hash, blockNumber: '10', head: '10', status: 'success' })
  expect((await reopened.list())[0]?.state).toBe('confirming')
  await reopened.observe(job.id, { hash, blockHash: hash, blockNumber: '10', head: '11', status: 'success' })
  expect((await reopened.list())[0]?.state).toBe('confirmed')
  await reopened.observe(job.id, null)
  expect((await reopened.list())[0]?.state).toBe('needs-attention')
})

it('records replacements and reverts without ever authorizing another send', async () => {
  const journal = settlementJournal(idbKV(crypto.randomUUID()))
  const job = await journal.prepare({ chain: 'anvil', payee, keys: [key] })
  await journal.submitted(job.id, hash)
  const replacement = `0x${'44'.repeat(32)}` as Hex
  await journal.submitted(job.id, replacement)
  await journal.observe(job.id, {
    hash: replacement,
    blockHash: hash,
    blockNumber: '10',
    head: '11',
    status: 'reverted',
  })
  expect((await journal.list())[0]).toMatchObject({ state: 'reverted', hash: replacement, previousHashes: [hash] })
})
