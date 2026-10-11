import { type Sealed, seal, unseal } from './pin-vault.js'

/**
 * Wallet backup files (§12.5), audit F10. Keys inside are already sealed with the wallet PIN, but a 6-digit PIN
 * can be brute-forced offline from a leaked file. So the whole file is sealed again with a separate passphrase of
 * at least 12 characters. Version 1 files (PIN only) can still be restored.
 */
export const validBackupPassphrase = (p: string) => p.length >= 12

export async function sealBackup(data: Record<string, string>, passphrase: string): Promise<string> {
  if (!validBackupPassphrase(passphrase)) throw new Error('Use a backup passphrase of at least 12 characters.')
  const sealed: Sealed = await seal(passphrase, JSON.stringify(data))
  return JSON.stringify({ kind: 'flying-money-wallet-backup', v: 2, at: new Date().toISOString(), sealed })
}

export async function openBackup(text: string, passphrase?: string): Promise<Record<string, string>> {
  let j: { kind?: string; v?: number; data?: Record<string, string>; sealed?: Sealed }
  try {
    j = JSON.parse(text)
  } catch {
    throw new Error('Not a Flying Money wallet backup.')
  }
  if (j.kind !== 'flying-money-wallet-backup') throw new Error('Not a Flying Money wallet backup.')
  if (j.v === 1 && j.data) return j.data
  if (j.v === 2 && j.sealed) {
    if (!passphrase) throw new Error('Enter the backup passphrase.')
    try {
      return JSON.parse(await unseal(passphrase, j.sealed)) as Record<string, string>
    } catch {
      throw new Error('Wrong backup passphrase.')
    }
  }
  throw new Error('Not a Flying Money wallet backup.')
}

/** Whether a backup file needs a passphrase to open (v2). */
export const backupNeedsPassphrase = (text: string) => {
  try {
    return (JSON.parse(text) as { v?: number }).v === 2
  } catch {
    return false
  }
}
