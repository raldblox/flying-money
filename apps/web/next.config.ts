import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { NextConfig } from 'next'

// Local dev: read the repo-root .env (git-ignored) so secrets live in one place. On Vercel, use project env vars.
const rootEnv = join(import.meta.dirname, '..', '..', '.env')
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages ship ESM from dist/; the demo runner uses Node APIs, so keep these server-external.
  serverExternalPackages: ['@flying-money/agent', '@flying-money/oracle', '@flying-money/server', 'ioredis'],
  async rewrites() {
    return [
      { source: '/.well-known/flying-money.json', destination: '/api/well-known' },
      { source: '/docs/:slug([a-z-]+)\\.md', destination: '/docs/md/:slug' },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // audit F11: HTTPS only, the camera only for this site (scanning codes), nothing else
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
          },
          // a baseline for every page; the key-holding pages add a strict nonce policy in proxy.ts
          {
            key: 'Content-Security-Policy',
            value: "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
          },
        ],
      },
    ]
  },
}
export default config
