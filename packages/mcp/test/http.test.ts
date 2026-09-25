import { request, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMcpHttpServer, refuseRequest } from '../src/http.js'

// Audit F7: the HTTP mode serves only this machine. A web page that rebinds its own domain to 127.0.0.1 still sends
// its own Host and Origin, so both are checked; an optional bearer token (FM_MCP_TOKEN) adds a second lock.
describe('F7: MCP HTTP mode refuses DNS rebinding and other origins', () => {
  const port = 8788
  it('accepts only local Host headers and local (or absent) Origins', () => {
    expect(refuseRequest({ host: `127.0.0.1:${port}` }, port)).toBeNull()
    expect(refuseRequest({ host: `localhost:${port}` }, port)).toBeNull()
    expect(refuseRequest({ host: `[::1]:${port}` }, port)).toBeNull()
    expect(refuseRequest({ host: `127.0.0.1:${port}`, origin: `http://localhost:${port}` }, port)).toBeNull()
    expect(refuseRequest({ host: `evil.example:${port}` }, port)?.status).toBe(403)
    expect(refuseRequest({ host: `127.0.0.1:9999` }, port)?.status).toBe(403)
    expect(refuseRequest({}, port)?.status).toBe(403)
    expect(refuseRequest({ host: `127.0.0.1:${port}`, origin: 'http://evil.example' }, port)?.status).toBe(403)
    expect(refuseRequest({ host: `127.0.0.1:${port}`, origin: 'null' }, port)?.status).toBe(403)
  })

  it('requires the bearer token when one is set', () => {
    const h = { host: `127.0.0.1:${port}` }
    expect(refuseRequest(h, port, 's3cret-token-value')?.status).toBe(401)
    expect(refuseRequest({ ...h, authorization: 'Bearer wrong' }, port, 's3cret-token-value')?.status).toBe(401)
    expect(refuseRequest({ ...h, authorization: 'Bearer s3cret-token-value' }, port, 's3cret-token-value')).toBeNull()
  })

  describe('over a real socket', () => {
    let server: Server
    let p = 0
    beforeAll(async () => {
      server = createMcpHttpServer({ port: 0, makeServer: (() => null) as never })
      await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
      p = (server.address() as AddressInfo).port
    })
    afterAll(() => new Promise<void>((r) => server.close(() => r())))

    // node:http, because fetch won't let a caller set Host (a rebinding browser page does send its own)
    const call = (headers: Record<string, string>, path = '/mcp') =>
      new Promise<number>((resolve, reject) => {
        const req = request(
          {
            host: '127.0.0.1',
            port: p,
            path,
            method: 'POST',
            headers: { 'content-type': 'application/json', ...headers },
          },
          (res) => {
            res.resume()
            resolve(res.statusCode ?? 0)
          },
        )
        req.on('error', reject)
        req.end('{}')
      })

    it('a rebinding page (foreign Host) and a foreign Origin get 403 before any tool runs', async () => {
      expect(await call({ host: `attacker.example:${p}` })).toBe(403)
      expect(await call({ host: `127.0.0.1:${p}`, origin: 'https://attacker.example' })).toBe(403)
    })

    it('other paths are 404', async () => {
      expect(await call({ host: `127.0.0.1:${p}` }, '/other')).toBe(404)
    })
  })
})
