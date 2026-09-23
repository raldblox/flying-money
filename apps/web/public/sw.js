// Flying Money offline shell for the till (/shop) and the customer wallet (/wallet) (§12.5).
// Pages: network first, cached copy when offline. Build assets (/_next/static, immutable): cache first.
// Never cached: /api/* (live demo, well-known), non-GET requests, and anything cross-origin (RPC calls).
const CACHE = 'fm-shell-v2'
const SHELL = ['/wallet', '/shop']

// Cache each shell page AND the build assets it references, so it works offline even if never opened before.
async function precache() {
  const c = await caches.open(CACHE)
  for (const path of SHELL) {
    const res = await fetch(path, { cache: 'no-store' })
    if (!res.ok) continue
    await c.put(path, res.clone())
    const html = await res.text()
    const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) ?? [])]
    await Promise.all(assets.map((a) => c.match(a).then((hit) => hit || c.add(a).catch(() => {}))))
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const offlinePage = (url) => url.pathname.startsWith('/shop') || url.pathname.startsWith('/wallet')

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  // Page loads and RSC payloads for the offline sections: network first, then the cached copy.
  if (offlinePage(url) || req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && offlinePage(url)) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() =>
          caches
            .match(req, { ignoreSearch: req.mode !== 'navigate' })
            .then((hit) => hit || caches.match(url.pathname.startsWith('/shop') ? '/shop' : '/wallet'))
            .then((hit) => hit || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } })),
        ),
    )
  }
})
