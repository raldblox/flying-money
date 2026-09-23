import type { ChainKey } from '@flying-money/chains'
import { type Counter, createCounter, memoryStore, type StoreSnapshot } from '@flying-money/server/browser'
import type { Hex } from 'viem'
import './e2e'
import { idbKV, type KV } from './idb'

/** Till settings (§12.5 step 4), kept on this device. */
export interface TillSettings {
  name: string
  /** USDC base units, as a decimal string. Default 5 USDC. */
  firstVisitLimit: string
  /** "Tea 3.50" per line. */
  priceList: string
  primary: boolean
}
export const DEFAULT_SETTINGS: TillSettings = {
  name: 'My shop',
  firstVisitLimit: '5000000',
  priceList: 'Tea 3.50\nDumplings 6.00\nMooncake 2.25',
  primary: true,
}

export interface Till {
  counter: Counter
  store: ReturnType<typeof memoryStore>
  kv: KV
  settings: TillSettings
  saveSettings(s: TillSettings): Promise<void>
  release(): void
}

/**
 * Opens the till for one shop. Its seller state is a memoryStore saved to IndexedDB on every write (D21).
 * Only one tab may hold it (Web Locks), because two in-memory copies would stop being authoritative (§6.8).
 */
export async function openTill(chain: ChainKey, payee: Hex, name?: string): Promise<Till> {
  const id = `fm-till:${chain}:${payee.toLowerCase()}`
  const release = await holdLock(id)
  const kv = idbKV(id)
  const snap = await kv.get('store')
  const settingsRaw = await kv.get('settings')
  const settings: TillSettings = settingsRaw
    ? { ...DEFAULT_SETTINGS, ...(JSON.parse(settingsRaw) as Partial<TillSettings>) }
    : { ...DEFAULT_SETTINGS, ...(name ? { name } : {}) }
  const store = memoryStore({
    ...(snap ? { initial: JSON.parse(snap) as StoreSnapshot } : {}),
    onCommit: (s) => kv.set('store', JSON.stringify(s)),
  })
  const counter = createCounter({
    chain,
    payee,
    store,
    kv: { get: kv.get, set: kv.set, keys: kv.keys },
    firstVisitLimit: BigInt(settings.firstVisitLimit),
  })
  return {
    counter,
    store,
    kv,
    settings,
    saveSettings: (s) => kv.set('settings', JSON.stringify(s)),
    release,
  }
}

export class TillBusyError extends Error {
  constructor() {
    super('This till is already open in another tab or window.')
  }
}

/**
 * Holds an exclusive Web Lock for the page's lifetime; throws TillBusyError if another tab keeps it. Retries briefly,
 * because a page that is re-mounting (or reloading) may still be releasing its own lock.
 */
export async function holdLock(name: string, attempts = 8): Promise<() => void> {
  for (let i = 1; ; i++) {
    try {
      return await tryLock(name)
    } catch (e) {
      if (!(e instanceof TillBusyError) || i >= attempts) throw e
      await new Promise((r) => setTimeout(r, 150))
    }
  }
}

function tryLock(name: string): Promise<() => void> {
  if (!('locks' in navigator)) return Promise.resolve(() => {})
  return new Promise((resolve, reject) => {
    let free: () => void = () => {}
    const held = new Promise<void>((r) => {
      free = r
    })
    navigator.locks
      .request(name, { ifAvailable: true }, async (lock) => {
        if (!lock) {
          reject(new TillBusyError())
          return
        }
        resolve(free)
        await held
      })
      .catch(reject)
  })
}

/** "Tea 3.50" lines → items. Amounts are parsed as exact decimals (never floats). */
export function parsePriceList(s: string): Array<{ label: string; amount: string }> {
  return s
    .split('\n')
    .map((l) => l.trim())
    .map((l) => /^(.*\S)\s+(\d+(?:\.\d{1,6})?)$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ label: m[1]!, amount: m[2]! }))
}

export const newOrderId = () =>
  `o-${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0]!.toString(36)}`
