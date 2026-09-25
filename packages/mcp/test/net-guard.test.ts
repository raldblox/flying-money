import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BlockedHostError, guardedFetch, isBlockedAddress } from '../src/net-guard.js'

// Audit F6: a prompt-injected agent must not be able to make the MCP server (or its payment client) read
// cloud metadata, localhost or the LAN. Checked on the literal host and again on every resolved address at connect
// time (so DNS rebinding can't slip past), and redirects are never followed.
describe('F6: the MCP network guard', () => {
  it('classifies addresses', () => {
    const blocked = [
      '0.0.0.0',
      '10.1.2.3',
      '100.64.0.1',
      '127.0.0.1',
      '127.255.255.254',
      '169.254.169.254',
      '172.16.0.1',
      '172.31.255.255',
      '192.0.0.8',
      '192.168.1.1',
      '198.18.0.1',
      '224.0.0.1',
      '255.255.255.255',
      '::',
      '::1',
      '::ffff:127.0.0.1',
      '::ffff:a9fe:a9fe', // 169.254.169.254, mapped
      '64:ff9b::a9fe:a9fe', // NAT64 of the metadata address
      'fc00::1',
      'fd12:3456::1',
      'fe80::1',
      'ff02::1',
    ]
    const open = ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '2606:4700:4700::1111', '2a00:1450::1']
    for (const a of blocked) expect(isBlockedAddress(a), a).toBe(true)
    for (const a of open) expect(isBlockedAddress(a), a).toBe(false)
  })

  it('refuses private, loopback, link-local and metadata hosts written as literals', async () => {
    const f = guardedFetch()
    for (const u of [
      'http://169.254.169.254/latest/meta-data/',
      'http://127.0.0.1:1/',
      'http://[::1]:1/',
      'http://10.0.0.1/',
      'http://[::ffff:169.254.169.254]/',
    ])
      await expect(f(u), u).rejects.toBeInstanceOf(BlockedHostError)
  })

  it('checks every resolved address at connect time (a name that resolves privately is refused)', async () => {
    const f = guardedFetch({
      lookup: (host, _o, cb) =>
        host === 'metadata.example'
          ? cb(null, [{ address: '169.254.169.254', family: 4 }])
          : cb(null, [{ address: '10.0.0.7', family: 4 }]),
    })
    await expect(f('http://metadata.example/latest')).rejects.toBeInstanceOf(BlockedHostError)
    await expect(f('https://rebind.example/')).rejects.toBeInstanceOf(BlockedHostError)
    await expect(f('http://localhost:1/')).rejects.toBeInstanceOf(BlockedHostError)
  })

  it('refuses non-http(s) schemes', async () => {
    await expect(guardedFetch()('file:///etc/passwd')).rejects.toThrow(/http/)
  })

  describe('with a local server', () => {
    let server: Server
    let port = 0
    beforeAll(async () => {
      server = createServer((req, res) => {
        if (req.url === '/hop') res.writeHead(302, { location: 'http://169.254.169.254/latest' }).end()
        else res.writeHead(200, { 'content-type': 'text/plain' }).end('hello')
      })
      await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
      port = (server.address() as AddressInfo).port
    })
    afterAll(() => new Promise<void>((r) => server.close(() => r())))

    it('is refused by default, and reachable only when explicitly allowed (FM_ALLOW_HOSTS)', async () => {
      await expect(guardedFetch()(`http://127.0.0.1:${port}/`)).rejects.toBeInstanceOf(BlockedHostError)
      const allowed = guardedFetch({ allowHosts: [`127.0.0.1:${port}`] })
      const res = await allowed(`http://127.0.0.1:${port}/`)
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('hello')
      // allowing one port doesn't open the others
      await expect(allowed('http://127.0.0.1:1/')).rejects.toBeInstanceOf(BlockedHostError)
    })

    it('never follows a redirect: the 3xx comes back as is', async () => {
      const res = await guardedFetch({ allowHosts: [`127.0.0.1:${port}`] })(`http://127.0.0.1:${port}/hop`)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('http://169.254.169.254/latest')
    })
  })
})
