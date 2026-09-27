'use client'
import type { ChainConfig } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import { useId, useState } from 'react'
import { parseUnits } from 'viem'
import { useAccount, useWalletClient } from 'wagmi'
import { buttonClass } from '@/components/section'
import { addGrantToHolder, type Holder, markGrantRevoked } from '@/lib/contacts'
import { createGrant, InboxSignInNeeded, revokeGrant, signInToInbox } from '@/lib/inbox-client'

const DAYS = [7, 30, 90] as const

/**
 * §21.4.3 "Create a grant for an agent": the owner signs a permission (free, no transaction) that lets this agent's
 * key send budget requests to the owner's inbox, up to an amount per request, until a date. Shown once as
 * FM_OWNER_GRANT for the agent's config; listed here with Revoke.
 */
export function AllowRequests({
  holder,
  chain,
  onChanged,
}: {
  holder: Holder
  chain: ChainConfig
  onChanged: () => void
}) {
  const { address } = useAccount()
  const { data: wallet } = useWalletClient({ chainId: chain.chain.id })
  const [max, setMax] = useState('1.00')
  const [days, setDays] = useState<(typeof DAYS)[number]>(30)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [made, setMade] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const ids = useId()
  const grants = (holder.grants ?? []).filter((g) => g.chain === chain.key)
  const now = Date.now() / 1000

  let maxUnits: bigint | null = null
  try {
    maxUnits = /^\d+(\.\d{1,6})?$/.test(max.trim()) ? parseUnits(max.trim(), 6) : null
  } catch {
    maxUnits = null
  }

  const allow = async () => {
    if (!wallet || !address || !holder.address || !maxUnits) return
    setBusy(true)
    setErr(null)
    try {
      const { value, grant } = await createGrant(wallet, chain, address, holder.address, maxUnits, days)
      await addGrantToHolder(holder.id, {
        grantId: grant.grantId,
        chain: chain.key,
        maxPerRequest: max.trim(),
        expiresAt: Number(grant.expiresAt),
      })
      setMade(`FM_OWNER=${address}\nFM_OWNER_GRANT=${value}`)
      onChanged()
    } catch (e) {
      setErr(/rejected|denied/i.test((e as Error).message) ? 'You cancelled the signature.' : (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (grantId: Hex) => {
    setErr(null)
    try {
      await revokeGrant(grantId).catch(async (e) => {
        // revoking needs the inbox session: sign in once, then retry
        if (!(e instanceof InboxSignInNeeded) || !wallet || !address) throw e
        await signInToInbox(wallet, chain, address)
        await revokeGrant(grantId)
      })
      await markGrantRevoked(holder.id, grantId)
      onChanged()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <section className="sheet p-6" aria-labelledby={`${ids}-t`}>
      <h2 id={`${ids}-t`} className="font-display text-2xl font-semibold">
        Let {holder.name} ask you for budgets
      </h2>
      <p className="mt-2 max-w-2xl text-ink-2">
        {holder.name} can then send budget requests straight to your inbox (Account → Requests). It can only ask:
        nothing moves until you fund a request from your own wallet. Signing this is free and sends no transaction.
      </p>

      {made ? (
        <div className="mt-4 rounded-md border border-celadon/60 bg-paper-2/60 p-4">
          <p className="font-semibold">Done. Add these two lines to {holder.name}’s config:</p>
          <pre className="mt-2 overflow-x-auto rounded bg-paper p-3 font-mono text-xs">
            <code>{made}</code>
          </pre>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={buttonClass('secondary')}
              onClick={() => {
                void navigator.clipboard.writeText(made).then(() => setCopied(true))
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <p className="text-xs text-ink-2">
              Shown once. It isn’t a secret key: it only lets this agent ask you, and you can revoke it below.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="grid gap-1 text-sm font-medium" htmlFor={`${ids}-max`}>
            Most per request (USDC)
            <input
              id={`${ids}-max`}
              inputMode="decimal"
              autoComplete="off"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              className="min-h-11 w-32 rounded border border-line bg-paper px-3 font-mono"
            />
          </label>
          <fieldset className="grid gap-1 text-sm font-medium">
            <legend>For</legend>
            <div className="flex gap-2">
              {DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days === d}
                  onClick={() => setDays(d)}
                  className={`min-h-11 rounded border px-3 ${days === d ? 'border-ink bg-ink text-paper' : 'border-line'}`}
                >
                  {d} days
                </button>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            className={buttonClass('primary')}
            disabled={!wallet || !holder.address || !maxUnits || maxUnits === 0n || busy}
            onClick={allow}
          >
            {busy ? 'Check your wallet…' : 'Allow requests'}
          </button>
        </div>
      )}
      {!holder.address && (
        <p className="mt-2 text-sm text-amber">Add this agent’s address first (its spending key’s address).</p>
      )}
      {err && (
        <p role="alert" className="mt-2 text-sm text-seal">
          {err}
        </p>
      )}

      {grants.length > 0 && (
        <ul className="mt-5 grid gap-2 border-t border-line pt-4">
          {grants.map((g) => {
            const state = g.revoked ? 'Revoked' : now > g.expiresAt ? 'Expired' : 'Active'
            return (
              <li key={g.grantId} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>
                  Up to <strong>{g.maxPerRequest} USDC</strong> per request · until{' '}
                  {new Date(g.expiresAt * 1000).toLocaleDateString()}{' '}
                  <span className={state === 'Active' ? 'text-celadon' : 'text-ink-2'}>· {state}</span>
                </span>
                {state === 'Active' && (
                  <button type="button" className="text-seal underline" onClick={() => void revoke(g.grantId)}>
                    Revoke
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
