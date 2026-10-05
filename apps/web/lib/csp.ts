/**
 * Audit F11: the pages that decrypt or use keys (wallet, till, account) get a strict, per-request nonce CSP from
 * `proxy.ts`, so an injected script can't run there. Other pages are static and carry the baseline headers from
 * next.config.ts.
 */
export const strictCspPath = (pathname: string) => /^\/(wallet|shop|app)(\/|$)/.test(pathname)

export function strictCsp(nonce: string, opts: { dev: boolean }): string {
  // 'wasm-unsafe-eval' lets WebAssembly compile (the sound carrier's decoder), never JavaScript eval
  // dev: React needs eval for error stacks, and the local chain/HMR run over plain http/ws
  const dev = opts.dev
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ''}`,
    // inline style attributes are used for layout and animation; styles can't run code
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    // chain RPCs, and shops' /.well-known files when verifying a place by domain
    `connect-src 'self' https:${dev ? ' http://127.0.0.1:* http://localhost:* ws://localhost:* ws://127.0.0.1:*' : ''}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}
