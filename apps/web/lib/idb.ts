/**
 * Tiny IndexedDB key-value store for the till and the wallet (§12.5). Each `set` is one readwrite transaction with
 * `durability: 'strict'`, and resolves only when it has committed, so a write is on disk before the UI shows its
 * result. Browser only.
 */
export interface KV {
  get(key: string): Promise<string | undefined>
  set(key: string, value: string): Promise<void>
  del(key: string): Promise<void>
  keys(prefix: string): Promise<string[]>
}

const STORE = 'kv'

function open(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function idbKV(name: string): KV {
  let db: Promise<IDBDatabase> | undefined
  const conn = () => {
    db ??= open(name)
    return db
  }
  function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return conn().then(
      (d) =>
        new Promise<T>((resolve, reject) => {
          const t = d.transaction(STORE, mode, mode === 'readwrite' ? { durability: 'strict' } : undefined)
          const req = run(t.objectStore(STORE))
          t.oncomplete = () => resolve(req.result)
          t.onerror = () => reject(t.error)
          t.onabort = () => reject(t.error ?? new Error('IndexedDB transaction aborted'))
        }),
    )
  }
  return {
    get: (k) => tx('readonly', (s) => s.get(k) as IDBRequest<string | undefined>),
    set: (k, v) => tx('readwrite', (s) => s.put(v, k)).then(() => undefined),
    del: (k) => tx('readwrite', (s) => s.delete(k)).then(() => undefined),
    keys: (p) => tx('readonly', (s) => s.getAllKeys(IDBKeyRange.bound(p, `${p}￿`))).then((ks) => ks.map(String)),
  }
}
