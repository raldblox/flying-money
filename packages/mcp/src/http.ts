import { createHash, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'

/**
 * Audit F7: the HTTP mode can pay, so it serves this machine only. Binding to 127.0.0.1 isn't enough on its own: a web
 * page can rebind its own domain to 127.0.0.1, but the browser still sends that domain as Host and the page's
 * Origin. So Host must be a local name on our port, and an Origin, when present, must be local too. An optional
 * bearer token (FM_MCP_TOKEN) is a second lock. The SDK's own DNS-rebinding protection is switched on as well.
 */
const localHosts = (port: number) => [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]
const localOrigins = (port: number) => localHosts(port).map((h) => `http://${h}`)

const digest = (s: string) => createHash('sha256').update(s).digest()

/** null = serve; otherwise the status and reason to refuse with. */
export function refuseRequest(
  headers: Pick<IncomingHttpHeaders, 'host' | 'origin' | 'authorization'>,
  port: number,
  token?: string,
): { status: 401 | 403; reason: string } | null {
  const host = headers.host?.toLowerCase()
  if (!host || !localHosts(port).includes(host)) return { status: 403, reason: 'host not allowed' }
  const origin = headers.origin
  if (origin !== undefined && !localOrigins(port).includes(origin.toLowerCase()))
    return { status: 403, reason: 'origin not allowed' }
  if (token) {
    const m = /^Bearer (.+)$/.exec(headers.authorization ?? '')
    // compare digests in constant time
    if (!m || !timingSafeEqual(digest(m[1]!), digest(token))) return { status: 401, reason: 'bearer token required' }
  }
  return null
}

export function createMcpHttpServer(opts: { port: number; token?: string; makeServer: () => McpServer }): Server {
  return createServer(async (req, res) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/mcp') {
      res.writeHead(404).end()
      return
    }
    // the port actually listened on (so `--http 0` works too)
    const port = req.socket.localPort ?? opts.port
    const refused = refuseRequest(req.headers, port, opts.token)
    if (refused) {
      res.writeHead(refused.status, { 'content-type': 'text/plain' }).end(refused.reason)
      return
    }
    // stateless: one server + transport per request
    const server = opts.makeServer()
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableDnsRebindingProtection: true,
      allowedHosts: localHosts(port),
      allowedOrigins: localOrigins(port),
    })
    res.on('close', () => {
      void transport.close()
      void server.close()
    })
    await server.connect(transport)
    await transport.handleRequest(req, res)
  })
}
