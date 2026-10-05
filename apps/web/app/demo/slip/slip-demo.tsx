'use client'
import type { ChainKey } from '@flying-money/chains'
import Link from 'next/link'
import { useState } from 'react'
import { CarrySend } from '@/components/carry/carry'
import { NetworkPicker, type PickerNetwork } from '@/components/network-picker'
import { buttonClass } from '@/components/section'
import { short } from '@/lib/fmt'

interface Slip {
  slip: string
  chain: ChainKey
  chainName: string
  certificateId: string
  issueTx: string
  price: string
}

export function SlipDemo({ chains }: { chains: PickerNetwork[] }) {
  const [chain, setChain] = useState<ChainKey>(chains[0]?.key ?? 'arbitrum-sepolia')
  const [slip, setSlip] = useState<Slip | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function get() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/demo/slip', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chain }),
      })
      const body = (await res.json()) as Slip & { error?: string }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      setSlip(body)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-8 grid gap-6">
      <ol className="grid gap-2 text-sm text-ink-2 sm:grid-cols-3">
        <li className="sheet p-3">
          <strong className="text-ink">1 · The agent pays.</strong> It sets aside 0.01 test USDC for the demo seller and
          signs a slip for it.
        </li>
        <li className="sheet p-3">
          <strong className="text-ink">2 · You carry it.</strong> QR, sound, share, link, file or text: pick one.
        </li>
        <li className="sheet p-3">
          <strong className="text-ink">3 · Spend it anywhere.</strong> The seller checks the slip on the spot and hands
          you a 飛錢 certificate.
        </li>
      </ol>

      {!slip ? (
        <section className="sheet grid gap-4 p-5" aria-label="Get a slip">
          {chains.length > 1 && (
            <NetworkPicker networks={chains} value={chain} onChange={setChain} label="Network" disabled={busy} />
          )}
          <button
            type="button"
            className={`${buttonClass('primary')} sm:w-fit`}
            onClick={() => void get()}
            disabled={busy}
          >
            {busy ? 'The agent is funding your slip…' : 'Get a slip from the agent'}
          </button>
          <p className="text-xs text-ink-2">
            One real transaction on the test network you pick (a few seconds; up to 15 on Ethereum Sepolia). Test money
            only.
          </p>
          {error && (
            <p role="alert" className="text-sm text-seal">
              {error}
            </p>
          )}
        </section>
      ) : (
        <>
          <section className="sheet grid gap-2 p-5 text-sm" aria-label="Your slip">
            <p className="font-display text-2xl font-semibold">Your slip: 0.01 USDC on {slip.chainName}</p>
            <p className="text-ink-2">
              Budget <span className="font-mono">{short(slip.certificateId)}</span>, funded by the agent in{' '}
              <a href={slip.issueTx} target="_blank" rel="noreferrer" className="text-indigo underline">
                this transaction
              </a>
              . The slip is the only payment signed for it, and it pays only the demo seller.
            </p>
          </section>
          <section className="sheet p-5" aria-label="Carry it">
            <h2 className="mb-3 font-display text-2xl font-semibold">Carry it to another device</h2>
            <CarrySend
              payload={slip.slip}
              title="Flying Money payment slip, 0.01 USDC"
              fileName="flying-money-slip.txt"
            />
            <p className="mt-4 text-sm text-ink-2">
              On the other device, open the link (or, for sound and files, open{' '}
              <Link href="/slip" className="text-indigo underline">
                /slip
              </Link>{' '}
              and pick the same carrier). Only one device here?{' '}
              <a href={`/slip#${slip.slip}`} className="text-indigo underline">
                Spend it on this one
              </a>
              .
            </p>
          </section>
          <button type="button" className="text-sm text-indigo underline sm:w-fit" onClick={() => setSlip(null)}>
            Get another slip
          </button>
        </>
      )}
    </div>
  )
}
