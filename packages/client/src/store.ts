import type { CertKey, Hex, X402Requirements } from '@flying-money/core'

export interface PendingRequest {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
  /** set when the seller speaks only x402: the chosen `accepts` entry; the slip then travels in PAYMENT-SIGNATURE */
  x402?: X402Requirements
}

/** The single in-flight note for a certificate (§6.6). Saved durably BEFORE it is sent. */
export interface PendingRecord {
  requestId: Hex
  noteHeader: string
  cumulative: bigint
  request: PendingRequest
  createdAt: number
}

/** Durable client state per certificate: values from the latest receipt + at most one pending note. */
export interface ClientCertState {
  accepted: bigint
  consumed: bigint
  reserved: bigint
  pending?: PendingRecord
}

export interface ClientStore {
  load(key: CertKey): Promise<ClientCertState | null>
  /** MUST be durable when it resolves (fsync'd for files). Replaces the whole record atomically. */
  save(key: CertKey, state: ClientCertState): Promise<void>
  keys(): Promise<CertKey[]>
}

type Json = Record<string, unknown>

export function serializeState(s: ClientCertState): Json {
  return {
    accepted: s.accepted.toString(),
    consumed: s.consumed.toString(),
    reserved: s.reserved.toString(),
    ...(s.pending
      ? {
          pending: {
            requestId: s.pending.requestId,
            noteHeader: s.pending.noteHeader,
            cumulative: s.pending.cumulative.toString(),
            request: s.pending.request,
            createdAt: s.pending.createdAt,
          },
        }
      : {}),
  }
}

export function deserializeState(j: Json): ClientCertState {
  const p = j.pending as Json | undefined
  return {
    accepted: BigInt(j.accepted as string),
    consumed: BigInt(j.consumed as string),
    reserved: BigInt((j.reserved as string | undefined) ?? '0'),
    ...(p
      ? {
          pending: {
            requestId: p.requestId as Hex,
            noteHeader: p.noteHeader as string,
            cumulative: BigInt(p.cumulative as string),
            request: p.request as PendingRequest,
            createdAt: p.createdAt as number,
          },
        }
      : {}),
  }
}

/** In-memory store (tests, or a process that treats its own memory as durable). */
export function memoryStore(): ClientStore {
  const m = new Map<string, Json>()
  return {
    async load(key) {
      const j = m.get(key.toLowerCase())
      return j ? deserializeState(structuredClone(j)) : null
    },
    async save(key, state) {
      m.set(key.toLowerCase(), serializeState(state))
    },
    async keys() {
      return [...m.keys()] as CertKey[]
    },
  }
}

/**
 * JSON file store for agents (Node only). Each save writes a temp file, fsyncs it, then renames it over the
 * original, so a crash leaves either the old or the new file, never a torn one.
 */
export function fileStore(path: string): ClientStore {
  let chain: Promise<unknown> = Promise.resolve()
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const p = chain.then(fn, fn)
    chain = p.catch(() => {})
    return p
  }
  const fs = () => import('node:fs/promises')

  async function readAll(): Promise<Record<string, Json>> {
    try {
      return JSON.parse(await (await fs()).readFile(path, 'utf8')) as Record<string, Json>
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {}
      throw e
    }
  }

  async function writeAll(all: Record<string, Json>) {
    const f = await fs()
    const tmp = `${path}.${process.pid}.tmp`
    const h = await f.open(tmp, 'w', 0o600)
    try {
      await h.writeFile(JSON.stringify(all, null, 2))
      await h.sync()
    } finally {
      await h.close()
    }
    await f.rename(tmp, path)
  }

  return {
    load: (key) =>
      serial(async () => {
        const j = (await readAll())[key.toLowerCase()]
        return j ? deserializeState(j) : null
      }),
    save: (key, state) =>
      serial(async () => {
        const all = await readAll()
        all[key.toLowerCase()] = serializeState(state)
        await writeAll(all)
      }),
    keys: () => serial(async () => Object.keys(await readAll()) as CertKey[]),
  }
}

/** A budget request as persisted by the agent (§21.4.5). */
export interface BudgetRequestRecord {
  requestId: Hex
  chain: string
  status: 'asked' | 'approved' | 'declined' | 'expired'
  /** link channel: the approval link (it carries the signed request) */
  link: string
  /** relay channel: the signed request (fm1), kept so the request survives a restart */
  signed?: string
  via?: 'relay' | 'link'
  /** top-up requests: the budget's face value when asked (§22.2 A4) */
  baseline?: string
  fromBlock: string
  certificateId?: Hex
}

export interface RequestStore {
  load(): Promise<BudgetRequestRecord[]>
  save(list: BudgetRequestRecord[]): Promise<void>
}

export function memoryRequestStore(): RequestStore {
  let list: BudgetRequestRecord[] = []
  return {
    async load() {
      return list.map((r) => ({ ...r }))
    },
    async save(l) {
      list = l.map((r) => ({ ...r }))
    },
  }
}

/** Budget requests in a JSON file, written atomically (fsync + rename), like the outbox. */
export function fileRequestStore(path: string): RequestStore {
  const fs = () => import('node:fs/promises')
  return {
    async load() {
      try {
        return JSON.parse(await (await fs()).readFile(path, 'utf8')) as BudgetRequestRecord[]
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
        throw e
      }
    },
    async save(list) {
      const f = await fs()
      const tmp = `${path}.${process.pid}.tmp`
      const h = await f.open(tmp, 'w', 0o600)
      try {
        await h.writeFile(JSON.stringify(list, null, 2))
        await h.sync()
      } finally {
        await h.close()
      }
      await f.rename(tmp, path)
    },
  }
}
