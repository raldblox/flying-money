import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import { isIP } from 'node:net'
import { Agent } from 'undici'

/**
 * Audit F6 (SSRF): the MCP tools fetch URLs chosen by the model, and a model can be prompt-injected. This fetch
 * refuses anything that isn't the public internet: private, loopback, link-local (cloud metadata), carrier-grade NAT,
 * benchmark, documentation, multicast and reserved ranges, for IPv4 and IPv6 (including IPv4-mapped and NAT64 forms).
 * The host is checked as written, and every address it resolves to is checked again at connect time, so a name
 * that re-resolves to 127.0.0.1 (DNS rebinding) is refused too. Redirects are never followed; a 3xx is returned
 * as is. Hosts listed in `allowHosts` ("host:port", e.g. a local Oracle during development, FM_ALLOW_HOSTS) skip the
 * address check, and only on that exact port.
 */
export class BlockedHostError extends Error {
  constructor(host: string, address?: string) {
    super(
      `blocked: ${host}${address && address !== host ? ` (${address})` : ''} is a private, local or reserved address. Only public http(s) services can be paid.`,
    )
    this.name = 'BlockedHostError'
  }
}

const V4_BLOCKED: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]

const v4ToInt = (ip: string) => ip.split('.').reduce((a, o) => a * 256 + Number(o), 0)

function v4Blocked(ip: string): boolean {
  const n = v4ToInt(ip)
  return V4_BLOCKED.some(([base, bits]) => {
    const size = 2 ** (32 - bits)
    const start = v4ToInt(base)
    return n >= start && n < start + size
  })
}

/** Expand an IPv6 address into 8 16-bit groups (handles "::" and a trailing dotted IPv4). */
function v6Groups(ip: string): number[] {
  let s = ip.toLowerCase().split('%')[0]!
  const dotted = s.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) {
    const n = v4ToInt(dotted[1]!)
    s = `${s.slice(0, -dotted[1]!.length)}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`
  }
  const [head, tail] = s.split('::') as [string, string | undefined]
  const h = head ? head.split(':') : []
  const t = tail ? tail.split(':') : []
  const fill = tail === undefined ? [] : new Array(8 - h.length - t.length).fill('0')
  return [...h, ...fill, ...t].map((g) => Number.parseInt(g || '0', 16))
}

function v6Blocked(ip: string): boolean {
  const g = v6Groups(ip)
  const embeddedV4 = () => `${g[6]! >> 8}.${g[6]! & 255}.${g[7]! >> 8}.${g[7]! & 255}`
  if (g.slice(0, 7).every((x) => x === 0) && (g[7] === 0 || g[7] === 1)) return true // :: and ::1
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return v4Blocked(embeddedV4()) // ::ffff:a.b.c.d
  if (g.slice(0, 6).every((x) => x === 0)) return v4Blocked(embeddedV4()) // deprecated ::a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return v4Blocked(embeddedV4()) // NAT64
  if ((g[0]! & 0xfe00) === 0xfc00) return true // fc00::/7 unique local
  if ((g[0]! & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((g[0]! & 0xff00) === 0xff00) return true // ff00::/8 multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true // documentation
  if (g[0] === 0x0100 && g.slice(1, 4).every((x) => x === 0)) return true // 100::/64 discard
  return false
}

/**
 * A device on the local network or this machine: 10/8, 172.16/12, 192.168/16, 127/8, ::1 and fc00::/7. Never
 * link-local (169.254/16, fe80::/10), where cloud metadata services live. Reachable only with FM_ALLOW_LAN=1.
 */
export function isLanAddress(ip: string): boolean {
  const v = isIP(ip)
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number]
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  }
  if (v === 6) {
    const g = v6Groups(ip)
    if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true
    return (g[0]! & 0xfe00) === 0xfc00
  }
  return false
}

/** True for any address a paid fetch must never reach. */
export function isBlockedAddress(ip: string): boolean {
  const v = isIP(ip)
  if (v === 4) return v4Blocked(ip)
  if (v === 6) return v6Blocked(ip)
  return true // not an address at all: refuse
}

type LookupCb = (err: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void
export type Lookup = (host: string, options: object, cb: LookupCb) => void

const systemLookup: Lookup = (host, options, cb) => dnsLookup(host, { ...options, all: true }, cb)

/** A guarded fetch that can also be told about one more reachable host:port (a seller found on the local network). */
export type GuardedFetch = typeof fetch & { allowHost(hostPort: string): void }

export function guardedFetch(
  opts: {
    allowHosts?: string[]
    /** FM_ALLOW_LAN=1: also reach this machine and the local network (never link-local) */
    allowLan?: boolean
    base?: typeof fetch
    lookup?: Lookup
  } = {},
): GuardedFetch {
  const base = opts.base ?? fetch
  const allow = new Set((opts.allowHosts ?? []).map((h) => h.trim().toLowerCase()).filter(Boolean))
  const resolve = opts.lookup ?? systemLookup
  // every connection resolves through here, so the check happens on the address actually dialled
  const agent = new Agent({
    connect: {
      lookup: ((host: string, options: { all?: boolean }, cb: (...a: unknown[]) => void) => {
        resolve(host, options, (err, addrs) => {
          if (err) return cb(err)
          const bad = addrs.find((a) => isBlockedAddress(a.address) && !(opts.allowLan && isLanAddress(a.address)))
          if (bad || addrs.length === 0) return cb(new BlockedHostError(host, bad?.address))
          if (options.all) cb(null, addrs)
          else cb(null, addrs[0]!.address, addrs[0]!.family)
        })
      }) as never,
    },
  })
  const guarded = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('only http(s) URLs can be fetched')
    const port = url.port || (url.protocol === 'https:' ? '443' : '80')
    const hostname = url.hostname.replace(/^\[|\]$/g, '')
    const noRedirect = { ...init, redirect: 'manual' as const }
    if (allow.has(`${hostname.toLowerCase()}:${port}`) || allow.has(`${url.hostname.toLowerCase()}:${port}`))
      return base(input, noRedirect)
    // a literal address never goes through DNS, so check it here
    if (isIP(hostname) && isBlockedAddress(hostname) && !(opts.allowLan && isLanAddress(hostname)))
      throw new BlockedHostError(url.hostname)
    // loopback names can be answered without the lookup hook, so refuse them by name
    const name = hostname.toLowerCase().replace(/\.$/, '')
    if ((name === 'localhost' || name.endsWith('.localhost')) && !opts.allowLan)
      throw new BlockedHostError(url.hostname)
    try {
      return await base(input, { ...noRedirect, dispatcher: agent } as RequestInit)
    } catch (e) {
      // surface the reason instead of undici's generic "fetch failed"
      let c: unknown = e
      while (c instanceof Error) {
        if (c instanceof BlockedHostError) throw c
        c = c.cause
      }
      throw e
    }
  }) as GuardedFetch
  guarded.allowHost = (hostPort: string) => {
    allow.add(hostPort.trim().toLowerCase())
  }
  return guarded
}

/** FM_ALLOW_HOSTS="localhost:8787,127.0.0.1:8787" → ['localhost:8787', '127.0.0.1:8787'] */
export const allowHostsFromEnv = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
