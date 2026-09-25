import { type ChainKey, getChain, getChainById } from '@flying-money/chains'
import {
  type CounterCertificate,
  type CounterState,
  type CounterWalletStore,
  deserializeCounterState,
  serializeCounterState,
} from '@flying-money/client/counter'
import { certKey, type Hex } from '@flying-money/core'
import { privateKeyToAccount } from 'viem/accounts'
import { loadCertificate } from './chain'
import { idbKV } from './idb'
import { type Sealed, seal, sealKey, unseal } from './pin-vault'
import { openBackup, sealBackup } from './wallet-backup'

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

export const kv = () => idbKV('fm-wallet')

export const toCounterCert = (e: WalletEntry): CounterCertificate => ({
  chainId: e.chainId,
  contract: e.contract,
  id: e.id,
  payee: e.payee,
  faceValue: BigInt(e.faceValue),
  expiresAt: BigInt(e.expiresAt),
})

export function walletStore(): CounterWalletStore {
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

export async function listEntries(): Promise<Array<WalletEntry & { state: CounterState | null }>> {
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
export async function hasPin() {
  return Boolean(await kv().get('pin-check'))
}
export async function setPin(pin: string) {
  await kv().set('pin-check', JSON.stringify(await seal(pin, 'flying-money')))
}
export async function checkPin(pin: string): Promise<boolean> {
  const raw = await kv().get('pin-check')
  if (!raw) return false
  try {
    return (await unseal(pin, JSON.parse(raw) as Sealed)) === 'flying-money'
  } catch {
    return false
  }
}

// ── Adding certificates ─────────────────────────────────────────────────────
export class AddError extends Error {}

/**
 * Adds a certificate whose spender key is `key`. Reads it on-chain (needs a connection) and checks that the key
 * really is its spender, so the wallet never shows a balance it cannot spend.
 */
export async function addCertificate(opts: { chain: ChainKey; id: Hex; key: Hex; pin: string; label?: string }) {
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
export async function newDraftKey(pin: string) {
  const { generatePrivateKey } = await import('viem/accounts')
  const key = generatePrivateKey()
  const address = privateKeyToAccount(key).address
  await kv().set(`draft:${address.toLowerCase()}`, JSON.stringify(await sealKey(pin, key)))
  return address
}
export async function listDrafts(): Promise<Hex[]> {
  return (await kv().keys('draft:')).map((k) => k.slice(6) as Hex)
}
export async function draftKey(address: Hex, pin: string): Promise<Hex | null> {
  const raw = await kv().get(`draft:${address.toLowerCase()}`)
  if (!raw) return null
  return (await unseal(pin, JSON.parse(raw) as Sealed)) as Hex
}
export async function dropDraft(address: Hex) {
  await kv().del(`draft:${address.toLowerCase()}`)
}

// ── Hand-over links (§12.5 funder flow): the key travels only in the URL fragment ────────────────
export interface HandOver {
  v: 1
  chain: ChainKey
  id: Hex
  key: Hex
  name?: string
}
const b64url = (s: string) =>
  btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
const unb64url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))

export const handOverFragment = (h: HandOver) => `add=${b64url(JSON.stringify(h))}`

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

// ── Backup (§12.5: storage can be wiped) ─────────────────────────────────────
/** Everything in the wallet (keys still sealed with the PIN), sealed again with a backup passphrase (audit F10). */
export async function exportBackup(passphrase: string): Promise<string> {
  const db = kv()
  const dump: Record<string, string> = {}
  for (const p of ['cert:', 'state:', 'draft:', 'pin-check'])
    for (const k of await db.keys(p)) {
      const v = await db.get(k)
      if (v !== undefined) dump[k] = v
    }
  return sealBackup(dump, passphrase)
}

export async function importBackup(text: string, passphrase?: string) {
  let data: Record<string, string>
  try {
    data = await openBackup(text, passphrase)
  } catch (e) {
    throw new AddError((e as Error).message)
  }
  const db = kv()
  // Keys in a backup are sealed with the backup's PIN, so it can only be restored into an empty wallet.
  if ((await db.keys('cert:')).length > 0 || (await db.keys('draft:')).length > 0)
    throw new AddError('Restore a backup into an empty wallet (on a new phone, or after the old data was wiped).')
  for (const [k, v] of Object.entries(data)) {
    if (!/^(cert:|state:|draft:|pin-check$)/.test(k)) continue
    await db.set(k, v)
  }
}

export const chainLabel = (chainId: number) => getChainById(chainId)?.chain.name ?? `chain ${chainId}`
