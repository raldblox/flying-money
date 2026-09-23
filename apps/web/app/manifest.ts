import type { MetadataRoute } from 'next'

// PWA base (§12.5). Offline caching for /shop and /wallet arrives with Shop mode.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Flying Money',
    short_name: 'Flying Money',
    description: 'Sealed spending certificates for AI agents, people and devices.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4ede0',
    theme_color: '#b7322c',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  }
}
