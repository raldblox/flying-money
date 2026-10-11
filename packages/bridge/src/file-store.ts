import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { memoryStore, type NoteStore, type StoreSnapshot } from '@flying-money/server'

/**
 * A durable seller store for a single self-hosted bridge: the memory store with every write saved (temp file, then
 * rename) before it is acknowledged. A restart reloads it, so accepted notes and reservations survive. One process only:
 * several bridge instances need Redis or Upstash instead.
 */
export function fileNoteStore(path: string): NoteStore {
  const initial = existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as StoreSnapshot) : undefined
  let chain: Promise<void> = Promise.resolve()
  return memoryStore({
    ...(initial ? { initial } : {}),
    onCommit: (snap) => {
      chain = chain.then(() => {
        const tmp = `${path}.tmp`
        writeFileSync(tmp, JSON.stringify(snap))
        renameSync(tmp, path)
      })
      return chain
    },
  })
}
