import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Security',
  description: 'How to report a vulnerability in Flying Money, what is in scope, and our audit status.',
}

export default function SecurityPage() {
  return (
    <LegalPage title="Security" updated="12 October 2026" draft={false}>
      <section className="grid gap-3">
        <h2>Audit status</h2>
        <p>
          <strong>Not audited.</strong> The contract has invariant and property tests, and every mainnet deployment is
          capped in the contract (see <a href="/networks">Networks</a>). An independent audit comes before any uncapped
          launch.
        </p>
      </section>

      <section className="grid gap-3">
        <h2>Report a vulnerability</h2>
        <p>
          Please <strong>don’t open a public issue</strong>. Report it privately:{' '}
          <a href={`${SITE.github}/security/advisories/new`}>GitHub private vulnerability reporting</a>. Include what
          you found, how to reproduce it and what it could cost. We will acknowledge it and keep you updated. There is
          no paid bug bounty yet; we will credit you if you want.
        </p>
      </section>

      <section className="grid gap-3">
        <h2>In scope</h2>
        <ul>
          <li>The FlyingMoney contract and its deployments (Arc mainnet, Base mainnet, test networks).</li>
          <li>The SDKs, the MCP server, the seller middleware and the x402 bridge in the repository.</li>
          <li>This website and the hosted bridge.</li>
        </ul>
      </section>

      <section className="grid gap-3">
        <h2>What we already say plainly</h2>
        <p>
          The threat model, what is guaranteed and what is not, and the tests behind it are in{' '}
          <a href={`${SITE.github}/blob/main/docs/SECURITY.md`}>SECURITY.md</a> and on{' '}
          <a href="/guarantees">Promises and limits</a>. Never send a wallet key or recovery phrase to anyone, including
          us.
        </p>
      </section>
    </LegalPage>
  )
}
