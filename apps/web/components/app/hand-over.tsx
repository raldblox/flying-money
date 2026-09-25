'use client'
import type { ChainKey } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import { useEffect, useId, useState } from 'react'
import { QrCode } from '@/components/qr'
import { handOverFragment } from '@/lib/wallet'

/**
 * "Give a certificate to someone" (§12.5 funder flow): a wallet link with the spending key in the URL fragment,
 * which browsers never send to a server. Shown once; nothing is stored.
 */
export function HandOverLink({
  chain,
  id,
  spenderKey,
  name: initialName = '',
}: {
  chain: ChainKey
  id: Hex
  spenderKey: Hex
  name?: string | undefined
}) {
  const [name, setName] = useState(initialName)
  const [show, setShow] = useState(false)
  const [origin, setOrigin] = useState('')
  const ids = useId()
  useEffect(() => setOrigin(window.location.origin), [])
  const link = `${origin}/wallet#${handOverFragment({ v: 1, chain, id, key: spenderKey, ...(name.trim() ? { name: name.trim() } : {}) })}`

  return (
    <div className="mx-auto mt-8 max-w-md rounded-md border border-line p-5 text-left">
      <h4 className="font-display text-2xl font-semibold">Give it to someone</h4>
      <p className="mt-1 text-sm text-ink-2">
        For a child, an employee or a friend: they open the link on their phone and pay at the shop with a QR code. No
        crypto wallet or fees for them. Anyone holding this link can spend the budget, so send it privately.
      </p>
      <label htmlFor={`${ids}-n`} className="mt-4 block text-sm font-medium">
        What should it be called in their wallet?
      </label>
      <input
        id={`${ids}-n`}
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        placeholder="Lantern Café"
        className="mt-1 min-h-11 w-full rounded border border-line bg-paper px-3"
      />
      {!show ? (
        <button
          type="button"
          onClick={() => setShow(true)}
          className="mt-4 min-h-11 rounded border border-ink/30 px-4 font-medium hover:bg-paper-2"
        >
          Show the hand-over link and QR
        </button>
      ) : (
        <div className="mt-4 grid gap-3">
          <div className="mx-auto w-56">
            <QrCode value={link} label="Hand-over QR code: scan it with the recipient's phone camera" />
          </div>
          <textarea
            readOnly
            value={link}
            aria-label="Hand-over link"
            onFocus={(e) => e.currentTarget.select()}
            className="h-24 w-full rounded border border-line bg-paper-2 p-2 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(link)}
            className="min-h-11 rounded border border-ink/30 px-4 font-medium hover:bg-paper-2"
          >
            Copy link
          </button>
        </div>
      )}
    </div>
  )
}
