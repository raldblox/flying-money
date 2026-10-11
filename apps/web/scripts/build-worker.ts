import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

await build({
  entryPoints: [fileURLToPath(new URL('../pwa/recovery-worker.ts', import.meta.url))],
  outfile: fileURLToPath(new URL('../public/recovery-worker.js', import.meta.url)),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
})
