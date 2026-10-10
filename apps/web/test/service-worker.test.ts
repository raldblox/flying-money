import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { expect, it, vi } from 'vitest'

type WorkerEvent = {
  data?: { type: string; page: string; assets: string[] }
  ports?: Array<{ postMessage(value: { ready: boolean }): void }>
  request?: { method: string; url: string; mode: string; headers: Headers }
  waitUntil(promise: Promise<void>): void
  respondWith?(promise: Promise<Response>): void
}
function worker() {
  const handlers: Record<string, (event: WorkerEvent) => void> = {}
  const match = vi.fn().mockResolvedValue(undefined)
  const cache = { match, put: vi.fn(), add: vi.fn() }
  const fetch = vi.fn().mockRejectedValue(new Error('offline'))
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    match,
    keys: vi.fn().mockResolvedValue(['other-app', 'fm-shell-v4']),
    delete: vi.fn(),
  }
  const self = {
    location: { origin: 'https://test.local' },
    addEventListener: (name: string, fn: (event: WorkerEvent) => void) => {
      handlers[name] = fn
    },
    clients: { claim: vi.fn() },
    skipWaiting: vi.fn(),
  }
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    self,
    caches,
    fetch,
    URL,
    Request: class extends Request {
      constructor(input: string, init?: RequestInit) {
        super(new URL(input, 'https://test.local'), init)
      }
    },
    Response,
  })
  return { handlers, caches, match, cache, fetch }
}

it('never deletes another application’s cache', async () => {
  const w = worker()
  let done!: Promise<void>
  w.handlers.activate!({
    waitUntil: (p: Promise<void>) => {
      done = p
    },
  })
  await done
  expect(w.caches.delete).not.toHaveBeenCalledWith('other-app')
})

it('rejects an incomplete installation so the previous worker can remain active', async () => {
  const w = worker()
  w.cache.add.mockRejectedValue(new Error('quota exceeded'))
  let done!: Promise<void>
  w.handlers.install!({
    waitUntil: (p) => {
      done = p
    },
  })
  await expect(done).rejects.toThrow('quota exceeded')
  expect(w.caches.delete).not.toHaveBeenCalled()
})

it('does not claim readiness when a required build asset cannot be stored', async () => {
  const w = worker()
  w.fetch.mockResolvedValue(
    new Response('<html><script src="/_next/static/app.js"></script></html>', {
      headers: { 'content-type': 'text/html' },
    }),
  )
  w.cache.add.mockRejectedValue(new Error('quota exceeded'))
  const postMessage = vi.fn()
  let done!: Promise<void>
  w.handlers.message!({
    data: { type: 'CACHE_PAGE', page: 'https://test.local/wallet', assets: [] },
    ports: [{ postMessage }],
    waitUntil: (p) => {
      done = p
    },
  })
  await done
  expect(postMessage).toHaveBeenCalledWith({ ready: false })
  expect(w.cache.put).not.toHaveBeenCalled()
})

it('never substitutes wallet HTML for an uncached destination', async () => {
  const w = worker()
  w.match.mockImplementation(async (key) => (key === '/wallet' ? new Response('<html>wallet</html>') : undefined))
  let response!: Promise<Response>
  w.handlers.fetch!({
    request: { method: 'GET', url: 'https://test.local/about', mode: 'navigate', headers: new Headers() },
    respondWith: (p: Promise<Response>) => {
      response = p
    },
    waitUntil: () => {},
  })
  expect((await response).status).toBe(503)
})

it('never serves cached HTML as a React Server Component payload', async () => {
  const w = worker()
  w.match.mockImplementation(async (key) => (typeof key === 'string' ? new Response('<html>wallet</html>') : undefined))
  let response: Promise<Response> | undefined
  w.handlers.fetch!({
    request: {
      method: 'GET',
      url: 'https://test.local/wallet?_rsc=abc',
      mode: 'cors',
      headers: new Headers({ RSC: '1' }),
    },
    respondWith: (p: Promise<Response>) => {
      response = p
    },
    waitUntil: () => {},
  })
  if (response) expect((await response).status).toBe(503)
  expect(w.match).not.toHaveBeenCalledWith('/wallet')
})
