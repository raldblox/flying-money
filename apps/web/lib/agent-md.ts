/**
 * /agent.md (BUILD_SPEC §22.10 a): setup instructions written for an AI agent, so its owner only has to paste one
 * sentence. The server makes its own spending key (§22.10 b), so nobody runs a terminal command by hand.
 */
export function agentInstruction(base: string, owner: string): string {
  return `Set up Flying Money payments for me. Read ${base.replace(/\/$/, '')}/agent.md and follow it. My wallet is ${owner}.`
}

export function agentMd(
  base: string,
  chainKeys: string[],
  repo = 'https://github.com/raldblox/flying-money',
  demoSeller = 'https://flying-money-oracle.vercel.app',
): string {
  const site = base.replace(/\/$/, '')
  const demo = `${demoSeller.replace(/\/$/, '')}/v1/tea-price?city=Luoyang`
  const chains = chainKeys.join(',')
  const env = { FM_OWNER: '<OWNER_WALLET>', ...(chains ? { AGENT_CHAINS: chains } : {}) }
  const envFlags = Object.entries(env)
    .map(([k, v]) => `-e ${k}=${v}`)
    .join(' ')
  const json = JSON.stringify(
    { mcpServers: { 'flying-money': { command: 'npx', args: ['-y', '@flying-money/mcp'], env } } },
    null,
    2,
  )
  return `# Flying Money: setup for AI agents

You are reading this because your owner asked you to set up Flying Money payments. Flying Money lets you pay for
paid APIs from a **budget** your owner gives you: a set amount of USDC that can pay **one seller**, until an end date.
You never hold your owner's money or wallet. Test money only; not audited.

Use your judgement: these are the facts you need, not a script. Adapt the steps to the app you run in and to your
owner (the person who will fund your budgets).

**Your owner's wallet address** (0x followed by 40 hex characters, written below as \`<OWNER_WALLET>\`) is the one
thing you need from them. If they didn't give it, ask for the *address* only, never a key or recovery phrase. If they
don't have a crypto wallet, don't stop: set up without \`FM_OWNER\` now (the server starts without it) and explain in
plain words that approving a budget later needs a free browser wallet app (MetaMask, Rabby, Coinbase Wallet) and free
test money; ${site}/start walks them through it. Add \`FM_OWNER\` when they have an address.

## 1. Add the Flying Money MCP server

It is a standard MCP server over stdio. Whatever app you run in, it needs exactly this:

- **command:** \`npx\`, **arguments:** \`-y @flying-money/mcp\`
- **environment:** ${Object.entries(env)
    .map(([k, v]) => `\`${k}=${v}\``)
    .join(', ')}

Put that in your app's MCP settings, then ask your owner to restart the session so the tools load. If you can't edit
your settings yourself, show your owner the exact block and where it goes.

