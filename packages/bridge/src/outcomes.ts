import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'

/** What the target returned for one request, kept so a resent note (or a restart) never pays the site twice. */
export interface Delivered {
  status: number
  type: string | null
  text: string
  settle: string | null
}

export interface OutcomeStore {
  get(requestId: string): Promise<Delivered | undefined>
  set(requestId: string, outcome: Delivered): Promise<void>
}

const MAX_TEXT = 256_000

export function memoryOutcomes(): OutcomeStore {
  const m = new Map<string, Delivered>()
  return {
    async get(id) {
      return m.get(id.toLowerCase())
    },
    async set(id, o) {
      if (o.text.length <= MAX_TEXT) m.set(id.toLowerCase(), o)
    },
  }
}

/** One JSON file (written atomically): enough for a self-hosted bridge that restarts. */
export function fileOutcomes(path: string): OutcomeStore {
  const m = new Map<string, Delivered>(existsSync(path) ? Object.entries(JSON.parse(readFileSync(path, 'utf8'))) : [])
  let chain: Promise<void> = Promise.resolve()
  return {
    async get(id) {
      return m.get(id.toLowerCase())
    },
    set(id, o) {
      if (o.text.length > MAX_TEXT) return Promise.resolve()
      m.set(id.toLowerCase(), o)
      chain = chain.then(() => {
        const tmp = `${path}.tmp`
        writeFileSync(tmp, JSON.stringify(Object.fromEntries(m)))
        renameSync(tmp, path)
      })
      return chain
    },
  }
}
