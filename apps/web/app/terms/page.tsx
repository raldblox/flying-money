import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'Plain-language terms for Flying Money: beta, unaudited software, no custody, real-money limits.',
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="12 October 2026">
      <section className="grid gap-3">
        <h2>What this is</h2>
        <p>
          Flying Money is open-source software (a smart contract, SDKs, an MCP server, a website and demos) that lets
          one person or agent set money aside for one seller and pay it with signed slips. By using the website, the
          demos, the SDKs or any service run by the project, you agree to these terms.
        </p>
      </section>

      <section className="grid gap-3">
        <h2>It is beta software and it is not audited</h2>
        <ul>
          <li>
            The contract and the software have <strong>not been independently audited</strong>. They are tested, not
            proven.
          </li>
          <li>
            <strong>Test networks hold test money</strong> with no value. Use them to try things.
          </li>
          <li>
            <strong>Mainnets hold real money.</strong> The contract on each mainnet has caps fixed in the contract (see{' '}
            <a href="/networks">Networks</a>). Use only what you can afford to lose.
          </li>
          <li>The services may change, break or stop at any time, with no promise of uptime.</li>
        </ul>
      </section>

      <section className="grid gap-3">
        <h2>We never hold your money</h2>
        <p>
          Budgets live in a public contract with no owner, administrator, pause or upgrade. The project cannot move,
          freeze or return your funds, and cannot recover a lost key. You are responsible for your keys and recovery
          phrases. Never share a wallet key or recovery phrase with anyone, including the project.
        </p>
      </section>

      <section className="grid gap-3">
        <h2>The hosted bridge</h2>
        <p>
          The project may run a public x402 bridge as a beta. It pays other websites from its own wallet and is repaid
          from budgets that owners fund for it. It is operated without any promise of availability, charges the fees
          shown on its <a href="/bridge">status page</a>, and can refuse or stop at any time. It sees the requests and
          responses that pass through it. We are not responsible for what a third-party site returns or does.
        </p>
      </section>

      <section className="grid gap-3">
        <h2>No advice, no warranty</h2>
        <p>
          Nothing here is financial, legal or tax advice. The software is provided as is, without warranties of any
          kind, and to the extent the law allows, the project and its contributors are not liable for losses from using
          it. You are responsible for following the laws that apply to you, including those on payments, sanctions and
          taxes where you live.
        </p>
      </section>

      <section className="grid gap-3">
        <h2>Licence and contact</h2>
        <p>
          The code is released under the MIT licence: <a href={`${SITE.github}/blob/main/LICENSE`}>LICENSE</a>.
          Questions, problems or requests: <a href={`${SITE.github}/issues`}>GitHub issues</a>. For security problems,
          see <a href="/security">Security</a> and report privately.
        </p>
      </section>
    </LegalPage>
  )
}
