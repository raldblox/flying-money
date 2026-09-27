'use client'
import type { ChainConfig } from '@flying-money/chains'
import type { Certificate } from '@flying-money/core'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { buttonClass } from '@/components/section'
import type { Holder } from '@/lib/contacts'
import { short, usdc } from '@/lib/fmt'

/**
 * "Give your assistant a budget" (BUILD_SPEC §22.5 i): where this agent is in its setup, and the next step. The
 * agent's own key never appears here; it stays with the agent. It pays supported services, not the assistant's
 * subscription.
 */
export function AssistantSetup({
  holder,
  certs,
  chain,
  onFund,
}: {
  holder: Holder
  certs: Certificate[]
  chain: ChainConfig
  onFund: () => void
}) {
  const { address } = useAccount()
  const [copied, setCopied] = useState(false)
  const now = BigInt(Math.floor(Date.now() / 1000))
  const open = certs.filter((c) => !c.closed && c.expiresAt > now)
  const paid = certs.find((c) => c.redeemed > 0n)
  const grant = (holder.grants ?? []).find((g) => g.chain === chain.key && !g.revoked && BigInt(g.expiresAt) > now)
  const steps = [
    {
      done: Boolean(holder.address),
      t: 'Saved with its key address',
      d: holder.address ? short(holder.address) : 'Add it',
    },
    {
      done: open.length > 0,
      t: 'A service funded',
      d: open.length > 0 ? `${open.length} open budget${open.length === 1 ? '' : 's'}` : 'Fund the service it will pay',
    },
    {
      done: Boolean(grant),
      t: 'Allowed to ask you (optional)',
      d: grant ? `up to ${grant.maxPerRequest} USDC per request` : 'Lets it request budgets in your inbox',
    },
    {
      done: Boolean(paid),
      t: 'A first paid call',
      d: paid ? `${usdc(paid.redeemed)} USDC collected so far` : 'Open a budget to see the service’s own record',
    },
  ]
  const config = JSON.stringify(
    {
      mcpServers: {
        'flying-money': {
          command: 'npx',
          args: ['-y', '@flying-money/mcp'],
          env: {
            AGENT_KEY: '<the agent’s own spending key, kept with the agent>',
            AGENT_CHAINS: chain.key,
            ...(open.length ? { AGENT_CERTIFICATES: open.map((c) => c.id).join(',') } : {}),
            ...(address ? { FM_OWNER: address } : {}),
          },
        },
      },
    },
    null,
    2,
  )
  return (
    <section className="sheet p-6" aria-labelledby="setup-t">
      <h2 id="setup-t" className="font-display text-2xl font-semibold">
        Give {holder.name} a budget
      </h2>
      <p className="mt-1 max-w-2xl text-ink-2">
        It pays supported services from a budget you fund, with its own key, never your wallet. It doesn’t pay your
        assistant subscription or its model provider.
      </p>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((s, i) => (
          <li
            key={s.t}
            className={`flex items-start gap-3 rounded-md border p-3 ${s.done ? 'border-celadon bg-celadon/10' : 'border-line'}`}
          >
            <span
              aria-hidden
              className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold ${s.done ? 'bg-ink text-paper' : 'border border-ink/30 text-ink'}`}
            >
              {s.done ? '✓' : i + 1}
            </span>
            <span>
              <span className="block font-medium">
                {s.t}
                <span className="sr-only">{s.done ? ' (done)' : ' (to do)'}</span>
              </span>
              <span className="text-sm text-ink-2">{s.d}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-3">
        {open.length === 0 && (
          <button type="button" className={buttonClass('primary')} onClick={onFund}>
            Fund a service for {holder.name}
          </button>
        )}
        {open[0] && (
          <a className={buttonClass('secondary')} href={`/c/${chain.key}/${open[0].id}`}>
            Watch its budget
          </a>
        )}
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer font-medium">
          Connect it (MCP config for Claude and other assistants)
        </summary>
        <p className="mt-2 text-sm text-ink-2">
          Paste this into the assistant’s MCP settings on the machine where it runs. Put its own spending key in
          AGENT_KEY there; the key never comes to this site.
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-paper-2 p-3 font-mono text-xs">
          <code>{config}</code>
        </pre>
        <button
          type="button"
          className={`${buttonClass('secondary')} mt-2`}
          onClick={() => void navigator.clipboard.writeText(config).then(() => setCopied(true))}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </details>
    </section>
  )
}
