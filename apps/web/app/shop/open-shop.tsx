'use client'
import { type ChainKey, chainKeys, getChain } from '@flying-money/chains'
import { useEffect, useId, useState } from 'react'
import { isAddress } from 'viem'
import { useAccount } from 'wagmi'
import { WalletButton } from '@/components/app/wallet-button'
import { NetworkPicker } from '@/components/network-picker'
import { QrCode } from '@/components/qr'
import { buttonClass } from '@/components/section'
import { usePreferredChain } from '@/lib/chain-param'
import { short } from '@/lib/fmt'
import { toPickerNetworks } from '@/lib/networks'
import { budgetLinkForShop, forgetTill, listTills, rememberTill, type SavedTill } from '@/lib/shop-links'

const tillHref = (t: SavedTill) => `/shop/${t.chain}/${t.payee}/pos?name=${encodeURIComponent(t.name)}`
const pageHref = (t: SavedTill) => `/shop/${t.chain}/${t.payee}?name=${encodeURIComponent(t.name)}`

/**
 * Opening a till in three steps (BUILD_SPEC §22.10 e): the shop's name, where the money goes, and a ready screen.
 * The till is remembered on this device; nothing about the shop is stored on a server.
 */
export function OpenShop() {
  const chains = chainKeys.map(getChain).filter((c) => c.flyingMoney && c.key !== 'anvil')
  const [chainKey, setChainKey] = usePreferredChain(
    chains.map((c) => c.key),
    (chains.find((c) => !c.mainnet)?.key ?? chains[0]?.key ?? 'arbitrum-sepolia') as ChainKey,
  )
  const [tills, setTills] = useState<SavedTill[]>([])
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState('')
  const [payee, setPayee] = useState('')
  const { address } = useAccount()
  const ids = useId()
  useEffect(() => setTills(listTills()), [])
  useEffect(() => {
    if (address && !payee) setPayee(address)
  }, [address, payee])

  const chain = chains.length ? getChain(chainKey) : undefined
  if (!chain) return <p className="mt-8 text-ink-2">Flying Money is not deployed on any network yet.</p>

  const nameOk = name.trim().length > 0
  const payeeOk = isAddress(payee)
  const till: SavedTill = { chain: chain.key, payee, name: name.trim() }

  return (
    <div className="mt-10 grid gap-8">
      {tills.length > 0 && step !== 3 && (
        <section className="sheet p-6" aria-labelledby="your-tills">
          <h2 id="your-tills" className="font-display text-2xl font-semibold">
            Your tills
          </h2>
          <p className="text-sm text-ink-2">Opened on this device.</p>
          <ul className="mt-3 grid gap-2">
            {tills.map((t) => (
              <li
                key={`${t.chain}-${t.payee}`}
                className="flex flex-wrap items-center gap-3 rounded-md border border-line p-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t.name}</span>
                  <span className="font-mono text-xs text-ink-2">
                    {short(t.payee)} · {getChain(t.chain as ChainKey).chain.name}
                  </span>
                </span>
                <a href={tillHref(t)} className={buttonClass('primary')}>
                  Open till
                </a>
                <button
                  type="button"
                  className="min-h-10 px-2 text-sm text-indigo underline"
                  onClick={() => {
                    forgetTill(t.chain, t.payee)
                    setTills(listTills())
                  }}
                >
                  Remove<span className="sr-only"> {t.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === 3 ? (
        <Ready
          till={till}
          onAnother={() => {
            setStep(1)
            setName('')
            setTills(listTills())
          }}
        />
      ) : (
        <form
          className="sheet grid gap-6 p-6 sm:p-8"
          aria-labelledby="open-t"
          onSubmit={(e) => {
            e.preventDefault()
            if (step === 1 && nameOk) setStep(2)
            else if (step === 2 && nameOk && payeeOk) {
              rememberTill(till)
              setStep(3)
            }
          }}
        >
          <div>
            <p className="smallcaps text-sm text-seal">Step {step} of 3</p>
            <h2 id="open-t" className="font-display text-2xl font-semibold">
              {step === 1 ? 'What’s your shop called?' : 'Where should the money go?'}
            </h2>
          </div>
          {step === 1 ? (
            <div className="grid gap-1">
              <label htmlFor={`${ids}-n`} className="text-sm font-medium">
                Shop name
              </label>
              <input
                id={`${ids}-n`}
                value={name}
                maxLength={60}
                autoComplete="organization"
                placeholder="e.g. Corner Café"
                onChange={(e) => setName(e.target.value)}
                className="min-h-11 rounded border border-line bg-paper px-3"
              />
              <p className="text-sm text-ink-2">Customers see this name when they pay.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              <p className="text-ink-2">
                The wallet that receives your sales. Connect it on this device, or paste its address. You’ll need it
                again, with a little ETH for the network fee, when you collect.
              </p>
              <WalletButton chain={chain} />
              <div className="grid gap-1">
                <label htmlFor={`${ids}-p`} className="text-sm font-medium">
                  Or paste the address
                </label>
                <input
                  id={`${ids}-p`}
                  value={payee}
                  onChange={(e) => setPayee(e.target.value.trim())}
                  placeholder="0x…"
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={payee !== '' && !payeeOk}
                  className="min-h-11 rounded border border-line bg-paper px-3 font-mono text-sm"
                />
                {payee && !payeeOk && (
                  <p role="alert" className="text-sm text-seal">
                    That isn’t a wallet address (0x followed by 40 characters).
                  </p>
                )}
              </div>
              {/* the network only when there is a choice (§22.10 e) */}
              {chains.length > 1 && (
                <NetworkPicker networks={toPickerNetworks(chains)} value={chain.key} onChange={setChainKey} />
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {step === 2 && (
              <button type="button" className={buttonClass('secondary')} onClick={() => setStep(1)}>
                Back
              </button>
            )}
            <button type="submit" disabled={step === 1 ? !nameOk : !payeeOk} className={buttonClass('primary')}>
              {step === 1 ? 'Next' : 'Open my till'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function Ready({ till, onAnother }: { till: SavedTill; onAnother: () => void }) {
  const [copied, setCopied] = useState(false)
  const link = budgetLinkForShop(window.location.origin, till.chain, till.payee, till.name)
  return (
    <section className="sheet grid gap-6 p-6 sm:p-8" aria-labelledby="ready-t">
      <div>
        <p className="smallcaps text-sm text-seal">Step 3 of 3</p>
        <h2 id="ready-t" className="font-display text-3xl font-semibold">
          {till.name}’s till is ready
        </h2>
        <p className="mt-1 text-ink-2">
          It’s saved on this device under Your tills. Open it once while online, and it keeps working when the Wi‑Fi
          drops.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <a href={tillHref(till)} className={buttonClass('primary')}>
          Open the till →
        </a>
        <a href={pageHref(till)} className={buttonClass('secondary')}>
          Print the counter QR
        </a>
      </div>
      <div className="grid gap-4 border-t border-line pt-6 sm:grid-cols-[1fr_10rem]">
        <div>
          <h3 className="font-display text-xl font-semibold">Customers: get a budget for this shop</h3>
          <p className="mt-1 text-sm text-ink-2">
            Share this link or QR with regulars and their families. It opens the form to give a budget for {till.name}.
            They’ll be asked to check your address, since anyone can share a link.
          </p>
          <p className="mt-3 break-all rounded-md border border-line bg-paper-2 p-3 font-mono text-xs">{link}</p>
          <button
            type="button"
            className={`${buttonClass('secondary')} mt-3`}
            onClick={() => void navigator.clipboard.writeText(link).then(() => setCopied(true))}
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <span aria-live="polite" className="sr-only">
            {copied ? 'Link copied' : ''}
          </span>
        </div>
        <QrCode value={link} label={`Get a budget for ${till.name}`} className="w-40" />
      </div>
      <button type="button" className="justify-self-start text-sm text-indigo underline" onClick={onAnother}>
        Set up another till
      </button>
    </section>
  )
}
