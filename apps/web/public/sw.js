// Flying Money offline shell. Cached pages can reopen offline; funding and collection require a connection.
// Pages: network first, cached copy when offline. Build assets (/_next/static, immutable) and images: cache first.
// Never cached: /api/* (live demo, well-known), non-GET requests, and anything cross-origin (RPC calls).
const CACHE = 'fm-shell-v5'
const SHELL = ['/wallet', '/shop', '/slip', '/carry', '/demo/counter', '/demo/slip']
// the logo, the app icons and the manifest: without them an offline page or the installed app shows blank icons
const STATIC = [
  '/icon.svg',
  '/manifest.webmanifest',
  '/brand/mark.svg',
  '/brand/mark-small.svg',
  '/brand/app-icon.svg',
  '/brand/icon-192.png',
  '/brand/icon-512.png',
  '/brand/icon-maskable-512.png',
  '/brand/apple-touch-icon.png',
]

// Cache each shell page AND the build assets it references, so it works offline even if never opened before.
async function precache() {
  const c = await caches.open(CACHE)
  await Promise.all(STATIC.map((a) => c.add(new Request(a, { cache: 'reload' }))))
  for (const path of SHELL) {
    const res = await fetch(path, { cache: 'no-store' })
    if (!res.ok) throw new Error('Offline shell is incomplete')
    await c.put(path, res.clone())
    const html = await res.text()
    const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [])]
    await Promise.all(assets.map((a) => c.match(a).then((hit) => hit || c.add(a))))
  }
}

self.addEventListener('install', (event) => {
  // Let an existing worker finish serving its open clients before replacing its cache.
  event.waitUntil(precache())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('fm-shell-') && k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

const OFFLINE_PREFIXES = ['/shop', '/wallet', '/slip', '/carry', '/demo/counter', '/demo/slip']
const offlinePage = (url) => OFFLINE_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))
const isStatic = (url, req) =>
  url.pathname.startsWith('/_next/static/') ||
  url.pathname.startsWith('/fonts/') ||
  url.pathname.startsWith('/brand/') ||
  url.pathname === '/icon.svg' ||
  url.pathname === '/manifest.webmanifest' ||
  req.destination === 'image' ||
  req.destination === 'font'

const unavailable = () =>
  new Response('This page is not saved for offline use. Reconnect and open this exact page first.', {
    status: 503,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })

const remember = async (req, res) => {
  if (res.ok) {
    try {
      await (await caches.open(CACHE)).put(req, res.clone())
    } catch {
      /* storage may be full */
    }
  }
  return res
}

// A successful reply means this exact page and the browser's loaded build assets were saved.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_PAGE' || !event.ports[0]) return
  const port = event.ports[0]
  event.waitUntil(
    (async () => {
      try {
        const page = new URL(event.data.page, self.location.origin)
        if (page.origin !== self.location.origin || !offlinePage(page)) throw new Error('Unsupported page')
        const cache = await caches.open(CACHE)
        const response = await fetch(page.href, { cache: 'reload' })
        if (!response.ok || !response.headers.get('content-type')?.includes('text/html'))
          throw new Error('Page unavailable')
        const html = await response.clone().text()
        const referenced = html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? []
        const assets = new Set([...referenced, ...(event.data.assets ?? [])])
        for (const asset of assets) {
          const url = new URL(asset, self.location.origin)
          if (url.origin !== self.location.origin || !url.pathname.startsWith('/_next/static/'))
            throw new Error('Unsupported asset')
          if (!(await cache.match(url.href))) await cache.add(url.href)
        }
        await cache.put(page.href, response)
        port.postMessage({ ready: true })
      } catch {
        port.postMessage({ ready: false })
      }
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (isStatic(url, req)) {
    const response = caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req)
      return (
        hit ||
        fetch(req)
          .then((res) => remember(req, res))
          .catch(unavailable)
      )
    })
    event.respondWith(response)
    event.waitUntil(response.then(() => undefined))
    return
  }

  // RSC requests depend on router headers. Never use an HTML fallback for them.
  if (req.mode !== 'navigate') return
  const response = fetch(req)
    .then((res) =>
      offlinePage(url) && res.headers.get('content-type')?.includes('text/html') ? remember(req, res) : res,
    )
    .catch(async () => {
      if (!offlinePage(url)) return unavailable()
      const cache = await caches.open(CACHE)
      return (await cache.match(req)) || unavailable()
    })
  event.respondWith(response)
  event.waitUntil(response.then(() => undefined))
})
