import { defineConfig } from '@playwright/test'

// Browser e2e on a private anvil (DECISIONS D19): `pnpm --filter @flying-money/web e2e`.
// The web server step starts anvil, deploys, funds anvil account #1 and writes .env.development.local first.
export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalTeardown: './e2e/teardown.ts',
  // CI installs Playwright's Chromium; locally the installed Chrome is used (no browser download)
  use: {
    baseURL: 'http://localhost:3200',
    trace: 'retain-on-failure',
    ...(process.env.CI ? {} : { channel: 'chrome' }),
  },
  webServer: {
    command: 'pnpm e2e:anvil setup && pnpm exec next dev --webpack --port 3200',
    url: 'http://localhost:3200/app',
    timeout: 240_000,
    reuseExistingServer: false,
  },
})
