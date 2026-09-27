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

  it('is honest when the package cannot be installed yet', () => {
    expect(md).toMatch(/not found/i)
  })

  it('the copyable instruction names the page and the owner wallet', () => {
    const s = agentInstruction('https://example.test', '0x8dB423F3b8991865030BcE381F7A50EC517c7c50')
    expect(s).toBe(
      'Set up Flying Money payments for me. Read https://example.test/agent.md and follow it. My wallet is 0x8dB423F3b8991865030BcE381F7A50EC517c7c50.',
    )
  })
})
