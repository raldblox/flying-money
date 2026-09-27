import { agentMd } from '@/lib/agent-md'
import { SITE } from '@/lib/site'
import { deployedChains } from '@/lib/wagmi'

export const dynamic = 'force-static'

/** /agent.md (BUILD_SPEC §22.10 a): setup instructions for an AI agent, pasted to it by its owner in one sentence. */
export function GET() {
  return new Response(
    agentMd(
      SITE.url,
      deployedChains().map((c) => c.key),
    ),
    { headers: { 'content-type': 'text/markdown; charset=utf-8' } },
  )
}
