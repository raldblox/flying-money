import { SPEC_VERSION } from '@flying-money/core'
import { allDocs } from '@/lib/docs'
import { SITE } from '@/lib/site'
import { deployedChains } from '@/lib/wagmi'

export const dynamic = 'force-static'

/** /llms-full.txt (§10.7): every docs page as plain Markdown, plus the deployment table. Built from docs/site. */
export function GET() {
  const rows = deployedChains()
    .map(
      (c) =>
        `| ${c.chain.name} | ${c.chain.id} | ${c.flyingMoney} | ${c.usdc} | ${c.mainnet ? 'mainnet (capped)' : 'testnet'} |`,
    )
    .join('\n')
  const parts = [
    `# Flying Money: full docs (spec v${SPEC_VERSION})`,
    `Site: ${SITE.url} · Source: ${SITE.github} · Machine-readable deployments: ${SITE.url}/.well-known/flying-money.json`,
    `## Deployments\n\n| Chain | Chain id | FlyingMoney | USDC | Status |\n|---|---|---|---|---|\n${rows}`,
    ...allDocs().map((d) => `\n---\n\n<!-- ${SITE.url}/docs/${d.slug} -->\n\n${d.body.trim()}`),
  ]
  return new Response(`${parts.join('\n\n')}\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