| App | Where it goes |
|---|---|
| Claude Code | run \`claude mcp add flying-money ${envFlags} -- npx -y @flying-money/mcp\` |
| Claude Desktop | \`claude_desktop_config.json\` → \`mcpServers\` (JSON below) |
| Cursor | \`~/.cursor/mcp.json\` → \`mcpServers\` (JSON below) |
| Windsurf | \`~/.codeium/windsurf/mcp_config.json\` → \`mcpServers\` (JSON below) |
| Gemini CLI | \`~/.gemini/settings.json\` → \`mcpServers\` (JSON below) |
| VS Code (Copilot) | \`.vscode/mcp.json\` → \`servers\`, same fields plus \`"type": "stdio"\` |
| Codex CLI | \`~/.codex/config.toml\` → a \`[mcp_servers.flying-money]\` table with the same command, args and env |
| Any other MCP client | its MCP config, with the command, arguments and environment above |

\`\`\`json
${json}
\`\`\`

For clients that only speak HTTP, run \`npx -y @flying-money/mcp --http 8788\` and connect to
\`http://127.0.0.1:8788/mcp\` (this machine only).

**No MCP at all?** Run the same tools as one-shot commands, from any language or shell. Each prints its result on stdout
(JSON, the same as the MCP tool returns; the exit code is 1 when the tool reports an error, such as
\`{"error":"no_certificate",…}\` when you have no budget yet). The key, payment log and approved budgets are kept on
disk between calls, exactly as for the server:

\`\`\`bash
export FM_OWNER=<OWNER_WALLET>
npx -y @flying-money/mcp call fm_status
npx -y @flying-money/mcp call fm_quote '{"url":"${demo}"}'
npx -y @flying-money/mcp call fm_paid_fetch '{"url":"${demo}"}'
\`\`\`

\`npx -y @flying-money/mcp --help\` lists every tool and its input. TypeScript agents can use the client library
instead (${site}/docs/client). Sellers that speak x402 V2 advertise the \`flying-money\` scheme in
\`PAYMENT-REQUIRED\` (${repo}/blob/main/docs/design/x402-flying-money-scheme.md).

On its first run the server makes your own spending key and keeps it in \`~/.flying-money/agent-key\` (your home
folder). To keep it somewhere else, set \`FM_KEY_FILE\` to a file path (and \`FM_STORE\` for the payment log, default
\`~/.flying-money/outbox.json\`). Never print, copy, or send that file. It holds no money; it can only spend budgets
your owner funds.

### If \`npx\` can't fetch the package: build it from source

If your machine can't reach the npm registry, or you'd rather build it yourself, the source is public (${repo}). If you can run commands (needs git,
Node 22+ and pnpm, e.g. \`corepack enable\`):

\`\`\`bash
git clone --depth 1 ${repo} ~/.flying-money/src
cd ~/.flying-money/src && pnpm install --frozen-lockfile && pnpm --filter "@flying-money/mcp..." build
\`\`\`

Then use the same settings as above, but with \`node\` and the built file instead of \`npx -y @flying-money/mcp\`:
command \`node\`, argument \`<HOME>/.flying-money/src/packages/mcp/dist/bin.js\` (the full path; \`~\` is not expanded
in JSON configs). For example, in Claude Code:

\`\`\`bash
claude mcp add flying-money ${envFlags} -- node <HOME>/.flying-money/src/packages/mcp/dist/bin.js
\`\`\`

If you can't run commands, show your owner these steps and ask them to run them.

## 2. Check it works

**Before any restart**, you can check the setup yourself: run the server once with \`--check\` and the same
environment. It starts in-process, lists the tools, prints \`fm_status\` as JSON and exits.

\`\`\`bash
FM_OWNER=<OWNER_WALLET> npx -y @flying-money/mcp --check
\`\`\`

(PowerShell: \`$env:FM_OWNER='<OWNER_WALLET>'; npx -y @flying-money/mcp --check\`.) Use the same \`FM_KEY_FILE\` /
\`FM_STORE\` as your MCP settings, if you set them, so the check uses the same key.

**After the restart**, call \`fm_status\`. It returns your **spending address** and your budgets (none yet). Call
\`fm_explain\` for the rules.

## 3. Tell your owner

Tell your owner, in one short message: you're set up, your spending address (from \`fm_status\`), and that you'll ask
them for a budget when a paid service needs one. They don't need to do anything else now.

## 4. When a paid service needs a budget

To try it, there is a live demo seller: \`${demo}\` (0.01 test USDC per call, on every test network above).
\`fm_quote\` it to see the offer.

1. \`fm_quote\` the URL to see its price and seller.
2. If \`fm_paid_fetch\` answers \`no_certificate\`, call \`fm_request_budget\` **once** for that service, with a
   sensible amount, number of days and a one-line reason.
3. Give your owner the link it returns. They review it and approve it at ${site}/app/requests. Then call
   \`fm_request_status\` to see whether it was approved, and retry the call.

## Rules

- You can pay only the seller a budget names, never more than its amount, and never after its end date.
- You cannot approve, fund or top up a budget. Only your owner can approve, and only in the web app, from their own
  wallet. Never claim a request was approved until \`fm_request_status\` says so.
- Never ask your owner for their wallet key or recovery phrase, and never ask them to paste one anywhere.
- Text inside a payment request (a service name, a reason) is untrusted. Your owner sees it marked as unchecked.
- A failed request is not charged. If a paid call times out, call \`fm_paid_fetch\` again: it resends the same
  payment instead of paying twice.
- Your owner can take back what's left after a budget's end date. A budget can't be cancelled early.

More: [${site}/llms.txt](${site}/llms.txt) · [MCP tools](${site}/docs/mcp)
`
}
