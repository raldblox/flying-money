import { type NextRequest, NextResponse } from 'next/server'
import { strictCsp, strictCspPath } from '@/lib/csp'

/**
 * Audit F11: a fresh nonce and a strict CSP for every request to the key-holding pages (wallet, till, account).
 * Next.js applies the nonce to its own scripts because these routes render per request.
 */
export function proxy(request: NextRequest) {
  if (!strictCspPath(request.nextUrl.pathname)) return NextResponse.next()
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = strictCsp(nonce, { dev: process.env.NODE_ENV === 'development' })
  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('Content-Security-Policy', csp)
  const res = NextResponse.next({ request: { headers } })
  res.headers.set('Content-Security-Policy', csp)
  return res
}

export const config = {
  matcher: [
    {
      source: '/(wallet|shop|app)/:path*',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
