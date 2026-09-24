'use client'
import type { ChainConfig } from '@flying-money/chains'
import { flyingMoneyAbi, sameAddress } from '@flying-money/core'
import { useEffect, useId, useState } from 'react'
import { erc20Abi, formatUnits, type Hex, isAddress, parseEventLogs, parseUnits } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { useAccount, usePublicClient, useReadContract, useWalletClient } from 'wagmi'
import { Seal } from '@/components/seal'
import { buttonClass } from '@/components/section'
import { short, usdc } from '@/lib/fmt'
import { HandOverLink } from './hand-over'
import { TxStatus, useTx } from './tx'

export interface Place {
  name: string
  address: Hex
  verified: boolean
  /** How it was verified, e.g. "✓ Scanned" or "✓ shop.com" (§12.6). */
  badge?: string
}

/** Prefill from Contacts: Give certificate / Renew (§12.6). */
export interface IssuePreset {
  placeAddress?: Hex
  spender?: Hex
  spenderMode?: 'paste' | 'generate'
  amount?: string
  durationIdx?: number
  holderName?: string
  /** an exact lifetime asked for in a budget request (§21.4): offered first */
  durationSeconds?: bigint
  /** funding an agent's budget request (§21.4.3): payee and spender are fixed by the request */
  request?: { agent: string; placeName: string }
}

export interface IssuedInfo {
  id: Hex
  chain: ChainConfig['key']
  payee: Hex
  spender: Hex
  faceValue: bigint
  durationIdx: number
}

const DURATIONS = [
  { label: '1 day', seconds: 86_400n },
  { label: '7 days', seconds: 7n * 86_400n },
  { label: '30 days', seconds: 30n * 86_400n },
]

const field =
  'mt-1 block w-full rounded-[3px] border border-ink/25 bg-paper px-3 py-2.5 font-mono text-sm focus-visible:outline-2 focus-visible:outline-indigo'

