import { defineConfig } from 'vitest/config'

// Unit tests only; the Playwright browser e2e (e2e/) runs with `pnpm e2e`.
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } })
