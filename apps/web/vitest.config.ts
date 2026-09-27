import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests only; the Playwright browser e2e (e2e/) runs with `pnpm e2e`. Components render with the automatic JSX
// runtime (tsconfig keeps `jsx: preserve` for Next), and `@/` resolves like in the app.
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: { include: ['test/**/*.test.ts'] },
})