export function IssueWizard({
  chain,
  places,
  onIssued,
  preset,
}: {
  chain: ChainConfig
  places: Place[]
  preset?: IssuePreset
  onIssued: (info: IssuedInfo) => void
}) {
  const { address } = useAccount()
  const publicClient = usePublicClient({ chainId: chain.chain.id })
  const { data: wallet } = useWalletClient({ chainId: chain.chain.id })
  const approveTx = useTx(publicClient)
  const issueTx = useTx(publicClient)
  const ids = useId()

  // Step 1: who can be paid
  const presetIdx = preset?.placeAddress ? places.findIndex((p) => sameAddress(p.address, preset.placeAddress!)) : -1
  const [placeIdx, setPlaceIdx] = useState<number | 'custom'>(
    presetIdx >= 0 ? presetIdx : preset?.placeAddress ? 'custom' : places.length ? 0 : 'custom',
  )
  const [customPayee, setCustomPayee] = useState(presetIdx < 0 && preset?.placeAddress ? preset.placeAddress : '')
  const [customConfirmed, setCustomConfirmed] = useState(false)
  // Step 2: who can spend
  const [spenderMode, setSpenderMode] = useState<'paste' | 'generate'>(preset?.spenderMode ?? 'paste')
  const [pastedSpender, setPastedSpender] = useState<string>(preset?.spender ?? '')
  const [generated, setGenerated] = useState<{ key: Hex; address: Hex } | null>(null)
  const [keySaved, setKeySaved] = useState(false)
  // Step 3: budget and time (a request's exact lifetime is offered first)
  const asked = preset?.durationSeconds
  const durations =
    asked && !DURATIONS.some((d) => d.seconds === asked)
      ? [{ label: `${Number(asked / 86_400n)} days (asked)`, seconds: asked }, ...DURATIONS]
      : DURATIONS
  const [amount, setAmount] = useState(preset?.amount ?? '5')
  const [durationIdx, setDurationIdx] = useState(
    asked ? durations.findIndex((d) => d.seconds === asked) : (preset?.durationIdx ?? 1),
  )
  const [issued, setIssued] = useState<{ id: Hex; hash: Hex } | null>(null)

  // Forget a generated key when leaving the page (it is never stored).
  useEffect(() => () => setGenerated(null), [])

  const place = placeIdx === 'custom' ? null : places[placeIdx]
  const payee = (place?.address ?? (isAddress(customPayee) ? customPayee : undefined)) as Hex | undefined
  // listed or verified places are ready; pasted or unverified ones need the "checked twice" confirmation
  const payeeOk = Boolean(payee) && (place?.verified || customConfirmed)
  const spender = (
    spenderMode === 'generate' ? generated?.address : isAddress(pastedSpender) ? pastedSpender : undefined
  ) as Hex | undefined

  let face: bigint | null = null
  try {
    face = /^\d+(\.\d{1,6})?$/.test(amount.trim()) ? parseUnits(amount.trim(), 6) : null
  } catch {
    face = null
  }

  const { data: balance } = useReadContract({
    address: chain.usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: chain.chain.id,
    query: { enabled: Boolean(address) },
  })
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: chain.usdc,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && chain.flyingMoney ? [address, chain.flyingMoney] : undefined,
    chainId: chain.chain.id,
    query: { enabled: Boolean(address) },
  })

  const problems: string[] = []
  if (!payeeOk) problems.push('Choose who can be paid.')
  if (!spender) problems.push('Choose who can spend.')
  if (spender && address && sameAddress(spender, address))
    problems.push('The spender key can’t be your own wallet: use a separate key that holds no money.')
  if (spender && payee && sameAddress(spender, payee)) problems.push('The spender key can’t be the payee.')
  if (spenderMode === 'generate' && generated && !keySaved && !preset?.holderName)
    problems.push('Save the generated key first.')
  if (face === null || face === 0n) problems.push('Enter a face value above 0 (up to 6 decimals).')
  if (face && chain.maxFaceValue > 0n && face > chain.maxFaceValue)
    problems.push(`This deployment caps a certificate at ${usdc(chain.maxFaceValue)} USDC.`)
  if (face && balance !== undefined && face > balance)
    problems.push(`Your wallet holds ${usdc(balance)} USDC on ${chain.chain.name}.`)

  const needsApproval = face !== null && allowance !== undefined && allowance < face
  const busy = [approveTx.state, issueTx.state].some((s) =>
    ['preparing', 'awaiting-wallet', 'submitted', 'confirming'].includes(s.phase),
  )

  async function approve() {
    if (!wallet || !face || !chain.flyingMoney) return
    const r = await approveTx.run(() =>
      wallet.writeContract({
        address: chain.usdc,
        abi: erc20Abi,
        functionName: 'approve',
        args: [chain.flyingMoney!, face!],
      }),
    )
    if (r) await refetchAllowance()
  }

  async function issue() {
    if (!wallet || !publicClient || !face || !payee || !spender || !chain.flyingMoney || !address) return
    const { timestamp } = await publicClient.getBlock()
    const expiresAt = timestamp + durations[durationIdx]!.seconds
    const receipt = await issueTx.run(async () => {
      const { request } = await publicClient.simulateContract({
        account: address,
        address: chain.flyingMoney!,
        abi: flyingMoneyAbi,
        functionName: 'issue',
        args: [payee, spender, face!, expiresAt],
      })
      return wallet.writeContract(request)
    })
    if (!receipt) return
    const [log] = parseEventLogs({ abi: flyingMoneyAbi, logs: receipt.logs, eventName: 'CertificateIssued' })
    if (log) {
      setIssued({ id: log.args.id, hash: receipt.transactionHash })
      onIssued({ id: log.args.id, chain: chain.key, payee, spender, faceValue: face, durationIdx })
    }
  }

  function downloadEnv(key: Hex, certificateId?: Hex) {
    const body = `# Flying Money agent key, generated in your browser. Keep it secret; it holds no money and only signs notes.\nAGENT_KEY=${key}\nAGENT_CHAIN=${chain.key}\n${certificateId ? `AGENT_CERTIFICATES=${certificateId}\n` : ''}`
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'flying-money-agent.env'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (issued && preset?.request) {
    return (
      <div className="sheet p-8 text-center">
        <div className="mx-auto w-fit">
          <Seal size={72} animate label="Budget funded on-chain" />
        </div>
        <h3 className="mt-5 font-display text-3xl font-semibold">Approved. The budget is locked.</h3>
        <p className="mx-auto mt-3 max-w-xl text-ink-2">
          {preset.request.agent} can now pay {preset.request.placeName}, up to {face ? usdc(face) : ''} USDC. It finds
          the budget on the blockchain by itself: there is nothing to send back. Whatever it doesn’t spend comes back to
          you after the end date.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a className={buttonClass('primary')} href={`/c/${chain.key}/${issued.id}`}>
            Watch the budget
          </a>
          <a
            className={buttonClass('secondary')}
            href={`${chain.explorer}/tx/${issued.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            See the transaction ↗
          </a>
        </div>
      </div>
    )
  }

  if (issued) {
    return (
      <div className="sheet p-8 text-center">
        <div className="mx-auto w-fit">
          <Seal size={72} animate label="Certificate issued and sealed on-chain" />
        </div>
        <h3 className="mt-5 font-display text-3xl font-semibold">Certificate issued.</h3>
        <p className="mt-2 font-mono text-sm break-all">{issued.id}</p>
        {preset?.holderName && generated ? (
          <p className="mt-4 text-ink-2">
            Now give it to {preset.holderName}: send the hand-over link below privately.
          </p>
        ) : (
          <>
            <p className="mt-4 text-ink-2">Add it to your agent’s config:</p>
            <pre className="mx-auto mt-2 w-fit rounded bg-paper-2 px-4 py-3 text-left font-mono text-sm">
              <code>{`certificates: ['${issued.id}']`}</code>
            </pre>
          </>
        )}
        {generated && !preset?.holderName && (
          <button
            type="button"
            className={`${buttonClass('secondary')} mt-4`}
            onClick={() => downloadEnv(generated.key, issued.id)}
          >
            Download the agent .env again (with the certificate id)
          </button>
        )}
        {generated && (
          <HandOverLink
            chain={chain.key}
            id={issued.id}
            spenderKey={generated.key}
            name={preset?.holderName ?? place?.name}
          />
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
          <a className="text-indigo underline" href={`/c/${chain.key}/${issued.id}`}>
            Open the certificate page
          </a>
          <a
            className="text-indigo underline"
            href={`${chain.explorer}/tx/${issued.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            Issue transaction ↗
          </a>
          <button
            type="button"
            className="text-indigo underline"
            onClick={() => {
              setIssued(null)
              setGenerated(null)
              setKeySaved(false)
              approveTx.reset()
              issueTx.reset()
            }}
          >
            Issue another
          </button>
        </div>
      </div>
    )
  }

  const locked = Boolean(preset?.request)
  return (
    <form
      className="grid gap-8"
      onSubmit={(e) => e.preventDefault()}
      aria-label={locked ? 'Fund the budget' : 'Issue a certificate'}
    >
      {locked && preset?.request && (
        <div className="sheet grid gap-3 p-6 sm:grid-cols-2">
          <div>
            <p className="smallcaps text-sm text-seal">Can be paid</p>
            <p className="mt-1 font-display text-2xl font-semibold">{preset.request.placeName}</p>
            <p className="font-mono text-xs text-ink-2">{payee}</p>
          </div>
          <div>
            <p className="smallcaps text-sm text-seal">Can spend</p>
            <p className="mt-1 font-display text-2xl font-semibold">{preset.request.agent}</p>
            <p className="font-mono text-xs text-ink-2">{spender}</p>
          </div>
          <p className="text-sm text-ink-2 sm:col-span-2">
            Fixed by the request: your agent only accepts a budget for its own key and this service. You can change the
            amount and the time below.
          </p>
        </div>
      )}
      <fieldset className={`sheet p-6 ${locked ? 'hidden' : ''}`}>
        <legend className="sr-only">Step 1: who can be paid?</legend>
        <p className="smallcaps text-sm text-seal">Step 1</p>
        <h3 className="font-display text-2xl font-semibold">Who can be paid?</h3>
        <p className="mt-1 text-sm text-ink-2">
          A certificate pays exactly one place. Nobody else can ever receive its money.
        </p>
        <div className="mt-4 grid gap-2">
          {places.map((p, i) => (
            <label
              key={p.address}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-line px-3 py-2 has-[:checked]:border-seal"
            >
              <input
                type="radio"
                name={`${ids}-place`}
                checked={placeIdx === i}
                onChange={() => {
                  setPlaceIdx(i)
                  setCustomConfirmed(false)
                }}
                className="accent-[var(--seal)]"
              />
              <span className="font-medium">{p.name}</span>
              <span className="font-mono text-xs text-ink-2">{short(p.address)}</span>
              {p.verified ? (
                <span className="ml-auto text-xs text-ink-2">{p.badge ?? '✓ listed'}</span>
              ) : (
                <span className="ml-auto text-xs text-amber">⚠ unverified</span>
              )}
            </label>
          ))}
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded border border-line px-3 py-2 has-[:checked]:border-seal">
            <input
              type="radio"
              name={`${ids}-place`}
              checked={placeIdx === 'custom'}
              onChange={() => setPlaceIdx('custom')}
              className="accent-[var(--seal)]"
            />
            <span className="font-medium">Paste a payee address</span>
            <span className="ml-auto text-xs text-amber">⚠ unverified</span>
          </label>
        </div>
        {place && !place.verified && (
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={customConfirmed}
              onChange={(e) => setCustomConfirmed(e.target.checked)}
              className="mt-1 accent-[var(--seal)]"
            />
            <span>
              I checked this address twice with {place.name}. Money locked for a wrong address can only be reclaimed
              after expiry.
            </span>
          </label>
        )}
        {placeIdx === 'custom' && (
          <div className="mt-3">
            <label htmlFor={`${ids}-payee`} className="text-sm font-medium">
              Payee address
            </label>
            <input
              id={`${ids}-payee`}
              className={field}
              value={customPayee}
              onChange={(e) => {
                setCustomPayee(e.target.value.trim())
                setCustomConfirmed(false)
              }}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={customPayee !== '' && !isAddress(customPayee)}
            />
            {customPayee !== '' && !isAddress(customPayee) && (
              <p className="mt-1 text-sm text-seal">That isn’t an address.</p>
            )}
            {isAddress(customPayee) && (
              <label className="mt-2 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={customConfirmed}
                  onChange={(e) => setCustomConfirmed(e.target.checked)}
                  className="mt-1 accent-[var(--seal)]"
                />
                <span>
                  I checked this address twice with the payee. Money locked for a wrong address can only be reclaimed
                  after expiry.
                </span>
              </label>
            )}
          </div>
        )}
      </fieldset>

      <fieldset className={`sheet p-6 ${locked ? 'hidden' : ''}`}>
        <legend className="sr-only">Step 2: who can spend?</legend>
        <p className="smallcaps text-sm text-seal">Step 2</p>
        <h3 className="font-display text-2xl font-semibold">Who can spend?</h3>
        <p className="mt-1 text-sm text-ink-2">
          A separate spending key: it holds no money, pays no gas, and only signs notes. It can’t be your wallet.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ['paste', 'Bring an agent address (recommended)'],
              ['generate', 'Generate a key in this browser'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={spenderMode === m}
              onClick={() => setSpenderMode(m)}
              className={`min-h-11 rounded-[3px] border px-4 text-sm font-medium ${spenderMode === m ? 'border-ink bg-ink text-paper' : 'border-ink/25 hover:border-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {spenderMode === 'paste' ? (
          <div className="mt-4">
            <p className="text-sm text-ink-2">
              Create the key where the agent runs; it prints only the address:{' '}
              <code className="rounded bg-paper-2 px-1.5 py-0.5 font-mono">
                npx @flying-money/client keygen --out .env
              </code>
            </p>
            <label htmlFor={`${ids}-spender`} className="mt-3 block text-sm font-medium">
              Agent (spender) address
            </label>
            <input
              id={`${ids}-spender`}
              className={field}
              value={pastedSpender}
              onChange={(e) => setPastedSpender(e.target.value.trim())}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={pastedSpender !== '' && !isAddress(pastedSpender)}
            />
            {pastedSpender !== '' && !isAddress(pastedSpender) && (
              <p className="mt-1 text-sm text-seal">That isn’t an address.</p>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-amber">
              Only for testing or small budgets. The key is shown once and never stored or sent anywhere.
            </p>
            {!generated ? (
              <button
                type="button"
                className={`${buttonClass('secondary')} mt-3`}
                onClick={() => {
                  const key = generatePrivateKey()
                  setGenerated({ key, address: privateKeyToAccount(key).address })
                  setKeySaved(false)
                }}
              >
                Generate a spending key
              </button>
            ) : (
              <div className="mt-3 grid gap-3">
                <p className="text-sm">
                  Address: <span className="font-mono">{generated.address}</span>
                </p>
                {preset?.holderName ? (
                  <p className="text-sm text-ink-2">
                    After issuing you get a hand-over link for {preset.holderName}. The key travels only in that link;
                    it is never stored here. If it gets lost, you reclaim the money after the end date.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className={buttonClass('secondary')}
                      onClick={() => {
                        downloadEnv(generated.key)
                        setKeySaved(true)
                      }}
                    >
                      Download the agent .env
                    </button>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={keySaved}
                        onChange={(e) => setKeySaved(e.target.checked)}
                        className="accent-[var(--seal)]"
                      />
                      I saved the key
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </fieldset>

      <fieldset className="sheet p-6">
        <legend className="sr-only">Step 3: budget and time</legend>
        <p className="smallcaps text-sm text-seal">{locked ? 'Your decision' : 'Step 3'}</p>
        <h3 className="font-display text-2xl font-semibold">
          {locked ? 'How much, and for how long' : 'Budget and time'}
        </h3>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor={`${ids}-amount`} className="text-sm font-medium">
              {locked ? 'Amount (USDC): you can give less than asked' : 'Face value (USDC)'}
            </label>
            <input
              id={`${ids}-amount`}
              className={field}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoComplete="off"
              aria-describedby={`${ids}-amount-hint`}
            />
            <p id={`${ids}-amount-hint`} className="mt-1 text-xs text-ink-2">
              {balance !== undefined ? `You hold ${usdc(balance)} USDC. ` : ''}
              {chain.maxFaceValue > 0n
                ? `Cap: ${usdc(chain.maxFaceValue)} USDC per certificate.`
                : 'No cap on this testnet.'}
            </p>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Valid for</legend>
            <div className="mt-1 flex gap-2">
              {durations.map((d, i) => (
                <button
                  key={d.label}
                  type="button"
                  aria-pressed={durationIdx === i}
                  onClick={() => setDurationIdx(i)}
                  className={`min-h-11 flex-1 rounded-[3px] border px-3 text-sm ${durationIdx === i ? 'border-ink bg-ink text-paper' : 'border-ink/25 hover:border-ink'}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-2">
              The unspent remainder returns to you after expiry. No early cancel.
            </p>
          </fieldset>
        </div>
      </fieldset>

      <section aria-labelledby={`${ids}-review`} className="sheet border-t-4 border-seal p-6">
        <h3 id={`${ids}-review`} className="font-display text-2xl font-semibold">
          Review
        </h3>
        <p className="mt-2 text-lg">
          Give <strong>{spender ? short(spender) : '…'}</strong>{' '}
          <strong>{face ? formatUnits(face, 6) : '…'} USDC</strong> at{' '}
          <strong>{place?.name ?? (payee ? short(payee) : '…')}</strong> for{' '}
          <strong>{durations[durationIdx]!.label}</strong>.
        </p>
        {problems.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-sm text-ink-2">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          {needsApproval ? (
            <button
              type="button"
              className={buttonClass('primary')}
              disabled={problems.length > 0 || busy || !wallet}
              onClick={approve}
            >
              1 · Approve {face ? formatUnits(face, 6) : ''} USDC
            </button>
          ) : (
            <button
              type="button"
              className={buttonClass('primary')}
              disabled={problems.length > 0 || busy || !wallet}
              onClick={issue}
            >
              {locked ? 'Fund the budget' : 'Issue certificate'}
            </button>
          )}
        </div>
        <TxStatus state={approveTx.state} explorer={chain.explorer} onCheck={(h) => approveTx.watch(h)} />
        <TxStatus state={issueTx.state} explorer={chain.explorer} onCheck={(h) => issueTx.watch(h)} />
      </section>
    </form>
  )
}
