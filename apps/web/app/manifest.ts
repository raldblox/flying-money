import type { MetadataRoute } from 'next'

// PWA (§12.5): the offline shell for /shop and /wallet is public/sw.js.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Flying Money',
    short_name: 'Flying Money',
    description: 'Give a budget. Not your wallet. Funded budgets for people and AI assistants.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4ede0',
    theme_color: '#b7322c',
    icons: [
      { src: '/brand/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'monochrome' },
    ],
    shortcuts: [
      { name: 'Wallet', url: '/wallet', description: 'Pay at a shop with a budget' },
      { name: 'Open a till', url: '/shop', description: 'Take budget payments at the counter' },
    ],
  }
}
