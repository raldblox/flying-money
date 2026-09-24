import { type ChainKey, getChain, getChainById, isChainKey } from '@flying-money/chains'
import { decodeOffer, type Hex } from '@flying-money/core'
import { isAddress } from 'viem'
import { idbKV } from './idb'
import { type Sealed, seal, unseal } from './pin-vault'

/**
 * Contacts (§12.6): People & agents and Places, kept ONLY on this device (IndexedDB). Names and labels never go
 * on-chain or to any server (§3.9). Optional export is encrypted with a passphrase.
 */
export type HolderType = 'person' | 'child' | 'employee' | 'agent'
export type KeyPolicy = 'per-certificate' | 'one-key'

export interface Holder {
  id: string
  name: string
  type: HolderType
  emoji: string
  /** §3.9 default: a fresh key per certificate for people, one key per agent. */
  keyPolicy: KeyPolicy
  /** Agents (and one-key holders): the spending address, e.g. from `keygen`. */
  address?: Hex
  certificates: Array<{ chain: ChainKey; id: Hex; place: Hex; faceValue: string; durationIdx: number }>
  createdAt: number
}

export type Verification = 'scanned' | 'domain' | 'unverified'
export interface PlaceContact {
  id: string
  name: string
  chain: ChainKey
  payee: Hex
  verification: Verification
  domain?: string
  createdAt: number
}

const db = () => idbKV('fm-contacts')
const rid = () => crypto.getRandomValues(new Uint32Array(2)).reduce((s, n) => s + n.toString(36), '')

export const defaultKeyPolicy = (t: HolderType): KeyPolicy =>
  t === 'agent' || t === 'employee' ? 'one-key' : 'per-certificate'

async function all<T>(prefix: string): Promise<T[]> {
  const d = db()
  const out: T[] = []
  for (const k of await d.keys(prefix)) {
    const v = await d.get(k)
    if (v) out.push(JSON.parse(v) as T)
  }
  return out
}

export const listHolders = async () => (await all<Holder>('holder:')).sort((a, b) => a.createdAt - b.createdAt)
export const getHolder = async (id: string) => {
  const v = await db().get(`holder:${id}`)
  return v ? (JSON.parse(v) as Holder) : null
}
export async function saveHolder(h: Omit<Holder, 'id' | 'createdAt' | 'certificates'> & Partial<Holder>) {
  const full: Holder = {
    id: h.id ?? rid(),
    createdAt: h.createdAt ?? Date.now(),
    certificates: h.certificates ?? [],
    ...h,
  } as Holder
  await db().set(`holder:${full.id}`, JSON.stringify(full))
  return full
}
export const deleteHolder = (id: string) => db().del(`holder:${id}`)

export async function addCertificateToHolder(holderId: string, c: Holder['certificates'][number]) {
  const h = await getHolder(holderId)
  if (!h) return
  if (!h.certificates.some((x) => x.id.toLowerCase() === c.id.toLowerCase())) h.certificates.push(c)
  await saveHolder(h)
}

export const listPlaces = async () => (await all<PlaceContact>('place:')).sort((a, b) => a.createdAt - b.createdAt)
export async function savePlace(p: Omit<PlaceContact, 'id' | 'createdAt'> & Partial<PlaceContact>) {
  const existing = (await listPlaces()).find(
    (x) => x.chain === p.chain && x.payee.toLowerCase() === p.payee.toLowerCase(),
  )
  const rank = (v: Verification) => ({ unverified: 0, domain: 1, scanned: 2 })[v]
  const full: PlaceContact = {
    ...(existing ?? {}),
    ...p,
    id: existing?.id ?? p.id ?? rid(),
    createdAt: existing?.createdAt ?? Date.now(),
    // never downgrade a stronger verification
    verification:
      existing && rank(existing.verification) > rank(p.verification) ? existing.verification : p.verification,
  } as PlaceContact
  await db().set(`place:${full.id}`, JSON.stringify(full))
  return full
}
export const deletePlace = (id: string) => db().del(`place:${id}`)

export const badgeOf = (p: PlaceContact) =>
  p.verification === 'scanned' ? '✓ Scanned' : p.verification === 'domain' ? `✓ ${p.domain}` : '⚠ Unverified'

/**
 * "Verified in person": the shop's till price code (fm1 offer) or its shop page URL (/shop/<chain>/<payee>?name=).
 * Returns the place's chain, payee and (from a shop URL) its name.
 */
export function placeFromScan(text: string): { chain: ChainKey; payee: Hex; name?: string } | null {
  const t = text.trim()
  if (t.startsWith('fm1.')) {
    try {
      const o = decodeOffer(t)
      const a = o.accepts[0]
      const c = a ? getChainById(a.chainId) : undefined
      return a && c ? { chain: c.key, payee: a.payee } : null
    } catch {
      return null
    }
  }
  try {
    const u = new URL(t)
    const m = /^\/shop\/([a-z0-9-]+)\/(0x[0-9a-fA-F]{40})\/?(?:pos)?$/.exec(u.pathname)
    if (!m || !isChainKey(m[1]!) || !isAddress(m[2]!)) return null
    const name = u.searchParams.get('name')?.slice(0, 60)
    return { chain: m[1] as ChainKey, payee: m[2] as Hex, ...(name ? { name } : {}) }
  } catch {
    return null
  }
}

/**
 * "Verified by domain": reads https://<domain>/.well-known/flying-money.json in the browser (the seller must allow
 * CORS, as the SDK's sellers do) and returns the payees it lists for this chain.
 */
export async function placesFromDomain(domain: string, chain: ChainKey): Promise<Hex[]> {
  const host = domain
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) throw new Error('Enter a domain like shop.example.com')
  const res = await fetch(`https://${host}/.well-known/flying-money.json`, { redirect: 'error' })
  if (!res.ok) throw new Error(`${host} has no /.well-known/flying-money.json (HTTP ${res.status})`)
  const j = (await res.json()) as { accepts?: Array<{ chainId?: string | number; payee?: string }> }
  const chainId = getChain(chain).chain.id
  const payees = (j.accepts ?? [])
    .filter((a) => Number(a.chainId) === chainId && typeof a.payee === 'string' && isAddress(a.payee))
    .map((a) => a.payee as Hex)
  if (payees.length === 0) throw new Error(`${host} doesn’t accept payments on ${getChain(chain).chain.name}`)
  return [...new Set(payees)]
}

// ── Encrypted export / import (§12.6) ──────────────────────────────────────────
export async function exportContacts(passphrase: string): Promise<string> {
  const body = JSON.stringify({ holders: await listHolders(), places: await listPlaces() })
  const sealed: Sealed = await seal(passphrase, body)
  return JSON.stringify({ kind: 'flying-money-contacts', v: 1, sealed })
}
export async function importContacts(text: string, passphrase: string) {
  const j = JSON.parse(text) as { kind?: string; v?: number; sealed?: Sealed }
  if (j.kind !== 'flying-money-contacts' || j.v !== 1 || !j.sealed) throw new Error('Not a Flying Money contacts file.')
  let body: string
  try {
    body = await unseal(passphrase, j.sealed)
  } catch {
    throw new Error('Wrong passphrase.')
  }
  const { holders, places } = JSON.parse(body) as { holders: Holder[]; places: PlaceContact[] }
  for (const h of holders) await saveHolder(h)
  for (const p of places) await savePlace(p)
  return { holders: holders.length, places: places.length }
}
