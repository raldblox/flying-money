import type { Hex } from '@flying-money/core'
import { type PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts'

/** Load a private key from env (accepts MetaMask-style keys without 0x). Never logs the key. */
export function keyFromEnv(name: string, env: Record<string, string | undefined> = process.env): PrivateKeyAccount {
  const raw = env[name]?.trim()
  if (!raw) throw new Error(`${name} is not set`)
  const key = (raw.startsWith('0x') ? raw : `0x${raw}`) as Hex
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error(`${name} is not a 32-byte hex private key`)
  return privateKeyToAccount(key)
}
