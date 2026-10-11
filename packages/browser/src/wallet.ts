import { type ChainKey, getChain, getChainById } from '@flying-money/chains'
import {
  type CounterCertificate,
  type CounterState,
  type CounterWalletStore,
  confirmCounterPayment,
  deserializeCounterState,
  serializeCounterState,
} from '@flying-money/client/counter'
import type { Certificate } from '@flying-money/core'
import { certKey, decodeNote, type Hex } from '@flying-money/core'
import { privateKeyToAccount } from 'viem/accounts'
import type { AtomicKV } from './idb.js'
import { idbKV } from './idb.js'
import { operationScope } from './lifecycle.js'
import { holdLock } from './locks.js'
import { type Sealed, seal, sealKey, unseal } from './pin-vault.js'
import { openBackup, sealBackup } from './wallet-backup.js'
import type { WalletPayment } from './wallet-history.js'

/**
 * Customer wallet (§12.5): spender keys generated or received on this device, sealed with the PIN, in IndexedDB.
 * Keys never leave the device except through the explicit backup export or a hand-over link the user creates.
 */
export interface WalletEntry {
  chain: ChainKey
  chainId: number
  contract: Hex
  id: Hex
  payee: Hex
  faceValue: string
  expiresAt: string
  spender: Hex
  vault: Sealed
  label: string
  addedAt: number
}

import { type HandOver, unb64url } from './handover.js'
export const toCounterCert = (e: WalletEntry): CounterCertificate => ({
  chainId: e.chainId,
  contract: e.contract,
  id: e.id,
  payee: e.payee,
  faceValue: BigInt(e.faceValue),
  expiresAt: BigInt(e.expiresAt),
})

// ── Hand-over links (§12.5 funder flow): the key travels only in the URL fragment ────────────────
export { type HandOver, handOverFragment } from './handover.js'

