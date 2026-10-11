import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { isBlockedAddress } from './net-guard.js'

export class BlockedTargetError extends Error {
  constructor(public reason: string) {
    super(`target refused: ${reason}`)
    this.name = 'BlockedTargetError'
  }
}

/** True for loopback, private, link-local (incl. cloud metadata), CGNAT, multicast and other non-public addresses. */
export const isPrivateAddress = isBlockedAddress

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
