import { allChains } from '@flying-money/chains'
import { NOTE_HEADER, noteTypes, OFFER_HEADER, RECEIPT_HEADER, SPEC_VERSION } from '@flying-money/core'
import { SITE } from '@/lib/site'

export const dynamic = 'force-static'

/** /.well-known/flying-money.json (§10.7): machine-readable deployments, generated from @flying-money/chains. */
export function GET() {
  const chains = allChains()
    .filter((c) => c.key !== 'anvil')
    .map((c) => ({
      key: c.key,
      chainId: String(c.chain.id),
      name: c.chain.name,
      mainnet: c.mainnet,
      status: c.flyingMoney ? 'deployed' : 'not-deployed',
      contract: c.flyingMoney ?? null,
      deployedBlock: c.deployedBlock?.toString() ?? null,
      usdc: c.usdc,
      usdcDecimals: 6,
      gasToken: c.gasToken,
      maxFaceValue: c.maxFaceValue.toString(),
      maxTotalOutstanding: c.maxTotalOutstanding.toString(),
      explorer: c.explorer,
    }))
  return Response.json(
    {
      scheme: 'flying-money',
      spec: SPEC_VERSION,
      audited: false,
      eip712: { domain: { name: 'FlyingMoney', version: '1' }, types: noteTypes, primaryType: 'Note' },
      headers: { note: NOTE_HEADER, offer: OFFER_HEADER, receipt: RECEIPT_HEADER, prefix: 'fm1.' },
      amounts: 'integer base units as decimal strings (USDC: 6 decimals)',
      chains,
      source: SITE.github,
    },
    { headers: { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=300' } },
  )
}
