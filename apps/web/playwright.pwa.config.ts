import { defineConfig } from '@playwright/test'

/** Test the actual production service worker; the development server deliberately disables it. */
export default defineConfig({
  testDir: 'pwa-tests',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3201',
    ...(process.env.CI ? {} : { channel: 'chrome' }),
  },
  webServer: {
    command: 'pnpm exec next start --port 3201',
    url: 'http://localhost:3201/wallet',
    timeout: 120_000,
    reuseExistingServer: false,
  },
})
