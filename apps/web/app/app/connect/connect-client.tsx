'use client'
import Link from 'next/link'
import { useId, useState } from 'react'
import { isAddress } from 'viem'
import { useAccount } from 'wagmi'
import { buttonClass } from '@/components/section'
import { agentInstruction } from '@/lib/agent-md'

/**
 * Connect an AI assistant (BUILD_SPEC §22.10 a): one sentence to paste to the assistant. It reads /agent.md, sets
 * itself up (it makes its own key), and asks here when it needs a budget. No wallet is needed to copy it.
 */
export function ConnectAgent() {
  const { address } = useAccount()
  const [typed, setTyped] = useState('')
  const [copied, setCopied] = useState(false)
  const inputId = useId()
  const owner = address ?? (isAddress(typed.trim()) ? typed.trim() : undefined)
  const site = typeof window === 'undefined' ? '' : window.location.origin
  const sentence = owner && site ? agentInstruction(site, owner) : undefined

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Connect an AI assistant</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-2">
        Let your assistant pay for paid services from budgets you approve. It never gets your wallet. Works with Claude,
        Cursor and other assistants that support MCP.
      </p>

      <section className="sheet mt-8 p-6" aria-labelledby="copy-t">
        <h2 id="copy-t" className="font-display text-2xl font-semibold">
          Send your assistant this
        </h2>
        {!address && (
          <div className="mt-3 max-w-xl">
            <label htmlFor={inputId} className="block font-medium">
              Your wallet address
            </label>
            <p className="text-sm text-ink-2">
              Where your assistant sends its requests. Or connect your wallet to fill it in.
            </p>
            <input
              id={inputId}
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value)
                setCopied(false)
              }}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2 font-mono text-sm"
            />
            {typed.trim() && !owner && (
              <p role="alert" className="mt-1 text-sm text-seal">
                That isn’t a wallet address (0x followed by 40 characters).
              </p>
            )}
          </div>
        )}
        {sentence ? (
          <>
            <p
              className="mt-4 rounded-md border border-line bg-paper-2 p-4 font-mono text-sm break-words"
              data-testid="agent-instruction"
            >
              {sentence}
            </p>
            <button
              type="button"
              className={`${buttonClass('primary')} mt-3`}
              onClick={() => void navigator.clipboard.writeText(sentence).then(() => setCopied(true))}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <span aria-live="polite" className="sr-only">
              {copied ? 'Copied to the clipboard' : ''}
            </span>
          </>
        ) : (
          <p className="mt-4 text-ink-2">Add your wallet address to get the message.</p>
        )}
      </section>

      <section className="mt-8" aria-labelledby="next-t">
        <h2 id="next-t" className="font-display text-2xl font-semibold">
          What happens next
        </h2>
        <ol className="mt-3 grid max-w-2xl gap-3">
          {[
            [
              'Your assistant sets itself up',
              'It adds Flying Money to its tools and makes its own spending key. If it can’t change its own settings, it shows you a short block to paste, once.',
            ],
            [
              'It tells you its spending address',
              'That’s all it needs from you for now. It holds no money until you give it a budget.',
            ],
            [
              'When it needs to pay for a service, it asks you',
              'You get a link to review: which service, how much, for how long. You approve it here, from your own wallet, or decline.',
            ],
          ].map(([t, d], i) => (
            <li key={t} className="flex items-start gap-3">
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-full border border-ink/30 text-sm font-semibold"
              >
                {i + 1}
              </span>
              <span>
                <span className="block font-medium">{t}</span>
                <span className="text-sm text-ink-2">{d}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-ink-2">
          Already know its spending address?{' '}
          <Link href="/app/give?for=agent" className="text-indigo underline">
            Fund it directly
          </Link>
          . Requests it sends show up in{' '}
          <Link href="/app/requests" className="text-indigo underline">
            Requests
          </Link>
          .
        </p>
      </section>
    </div>
  )
}
