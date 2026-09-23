import { encodeHeader, signNote } from '@flying-money/core'
import jsQR from 'jsqr'
import { encode } from 'uqr'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'

// The till and wallet render QR codes with uqr (components/qr.tsx) and scan with jsQR (components/qr-scanner.tsx).
// Rasterise exactly what <QrCode> draws and decode it: a sealed note (~547 chars) must survive the round trip.
function roundTrip(text: string, scale = 4): string | null {
  const { data, size } = encode(text, { ecc: 'M', border: 2 })
  const px = size * scale
  const rgba = new Uint8ClampedArray(px * px * 4)
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const on = data[Math.floor(y / scale)]![Math.floor(x / scale)]
      const v = on ? 0x1b : 0xfb
      rgba.set([v, v, v, 255], (y * px + x) * 4)
    }
  return jsQR(rgba, px, px)?.data ?? null
}

describe('counter QR codes (§6.8)', () => {
  it('a sealed note fits one QR at level M and decodes back byte for byte', async () => {
    const note = await signNote(privateKeyToAccount(generatePrivateKey()), 421614, `0x${'ab'.repeat(20)}`, {
      certificateId: `0x${'cd'.repeat(32)}`,
      cumulative: 1_000_000_000_000n,
      memo: `0x${'ef'.repeat(32)}`,
    })
    const text = encodeHeader(note)
    expect(text.length).toBeGreaterThan(500)
    expect(roundTrip(text)).toBe(text)
  })

  it('a price code decodes back', () => {
    const text = `fm1.${'x'.repeat(420)}`
    expect(roundTrip(text)).toBe(text)
  })
})
