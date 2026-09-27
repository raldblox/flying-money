import { describe, expect, it } from 'vitest'
import { openBackup, sealBackup, validBackupPassphrase } from '../lib/wallet-backup'

// Audit F10: a 6-digit PIN can be brute-forced offline, so the backup file is sealed again with a separate, strong
// passphrase. Older (v1, PIN-only) files can still be restored.
const dump = { 'cert:1': '{"sealedKey":{"v":1,"salt":"s","iv":"i","ct":"c"}}', 'pin-check': '{"v":1}' }

// scrypt is deliberately slow; under a busy parallel test run it needs more than the default 5 s
describe('F10: wallet backups need a strong passphrase', { timeout: 60_000 }, () => {
  it('rejects short passphrases', () => {
    expect(validBackupPassphrase('short')).toBe(false)
    expect(validBackupPassphrase('12345678901')).toBe(false)
    expect(validBackupPassphrase('correct horse battery')).toBe(true)
  })

  it('seals the whole wallet: nothing readable in the file', async () => {
    const file = await sealBackup(dump, 'correct horse battery')
    expect(file).not.toContain('cert:1')
    expect(file).not.toContain('pin-check')
    expect(JSON.parse(file)).toMatchObject({ kind: 'flying-money-wallet-backup', v: 2 })
    expect(await openBackup(file, 'correct horse battery')).toEqual(dump)
  })

  it('a wrong passphrase opens nothing', async () => {
    const file = await sealBackup(dump, 'correct horse battery')
    await expect(openBackup(file, 'wrong horse battery')).rejects.toThrow(/passphrase/i)
  })

  it('refuses to seal with a weak passphrase', async () => {
    await expect(sealBackup(dump, '123456')).rejects.toThrow(/12/)
  })

  it('still restores an older PIN-only (v1) file', async () => {
    const v1 = JSON.stringify({ kind: 'flying-money-wallet-backup', v: 1, at: 'x', data: dump })
    expect(await openBackup(v1)).toEqual(dump)
  })
})
