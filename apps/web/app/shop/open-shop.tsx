'use client'
import { chainKeys, getChain } from '@flying-money/chains'
import { useEffect, useId, useState } from 'react'
import { isAddress } from 'viem'
import { useAccount } from 'wagmi'
import { WalletButton } from '@/components/app/wallet-button'
import { buttonClass } from '@/components/section'

export function OpenShop() {
  const chains = chainKeys.map(getChain).filter((c) => c.flyingMoney && c.key !== 'anvil')
  const [chainKey, setChainKey] = useState(chains.find((c) => !c.mainnet)?.key ?? chains[0]?.key)
  const [name, setName] = useState('Lantern Café')
  const [payee, setPayee] = useState('')
  const { address } = useAccount()
  const ids = useId()
  useEffect(() => {
    if (address && !payee) setPayee(address)
  }, [address, payee])

  const chain = chainKey ? getChain(chainKey) : undefined
  if (!chain) return <p className="mt-8 text-ink-2">Flying Money is not deployed on any network yet.</p>

  const ok = isAddress(payee) && name.trim().length > 0
  const q = `?name=${encodeURIComponent(name.trim())}`
  const pos = `/shop/${chain.key}/${payee}/pos${q}`
  const page = `/shop/${chain.key}/${payee}${q}`

  return (
    <form className="sheet mt-10 grid gap-6 p-6 sm:p-8" onSubmit={(e) => e.preventDefault()}>
      <div className="grid gap-1">
        <label htmlFor={`${ids}-n`} className="text-sm font-medium">
          Shop name
        </label>
        <input
          id={`${ids}-n`}
          value={name}
          maxLength={60}
          autoComplete="organization"
          onChange={(e) => setName(e.target.value)}
          className="min-h-11 rounded border border-line bg-paper px-3"
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${ids}-c`} className="text-sm font-medium">
          Network
        </label>
        <select
          id={`${ids}-c`}
          value={chain.key}
          onChange={(e) => setChainKey(e.target.value as typeof chainKey)}
          className="min-h-11 rounded border border-line bg-paper px-3"
        >
          {chains.map((c) => (
            <option key={c.key} value={c.key}>
              {c.chain.name} {c.mainnet ? '(real money)' : '(test money)'}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${ids}-p`} className="text-sm font-medium">
          Your shop’s address (where collected money goes)
        </label>
        <div className="flex flex-wrap gap-3">
          <input
            id={`${ids}-p`}
            value={payee}
            onChange={(e) => setPayee(e.target.value.trim())}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            className="min-h-11 min-w-0 flex-1 rounded border border-line bg-paper px-3 font-mono text-sm"
          />
          <WalletButton chain={chain} />
        </div>
        {payee && !isAddress(payee) && (
          <p role="alert" className="text-sm text-seal">
            That is not a valid address.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <a
          href={ok ? pos : undefined}
          aria-disabled={!ok}
          className={`${buttonClass('primary')} ${ok ? '' : 'pointer-events-none opacity-50'}`}
        >
          Open the till →
        </a>
        <a
          href={ok ? page : undefined}
          aria-disabled={!ok}
          className={`${buttonClass('secondary')} ${ok ? '' : 'pointer-events-none opacity-50'}`}
        >
          Shop page and counter QR
        </a>
      </div>
      <p className="text-sm text-ink-2">
        Bookmark the till on the device you will use at the counter, and open it once while online so it works offline
        afterwards. Nothing about your shop is stored on a server: the name lives in the link and on your device.
      </p>
    </form>
  )
}
