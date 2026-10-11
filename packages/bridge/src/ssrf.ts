import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export class BlockedTargetError extends Error {
  constructor(public reason: string) {
    super(`target refused: ${reason}`)
    this.name = 'BlockedTargetError'
  }
}

/** True for loopback, private, link-local (incl. cloud metadata), CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number]
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }
  const v6 = ip.toLowerCase()
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateAddress(mapped[1] as string)
  return (
    v6 === '::' ||
    v6 === '::1' ||
    v6.startsWith('fc') ||
    v6.startsWith('fd') ||
    v6.startsWith('fe8') ||
    v6.startsWith('fe9') ||
    v6.startsWith('fea') ||
    v6.startsWith('feb') ||
    v6.startsWith('ff')
  )
}

export interface TargetPolicy {
  /** Tests only: allow http:// and loopback/private targets. Never set this on a deployed bridge. */
  allowLocal?: boolean
  /** Optional allowlist of hostnames; when set, nothing else is reachable. */
  allowHosts?: string[]
}

/** Validates the target before any request leaves the bridge (SSRF guard). Returns the parsed URL. */
export async function assertPublicTarget(raw: string, policy: TargetPolicy = {}): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new BlockedTargetError('not a URL')
  }
  if (url.username || url.password) throw new BlockedTargetError('credentials in the URL')
  if (url.protocol !== 'https:' && !(policy.allowLocal && url.protocol === 'http:'))
    throw new BlockedTargetError(policy.allowLocal ? 'http(s) only' : 'https only')
  if (policy.allowHosts && !policy.allowHosts.includes(url.hostname)) throw new BlockedTargetError('host not allowed')
  if (policy.allowLocal) return url
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => [])
  if (addrs.length === 0) throw new BlockedTargetError('host does not resolve')
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new BlockedTargetError('private or reserved address')
  return url
}
