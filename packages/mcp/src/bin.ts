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
const HELP = `flying-money-mcp: the Flying Money MCP server (stdio by default)

  npx -y @flying-money/mcp                       serve MCP over stdio (put this in your MCP client's settings)
  npx -y @flying-money/mcp --check               check the setup: list the tools, print fm_status, exit
  npx -y @flying-money/mcp call <tool> [json]    run one tool once and print its result (no MCP client needed)
  npx -y @flying-money/mcp --http 8788           serve streamable HTTP at http://127.0.0.1:8788/mcp

Tools: fm_status, fm_explain, fm_quote {"url"}, fm_paid_fetch {"url","method"?,"body"?,"max_price"?},
       fm_request_budget {"url","amount","days","reason"}, fm_request_status {"requestId"}
Environment: FM_OWNER (your owner's wallet address) is the only required setting.
Docs: https://useflyingmoney.vercel.app/agent.md`

if (args.includes('--help') || args.includes('-h') || args[0] === 'help') {
  console.log(HELP)
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

/** The server and a client wired together in this process: one-shot use without an MCP client. */
async function inProcess() {
  const [a, b] = InMemoryTransport.createLinkedPair()
  await createFlyingMoneyMcp(cfg).connect(a)
  const client = new Client({ name: 'flying-money-cli', version: '0' })
  await client.connect(b)
  const call = async (name: string, input: Record<string, unknown> = {}) => {
    const r = await client.callTool({ name, arguments: input })
    return { text: (r.content as Array<{ type: string; text?: string }>)[0]?.text ?? '', isError: Boolean(r.isError) }
  }
  return { client, call }
}

/**
 * Ends a one-shot run. process.exit() while fetch sockets are still closing aborts Node on Windows (a libuv assertion,
 * exit 127), so set the code and let the event loop drain; a stuck handle can't keep the process alive past 3 s.
 */
async function done(client: Client, code: number) {
  await client.close()
  process.exitCode = code
  setTimeout(() => process.exit(code), 3000).unref()
}

if (args.includes('--check')) {
  const { client, call } = await inProcess()
  const tools = (await client.listTools()).tools.map((t) => t.name)
  const status = await call('fm_status')
  const instructions = client.getInstructions()
  console.log(JSON.stringify({ ok: true, tools, fm_status: JSON.parse(status.text || '{}'), instructions }, null, 2))
  await done(client, 0)
}

// `call <tool> [json]`: the same tools for agents without MCP (any language can run this and read stdout)
if (args[0] === 'call') {
  const [, tool, raw] = args
  if (!tool) {
    console.error(HELP)
    process.exit(2)
  }
  let input: Record<string, unknown> = {}
  try {
    input = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    console.error(`flying-money-mcp: the tool input must be JSON, e.g. '{"url":"https://…"}'`)
    process.exit(2)
  }
  const { client, call } = await inProcess()
  const known = (await client.listTools()).tools.map((t) => t.name)
  if (!known.includes(tool)) {
    console.error(`flying-money-mcp: unknown tool ${tool}. Tools: ${known.join(', ')}`)
    await done(client, 2)
  } else {
    const r = await call(tool, input)
    // the result always goes to stdout (often JSON, e.g. {"error":"no_certificate",…}); the exit code says if it failed
    console.log(r.text)
    await done(client, r.isError ? 1 : 0)
  }
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
