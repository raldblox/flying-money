import type { MetadataRoute } from 'next'

// PWA (§12.5): installable, works offline for paying and receiving (public/sw.js), and receives slips from the phone's
// share menu (share_target opens /carry, which hands them to the right place).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Flying Money',
    short_name: 'Flying Money',
    description: 'Give a budget. Not your wallet. Payment slips that work online and offline.',
    start_url: '/wallet',
    scope: '/',
    display: 'standalone',
    background_color: '#f4ede0',
    theme_color: '#b7322c',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/brand/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'monochrome' },
    ],
    shortcuts: [
      { name: 'Wallet', url: '/wallet', description: 'Pay at a shop with a budget' },
      { name: 'Receive a slip', url: '/slip', description: 'Bring a payment slip from another device' },
      { name: 'Open a till', url: '/shop', description: 'Take budget payments at the counter' },
    ],
    // Next's manifest type predates share_target; the field is standard (W3C Web Share Target)
    ...({
      share_target: { action: '/carry', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
    } as object),
  }
}
