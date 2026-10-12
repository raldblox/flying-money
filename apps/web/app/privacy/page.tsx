import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'What Flying Money collects (very little), what stays on your device, and what the blockchain makes public.',
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="12 October 2026">
      <section className="grid gap-3">
        <h2>The short version</h2>
        <p>
          There are no accounts and no tracking: the site has no analytics scripts and sets no advertising or tracking
          cookies (a sign-in cookie is set only if you use the budget-request inbox). Your wallet keys never leave your
          device. The blockchain is public, so payments between addresses are public.
        </p>
      </section>

      <section className="grid gap-3">
        <h2>What stays on your device</h2>
        <ul>
          <li>
            Wallet keys for budgets you receive, sealed with your PIN in this browser’s storage. We cannot read them or
            recover them.
          </li>
          <li>
            Names you give to places and people, tills you opened, your chosen network and theme, and demo progress.
          </li>
        </ul>
      </section>

      <section className="grid gap-3">
        <h2>What our servers handle</h2>
        <ul>
          <li>
            <strong>Hosting logs.</strong> Our host (Vercel) records requests, including IP addresses, for security and
            operations.
          </li>
          <li>
            <strong>Demo limits.</strong> The sponsored demos use your IP address as a short-lived key to limit use. It
            is not used to identify you.
          </li>
          <li>
            <strong>Budget requests.</strong> If you let an agent send budget requests to your inbox, the request (who
            asks, the seller, the amount, the days and the agent’s reason) is stored until it is decided or expires.
          </li>
          <li>
            <strong>The hosted bridge.</strong> Its public activity log shows the site’s hostname, amounts and
            transaction hashes. It does not publish agent addresses or request contents.
          </li>
        </ul>
      </section>

      <section className="grid gap-3">
        <h2>What is public by design</h2>
        <p>
          Anything on a blockchain, including budgets, their amounts, payers, payees and collections, is public and
          cannot be deleted. Use fresh addresses if you want separation between your activities.
        </p>
      </section>

      <section className="grid gap-3">
        <h2>Third parties</h2>
        <p>
          Hosting (Vercel), a Redis database (Upstash), and public blockchain RPC providers that see the addresses your
          browser or our servers query. A wallet app you connect has its own policy.
        </p>
      </section>

      <section className="grid gap-3">
        <h2>Contact</h2>
        <p>
          Questions or requests about this page: <a href={`${SITE.github}/issues`}>GitHub issues</a>.
        </p>
      </section>
    </LegalPage>
  )
}
