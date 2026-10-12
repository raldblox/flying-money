import { ImageResponse } from 'next/og'

export const alt = 'Flying Money: give a budget, not your wallet'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** The social card (Open Graph and Twitter): the promise, in the project's paper and seal colours. */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 90px',
        background: '#f4ede0',
        color: '#2a241b',
        fontFamily: 'serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, color: '#b7322c', fontSize: 30, letterSpacing: 4 }}>
        <div style={{ width: 54, height: 54, background: '#b7322c', display: 'flex' }} />
        FLYING MONEY
      </div>
      <div style={{ fontSize: 92, lineHeight: 1.05, marginTop: 36, display: 'flex', flexWrap: 'wrap' }}>
        Give a budget,&nbsp;<span style={{ color: '#b7322c' }}>not your wallet.</span>
      </div>
      <div style={{ fontSize: 34, marginTop: 36, color: '#5c5243', display: 'flex' }}>
        One seller. One spending key. An amount and an end date you choose. Agents pay, even offline.
      </div>
    </div>,
    size,
  )
}
