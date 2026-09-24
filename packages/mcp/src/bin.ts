#!/usr/bin/env node
// flying-money-mcp: stdio by default (Claude Desktop/Code, Hermes, any MCP client);
// `--http <port>` serves streamable HTTP at http://127.0.0.1:<port>/mcp (localhost only: this process can pay).
import { createServer } from 'node:http'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { configFromEnv } from './config.js'
import { createFlyingMoneyMcp } from './server.js'

const cfg = configFromEnv()
const httpAt = process.argv.indexOf('--http')

if (httpAt === -1) {
  await createFlyingMoneyMcp(cfg).connect(new StdioServerTransport())
} else {
  const port = Number(process.argv[httpAt + 1] ?? 8788)
  createServer(async (req, res) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/mcp') {
      res.writeHead(404).end()
      return
    }
    // stateless: one server + transport per request
    const server = createFlyingMoneyMcp(cfg)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on('close', () => {
      void transport.close()
      void server.close()
    })
    await server.connect(transport)
    await transport.handleRequest(req, res)
  }).listen(port, '127.0.0.1', () => console.error(`flying-money-mcp on http://127.0.0.1:${port}/mcp`))
}
