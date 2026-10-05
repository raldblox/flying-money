import { describe, expect, it } from 'vitest'
import { agentInstruction, agentMd } from '@/lib/agent-md'

// BUILD_SPEC §22.10 a: one sentence connects an agent; /agent.md is written for the agent and carries §22.4 / R4.
describe('/agent.md', () => {
  const md = agentMd('https://example.test', ['arbitrum-sepolia'])

  it('walks the agent through setup without a terminal step for the human', () => {
    expect(md).toMatch(/claude mcp add flying-money/)
    for (const client of ['Claude Code', 'Claude Desktop', 'Cursor', 'Any other MCP client'])
      expect(md).toContain(client)
    expect(md).toContain('fm_status')
    expect(md).toContain('fm_request_budget')
    expect(md).not.toMatch(/keygen|AGENT_KEY=0x/)
  })

  it('carries the safety rules', () => {
    expect(md).toMatch(/never ask .*(wallet key|recovery phrase)/i)
    expect(md).toMatch(/untrusted/i)
    expect(md).toMatch(/only .*approve.* in the (web )?app/i)
    expect(md).toContain('https://example.test/app/requests')
  })

  it('offers building from the public source when npm cannot be reached', () => {
    expect(md).toMatch(/can't fetch the package/i)
    expect(md).toContain('git clone --depth 1 https://github.com/raldblox/flying-money ~/.flying-money/src')
    expect(md).toContain('packages/mcp/dist/bin.js')
  })

  it('lets the agent check its setup, try a real seller, and pay without MCP', () => {
    expect(md).toContain('npx -y @flying-money/mcp --check')
    expect(md).toContain('npx -y @flying-money/mcp call fm_paid_fetch')
    expect(md).toContain('https://flying-money-oracle.vercel.app/v1/tea-price?city=Luoyang')
    expect(md).toMatch(/FM_KEY_FILE/)
  })

  it('suggests wallets and free test money per network, from the registry, keeping the wallet the owner’s', () => {
    const all = agentMd('https://example.test', ['arbitrum-sepolia', 'tempo-testnet'])
    expect(all).toMatch(/If your owner needs a wallet or test money/)
    expect(all).toMatch(/wallet is always your owner's/)
    expect(all).toMatch(/Arbitrum Sepolia:\*\* USDC from https:\/\/faucet\.circle\.com/)
    expect(all).toMatch(/Tempo Testnet \(Moderato\):\*\* OUSD from .*; gas: none extra/)
  })

  it('the copyable instruction names the page and the owner wallet', () => {
    const s = agentInstruction('https://example.test', '0x8dB423F3b8991865030BcE381F7A50EC517c7c50')
    expect(s).toBe(
      'Set up Flying Money payments for me. Read https://example.test/agent.md and follow it. My wallet is 0x8dB423F3b8991865030BcE381F7A50EC517c7c50.',
    )
  })
})
