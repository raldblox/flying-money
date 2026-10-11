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
export interface AtomicKV extends KV {
  /** Synchronous read-modify-write in one strict transaction. Throwing rolls the whole mutation back. */
  atomic<T>(change: (records: Map<string, string>) => T): Promise<T>
}

const connections = new Map<string, Promise<IDBDatabase>>()

function open(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let failed = false
    const req = indexedDB.open(name, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => {
      const db = req.result
      if (failed) {
        db.close()
        return
      }
      db.onversionchange = () => {
        db.close()
        connections.delete(name)
      }
      db.onclose = () => {
        connections.delete(name)
      }
      resolve(db)
    }
    req.onerror = () => {
      failed = true
      reject(req.error)
    }
    req.onblocked = () => {
      failed = true
      reject(new Error('Local storage is waiting for another tab to close.'))
    }
  })
}

export function idbKV(name: string): AtomicKV {
  const conn = () => {
    let db = connections.get(name)
    if (!db) {
      db = open(name).catch((error) => {
        connections.delete(name)
        throw error
      })
      connections.set(name, db)
    }
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
    atomic: async <T>(change: (records: Map<string, string>) => T): Promise<T> => {
      const db = await conn()
      return new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, 'readwrite', { durability: 'strict' })
        const store = transaction.objectStore(STORE)
        const keys = store.getAllKeys()
        const values = store.getAll()
        let result: T
        let error: unknown
        values.onsuccess = () => {
          try {
            const before = new Map(keys.result.map((key, i) => [String(key), values.result[i] as string]))
            const after = new Map(before)
            result = change(after)
            if (result && typeof (result as { then?: unknown }).then === 'function')
              throw new Error('IndexedDB mutations must be synchronous.')
            for (const key of before.keys()) if (!after.has(key)) store.delete(key)
            for (const [key, value] of after) if (value !== before.get(key)) store.put(value, key)
          } catch (cause) {
            error = cause
            transaction.abort()
          }
        }
        transaction.oncomplete = () => resolve(result)
        transaction.onabort = () => reject(error ?? transaction.error ?? new Error('Local storage write aborted.'))
        transaction.onerror = () => reject(transaction.error)
      })
    },
    get: (k) => tx('readonly', (s) => s.get(k) as IDBRequest<string | undefined>),
    set: (k, v) => tx('readwrite', (s) => s.put(v, k)).then(() => undefined),
    del: (k) => tx('readwrite', (s) => s.delete(k)).then(() => undefined),
    keys: (p) => tx('readonly', (s) => s.getAllKeys(IDBKeyRange.bound(p, `${p}￿`))).then((ks) => ks.map(String)),
  }
}
