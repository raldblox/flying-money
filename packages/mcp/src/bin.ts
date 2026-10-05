#!/usr/bin/env node
// flying-money-mcp: stdio by default (Claude Desktop/Code, Hermes, any MCP client);
// `--http <port>` serves streamable HTTP at http://127.0.0.1:<port>/mcp (this machine only: this process can pay).
// It refuses foreign Host and Origin headers (DNS rebinding), and requires `Authorization: Bearer $FM_MCP_TOKEN`
// when FM_MCP_TOKEN is set.
// `--check` starts the server in-process, lists its tools, calls fm_status, prints the result and exits: an agent can
// verify its setup before anyone restarts its session.
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { configFromEnv } from './config.js'
import { createMcpHttpServer } from './http.js'
import { createFlyingMoneyMcp } from './server.js'

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(`flying-money-mcp: the Flying Money MCP server (stdio by default)

  npx -y @flying-money/mcp               serve MCP over stdio (put this in your MCP client's settings)
  npx -y @flying-money/mcp --check       check the setup: list the tools, print fm_status, exit
  npx -y @flying-money/mcp --http 8788   serve streamable HTTP at http://127.0.0.1:8788/mcp

Environment: FM_OWNER (your owner's wallet address) is the only required setting.
Docs: https://useflyingmoney.vercel.app/agent.md`)
  process.exit(0)
}

let cfg: ReturnType<typeof configFromEnv>
try {
  cfg = configFromEnv()
} catch (e) {
  console.error(`flying-money-mcp: ${(e as Error).message}`)
  process.exit(1)
}
// §22.10 b: the address is public; say it on stderr so a human reading logs can see it (never the key)
if (cfg.keyCreated)
  console.error(`flying-money-mcp: made a new spending key; your spending address is ${cfg.spendingAddress}`)

if (args.includes('--check')) {
  const [a, b] = InMemoryTransport.createLinkedPair()
  await createFlyingMoneyMcp(cfg).connect(a)
  const client = new Client({ name: 'flying-money-check', version: '0' })
  await client.connect(b)
  const tools = (await client.listTools()).tools.map((t) => t.name)
  const status = await client.callTool({ name: 'fm_status', arguments: {} })
  const body = (status.content as Array<{ type: string; text?: string }>)[0]?.text ?? '{}'
  console.log(JSON.stringify({ ok: true, tools, fm_status: JSON.parse(body) }, null, 2))
  await client.close()
  process.exit(0)
}

const httpAt = args.indexOf('--http')
if (httpAt === -1) {
  await createFlyingMoneyMcp(cfg).connect(new StdioServerTransport())
} else {
  const port = Number(args[httpAt + 1] ?? 8788)
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
