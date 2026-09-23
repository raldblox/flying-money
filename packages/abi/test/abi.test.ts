import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { flyingMoneyAbi, flyingMoneyBytecode } from '../src/index.js'

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'contracts',
  'out',
  'FlyingMoney.sol',
  'FlyingMoney.json',
)

describe('@flying-money/abi', () => {
  it('exposes the §7.2 surface', () => {
    const names = flyingMoneyAbi.filter((x) => x.type === 'function').map((x) => x.name)
    for (const n of [
      'issue',
      'topUp',
      'extend',
      'reclaim',
      'redeem',
      'redeemMany',
      'getCertificate',
      'noteDigest',
      'eip712Domain',
    ])
      expect(names).toContain(n)
    const events = flyingMoneyAbi.filter((x) => x.type === 'event').map((x) => x.name)
    expect(events.sort()).toEqual(
      [
        'CertificateExtended',
        'CertificateIssued',
        'CertificateReclaimed',
        'CertificateToppedUp',
        'EIP712DomainChanged',
        'NoteRedeemed',
        'NoteSkipped',
      ].sort(),
    )
  })
  it.runIf(existsSync(out))('is up to date with contracts/out', () => {
    const built = JSON.parse(readFileSync(out, 'utf8'))
    expect(flyingMoneyAbi).toEqual(built.abi)
    expect(flyingMoneyBytecode).toBe(built.bytecode.object)
  })
})
