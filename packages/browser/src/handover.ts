import type { ChainKey } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'

/** A budget handed to someone's wallet: its id and its own spending key, carried in a link's fragment (§10.1). */
export interface HandOver {
  v: 1
  chain: ChainKey
  id: Hex
  key: Hex
  name?: string
}
const b64url = (s: string) =>
  btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
export const unb64url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))

export const handOverFragment = (h: HandOver) => `add=${b64url(JSON.stringify(h))}`
