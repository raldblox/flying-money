import { scryptAsync } from '@noble/hashes/scrypt.js'
import type { Hex } from 'viem'

/**
 * Spender keys at rest (§12.5 key policy): AES-GCM with a key derived from the customer's PIN by scrypt.
 * A spender key holds no funds and needs no gas; the worst case of a leak is that certificate's remaining value,
 * at one place. Browser only (WebCrypto).
 */
export interface Sealed {
  v: 1
  salt: string
  iv: string
  ct: string
}

const N = 2 ** 15 // ~0.3–1 s on a phone
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function aesKey(pin: string, salt: Uint8Array) {
  const raw = await scryptAsync(new TextEncoder().encode(pin), salt, { N, r: 8, p: 1, dkLen: 32 })
  return crypto.subtle.importKey('raw', raw as Uint8Array<ArrayBuffer>, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function seal(pin: string, secret: string): Promise<Sealed> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await aesKey(pin, salt),
    new TextEncoder().encode(secret),
  )
  return { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) }
}

/** Throws on a wrong PIN (AES-GCM authentication fails). */
export async function unseal(pin: string, s: Sealed): Promise<string> {
  const key = await aesKey(pin, unb64(s.salt))
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) }, key, unb64(s.ct))
  return new TextDecoder().decode(pt)
}

export const sealKey = (pin: string, key: Hex) => seal(pin, key)
export const unsealKey = async (pin: string, s: Sealed) => (await unseal(pin, s)) as Hex

export const validPin = (pin: string) => /^\d{6,12}$/.test(pin)
