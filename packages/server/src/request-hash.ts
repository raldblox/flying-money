import type { Hex } from '@flying-money/core'
import { concat, keccak256, stringToBytes } from 'viem'

/**
 * Binds a requestId to one HTTP request (DECISIONS D32): keccak256 over the method, the path, the query with its
 * parameters sorted, and keccak256 of the body. The host is left out so proxies and aliases don't matter.
 */
export function requestHash(method: string, url: URL, body: Uint8Array = new Uint8Array()): Hex {
  const q = new URLSearchParams(url.search)
  q.sort()
  const head = `${method.toUpperCase()}\n${url.pathname}\n${q.toString()}\n`
  return keccak256(concat([stringToBytes(head), keccak256(body)]))
}
