'use client'
import type { ChainKey } from '@flying-money/chains'
import { useState } from 'react'
import { SlipView } from '@/app/slip/slip-client'
import { CarrySend } from '@/components/carry/carry'
import { Journey } from '@/components/demo/journey'
import { MoreDemos } from '@/components/demo/more-demos'
import { NetworkPicker, type PickerNetwork } from '@/components/network-picker'
import { buttonClass } from '@/components/section'
import { decodeCarried } from '@/lib/carry/codec'
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

  let note = null
  if (slip) {
    try {
      const c = decodeCarried(slip.slip)
      if (c.kind === 'note') note = c.note
    } catch {
      note = null
    }
  }

  return (
    <div className="mt-6 grid gap-5">
      <Journey steps={['Get a slip', 'Spend it', 'Your keepsake']} current={slip ? 1 : 0} />

      {!slip ? (
        <section className="demo-panel grid gap-5 p-5 sm:p-7 md:grid-cols-[1.2fr_1fr]" aria-label="Get a slip">
          <div className="grid content-start gap-4">
            <h2 className="font-display text-3xl font-semibold">Let the agent sign you a payment.</h2>
            <p className="text-ink-2">
              The agent sets aside 0.01 test USDC for a demo seller and signs a slip for it. The slip is about 150
              characters: small enough for a QR code, a sound or a text message.
            </p>
            {chains.length > 1 && (
              <NetworkPicker networks={chains} value={chain} onChange={setChain} label="Test network" disabled={busy} />
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
              One real transaction on the network you pick (a few seconds; up to 15 on Ethereum Sepolia). Test money
              only.
            </p>
            {error && (
              <p role="alert" className="text-sm text-seal">
                {error}
              </p>
            )}
          </div>
          <ol className="grid content-start gap-3 text-sm" aria-label="What happens">
            <li className="rounded-md border border-line bg-paper-2 p-3">
              <strong>1 · The agent pays.</strong> It earmarks a small budget for one seller and signs a slip over it.
            </li>
            <li className="rounded-md border border-line bg-paper-2 p-3">
              <strong>2 · You spend it.</strong> The seller checks the signature on the spot, with no internet needed.
            </li>
            <li className="rounded-md border border-line bg-paper-2 p-3">
              <strong>3 · You get a 飛錢 keepsake.</strong> The seller collects the money later, in one transaction.
            </li>
          </ol>
        </section>
      ) : (
        <>
          <div className="grid items-start gap-5 md:grid-cols-[1fr_1.1fr]">
            <section className="demo-panel grid gap-3 p-5 sm:p-6" aria-label="Your slip">
              <p className="smallcaps text-xs text-ink-2">The agent’s slip</p>
              <p className="font-display text-3xl font-semibold">0.01 USDC on {slip.chainName}</p>
              <p className="break-all rounded-md border border-line bg-paper-2 p-3 font-mono text-xs leading-relaxed">
                {slip.slip}
              </p>
              <p className="text-sm text-ink-2">
                Budget <span className="font-mono">{short(slip.certificateId)}</span>, funded in{' '}
                <a href={slip.issueTx} target="_blank" rel="noreferrer" className="text-indigo underline">
                  this transaction
                </a>
                . It pays only the demo seller, and only once.
              </p>
              <button type="button" className="text-sm text-indigo underline sm:w-fit" onClick={() => setSlip(null)}>
                Get another slip
              </button>
            </section>
            <section className="demo-panel p-5 sm:p-6" aria-label="The shop’s counter">
              {note ? (
                <SlipView note={note} payload={slip.slip} embedded />
              ) : (
                <p role="alert" className="text-sm text-seal">
                  That slip couldn’t be read. Please get another one.
                </p>
              )}
            </section>
          </div>
          <section className="demo-panel grid gap-3 p-5 sm:p-6" aria-label="Carry it">
            <h2 className="font-display text-2xl font-semibold">Optional: carry it to another device</h2>
            <p className="text-sm text-ink-2">
              A slip needs no internet to travel. Send it to a phone or laptop by QR code, sound, share, link or file,
              and spend it there instead.
            </p>
            <CarrySend
              payload={slip.slip}
              title="Flying Money payment slip, 0.01 USDC"
              fileName="flying-money-slip.txt"
            />
          </section>
        </>
      )}
      <MoreDemos current="slip" />
    </div>
  )
}
