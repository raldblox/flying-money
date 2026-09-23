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
    return [{ source: '/.well-known/flying-money.json', destination: '/api/well-known' }]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ]
  },
}
export default config