export function parseHandOver(fragment: string): HandOver | null {
  const m = /(?:^|[#&])add=([A-Za-z0-9_-]+)/.exec(fragment)
  if (!m) return null
  try {
    const h = JSON.parse(unb64url(m[1]!)) as HandOver
    if (h.v !== 1 || !/^0x[0-9a-fA-F]{64}$/.test(h.id) || !/^0x[0-9a-fA-F]{64}$/.test(h.key)) return null
    getChain(h.chain) // throws on an unknown chain
    return h
  } catch {
    return null
  }
}

export const chainLabel = (chainId: number) => getChainById(chainId)?.chain.name ?? `chain ${chainId}`

export class AddError extends Error {}
export function createWalletRepository(options: {
  db?: AtomicKV
  readCertificate(chain: ChainKey, id: Hex): Promise<Certificate | null>
}) {
  const db = options.db ?? idbKV('fm-wallet')
  const kv = () => db
  const loadCertificate = options.readCertificate
  function walletStore(): CounterWalletStore {
    const db = kv()
    return {
      async load(c) {
        const s = await db.get(`state:${certKey(c.chainId, c.id)}`)
        return s ? deserializeCounterState(JSON.parse(s)) : null
      },
      async save(c, s) {
        await db.set(`state:${certKey(c.chainId, c.id)}`, JSON.stringify(serializeCounterState(s)))
      },
    }
  }

  async function listEntries(): Promise<Array<WalletEntry & { state: CounterState | null }>> {
    const db = kv()
    const store = walletStore()
    const out: Array<WalletEntry & { state: CounterState | null }> = []
    for (const k of await db.keys('cert:')) {
      const raw = await db.get(k)
      if (!raw) continue
      const e = JSON.parse(raw) as WalletEntry
      out.push({ ...e, state: await store.load(toCounterCert(e)) })
    }
    return out.sort((a, b) => b.addedAt - a.addedAt)
  }

  // ── PIN ──────────────────────────────────────────────────────────────────────
  async function hasPin() {
    return Boolean(await kv().get('pin-check'))
  }
  async function setPin(pin: string) {
    await kv().set('pin-check', JSON.stringify(await seal(pin, 'flying-money')))
  }
  async function checkPin(pin: string): Promise<boolean> {
    const raw = await kv().get('pin-check')
    if (!raw) return false
    try {
      return (await unseal(pin, JSON.parse(raw) as Sealed)) === 'flying-money'
    } catch {
      return false
    }
  }

  // ── Adding certificates ─────────────────────────────────────────────────────

  /**
   * Adds a certificate whose spender key is `key`. Reads it on-chain (needs a connection) and checks that the key
   * really is its spender, so the wallet never shows a balance it cannot spend.
   */
  async function addCertificate(opts: { chain: ChainKey; id: Hex; key: Hex; pin: string; label?: string }) {
    const ch = getChain(opts.chain)
    if (!ch.flyingMoney) throw new AddError('Flying Money is not deployed on this network yet.')
    let cert: Awaited<ReturnType<typeof loadCertificate>>
    try {
      cert = await loadCertificate(opts.chain, opts.id)
    } catch {
      throw new AddError('You need a connection to add a budget (it is checked on the blockchain once).')
    }
    if (!cert) throw new AddError('No budget with this id on this network.')
    const spender = privateKeyToAccount(opts.key).address
    if (spender.toLowerCase() !== cert.spender.toLowerCase())
      throw new AddError('This key is not the spending key of that budget.')
    const entry: WalletEntry = {
      chain: opts.chain,
      chainId: ch.chain.id,
      contract: ch.flyingMoney,
      id: cert.id,
      payee: cert.payee,
      faceValue: cert.faceValue.toString(),
      expiresAt: cert.expiresAt.toString(),
      spender,
      vault: await sealKey(opts.pin, opts.key),
      label: opts.label?.trim() || 'Budget',
      addedAt: Date.now(),
    }
    await kv().set(`cert:${certKey(entry.chainId, entry.id)}`, JSON.stringify(entry))
    return entry
  }

  /** A fresh spender key for a certificate the customer will fund in the Counting House (§12.5). */
  async function newDraftKey(pin: string) {
    const { generatePrivateKey } = await import('viem/accounts')
    const key = generatePrivateKey()
    const address = privateKeyToAccount(key).address
    await kv().set(`draft:${address.toLowerCase()}`, JSON.stringify(await sealKey(pin, key)))
    return address
  }
  async function listDrafts(): Promise<Hex[]> {
    return (await kv().keys('draft:')).map((k) => k.slice(6) as Hex)
  }
  async function draftKey(address: Hex, pin: string): Promise<Hex | null> {
    const raw = await kv().get(`draft:${address.toLowerCase()}`)
    if (!raw) return null
    return (await unseal(pin, JSON.parse(raw) as Sealed)) as Hex
  }
  async function dropDraft(address: Hex) {
    await kv().del(`draft:${address.toLowerCase()}`)
  }

  // ── Backup (§12.5: storage can be wiped) ─────────────────────────────────────
  /** Everything in the wallet (keys still sealed with the PIN), sealed again with a backup passphrase (audit F10). */
  async function exportBackup(passphrase: string): Promise<string> {
    const db = kv()
    const dump = await db.atomic((records) =>
      Object.fromEntries(
        [...records].filter(([key]) => /^(cert:|state:|draft:)/.test(key) || key === 'pin-check' || key === 'history'),
      ),
    )
    return sealBackup(dump, passphrase)
  }

  async function importBackup(text: string, passphrase?: string) {
    let data: Record<string, string>
    try {
      data = await openBackup(text, passphrase)
    } catch (e) {
      throw new AddError((e as Error).message)
    }
    validateWalletDump(data)
    await db.atomic((records) => {
      if ([...records.keys()].some((key) => /^(cert:|draft:|state:)/.test(key)))
        throw new AddError('Restore a backup into an empty wallet (on a new phone, or after the old data was wiped).')
      for (const [key, value] of Object.entries(data)) records.set(key, value)
      records.set('schema', '1')
    })
  }

  /** Uses the client engine's transition, then commits balance and history in one transaction. */
  async function confirmPayment(c: Pick<CounterCertificate, 'chainId' | 'id'>, payment: WalletPayment) {
    const key = `state:${certKey(c.chainId, c.id)}`
    const raw = await db.get(key)
    const state = raw ? deserializeCounterState(JSON.parse(raw)) : null
    if (!state?.pending) return
    if (
      state.pending.requestId.toLowerCase() !== payment.id.toLowerCase() ||
      state.pending.price !== BigInt(payment.price) ||
      payment.certificateId.toLowerCase() !== c.id.toLowerCase() ||
      getChain(payment.chain).chain.id !== c.chainId
    )
      throw new Error('The receipt does not match this pending payment.')
    let next = state
    await confirmCounterPayment(
      {
        load: async () => state,
        save: async (_c, value) => {
          next = value
        },
      },
      c as CounterCertificate,
    )
    await db.atomic((records) => {
      const history = JSON.parse(records.get('history') ?? '[]') as WalletPayment[]
      if (history.some((p) => p.chain === payment.chain && p.id.toLowerCase() === payment.id.toLowerCase())) return
      if (records.get(key) !== raw) throw new Error('The pending payment changed. Reopen it before confirming.')
      records.set(key, JSON.stringify(serializeCounterState(next)))
      records.set('history', JSON.stringify([payment, ...history].slice(0, 500)))
    })
  }
  async function initialize() {
    await db.atomic((records) => {
      const version = records.get('schema')
      if (version && version !== '1') throw new Error('This wallet was saved by a newer app. Update before opening it.')
      records.set('schema', '1')
    })
  }
  return {
    initialize,
    confirmPayment,
    kv,
    walletStore,
    listEntries,
    hasPin,
    setPin,
    checkPin,
    addCertificate,
    newDraftKey,
    listDrafts,
    draftKey,
    dropDraft,
    exportBackup,
    importBackup,
  }
}

function validSealed(value: unknown): boolean {
  const s = value as Sealed | undefined
  try {
    return s?.v === 1 && atob(s.salt).length === 16 && atob(s.iv).length === 12 && atob(s.ct).length >= 16
  } catch {
    return false
  }
}

/** Validate all records before the restore transaction can change anything. Legacy v1/v2 containers share this schema. */
function validateWalletDump(data: Record<string, string>) {
  const hex = (value: unknown, bytes: number) =>
    typeof value === 'string' && new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`).test(value)
  if (!data || typeof data !== 'object' || Array.isArray(data) || !data['pin-check'])
    throw new AddError('The backup has no valid wallet PIN record.')
  for (const [key, raw] of Object.entries(data)) {
    if (typeof raw !== 'string' || raw.length > 5_000_000) throw new AddError('Invalid wallet backup record.')
    const value = JSON.parse(raw)
    if (key === 'pin-check' || key.startsWith('draft:')) {
      if (!validSealed(value) || (key.startsWith('draft:') && !hex(key.slice(6), 20)))
        throw new AddError('Invalid encrypted key in backup.')
    } else if (key.startsWith('cert:')) {
      const e = value as WalletEntry
      if (
        getChain(e.chain).chain.id !== e.chainId ||
        key !== `cert:${certKey(e.chainId, e.id)}` ||
        !hex(e.id, 32) ||
        !hex(e.contract, 20) ||
        !hex(e.payee, 20) ||
        !hex(e.spender, 20) ||
        !validSealed(e.vault) ||
        !/^\d+$/.test(e.faceValue) ||
        !/^\d+$/.test(e.expiresAt) ||
        typeof e.label !== 'string' ||
        !Number.isFinite(e.addedAt)
      )
        throw new AddError('Invalid budget in backup.')
    } else if (key.startsWith('state:')) {
      const entryRaw = data[`cert:${key.slice(6)}`]
      if (!entryRaw) throw new AddError('A payment record has no matching budget.')
      const entry = JSON.parse(entryRaw) as WalletEntry
      const state = deserializeCounterState(value)
      if (
        state.accepted < 0n ||
        state.consumed < 0n ||
        state.consumed > state.accepted ||
        state.accepted > BigInt(entry.faceValue)
      )
        throw new AddError('Invalid payment balance in backup.')
      if (state.pending) {
        const n = decodeNote(state.pending.noteQr)
        if (
          n.chainId !== entry.chainId ||
          n.certificateId.toLowerCase() !== entry.id.toLowerCase() ||
          n.memo !== state.pending.requestId ||
          n.cumulative !== state.pending.cumulative ||
          state.pending.price <= 0n ||
          n.cumulative < state.accepted ||
          n.cumulative < state.consumed + state.pending.price ||
          n.cumulative > BigInt(entry.faceValue)
        )
          throw new AddError('Invalid pending payment in backup.')
      }
    } else if (key === 'history') {
      if (
        !Array.isArray(value) ||
        value.length > 500 ||
        value.some(
          (p) =>
            !hex(p.id, 32) ||
            !hex(p.certificateId, 32) ||
            !/^\d+$/.test(p.price) ||
            !['GUARANTEED', 'UNVERIFIED', 'CONFIRMED'].includes(p.status),
        )
      )
        throw new AddError('Invalid payment history in backup.')
    } else throw new AddError('Unknown wallet backup record.')
  }
}

/** Own a wallet until all started repository writes finish; late saves from a closed view fail. */
export async function openWalletRepository(
  options: Parameters<typeof createWalletRepository>[0],
  lockName = 'fm-wallet',
) {
  const release = await holdLock(lockName)
  const scope = operationScope()
  const repository = createWalletRepository(options)
  const guarded =
    <A extends unknown[], T>(fn: (...args: A) => Promise<T>) =>
    (...args: A) =>
      scope.run(() => fn(...args))
  const rawStore = repository.walletStore()
  const rawKV = repository.kv()
  return {
    ...repository,
    initialize: guarded(repository.initialize),
    confirmPayment: guarded(repository.confirmPayment),
    setPin: guarded(repository.setPin),
    addCertificate: guarded(repository.addCertificate),
    newDraftKey: guarded(repository.newDraftKey),
    dropDraft: guarded(repository.dropDraft),
    importBackup: guarded(repository.importBackup),
    walletStore: () => ({ load: rawStore.load, save: guarded(rawStore.save) }),
    kv: () => ({
      ...rawKV,
      set: guarded(rawKV.set),
      del: guarded(rawKV.del),
      atomic: <T>(change: (records: Map<string, string>) => T) => scope.run(() => rawKV.atomic(change)),
    }),
    async release() {
      await scope.close()
      release()
    },
  }
}
