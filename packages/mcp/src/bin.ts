#!/usr/bin/env node
// flying-money-mcp: stdio by default (Claude Desktop/Code, Hermes, any MCP client);
// `--http <port>` serves streamable HTTP at http://127.0.0.1:<port>/mcp (this machine only: this process can pay).
// It refuses foreign Host and Origin headers (DNS rebinding), and requires `Authorization: Bearer $FM_MCP_TOKEN`
// when FM_MCP_TOKEN is set.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { configFromEnv } from './config.js'
import { createMcpHttpServer } from './http.js'
import { createFlyingMoneyMcp } from './server.js'

const cfg = configFromEnv()
const httpAt = process.argv.indexOf('--http')

if (httpAt === -1) {
  await createFlyingMoneyMcp(cfg).connect(new StdioServerTransport())
} else {
  const port = Number(process.argv[httpAt + 1] ?? 8788)
  const token = process.env.FM_MCP_TOKEN?.trim() || undefined
  createMcpHttpServer({ port, ...(token ? { token } : {}), makeServer: () => createFlyingMoneyMcp(cfg) }).listen(
    port,
    '127.0.0.1',
    () =>
      console.error(
        `flying-money-mcp on http://127.0.0.1:${port}/mcp${token ? ' (bearer token required)' : ' (local Host/Origin only)'}`,
      ),
  )
}
