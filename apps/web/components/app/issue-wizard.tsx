'use client'
import type { ChainConfig } from '@flying-money/chains'
import { flyingMoneyAbi, sameAddress } from '@flying-money/core'
import { useEffect, useId, useState } from 'react'
import { erc20Abi, formatUnits, type Hex, isAddress, parseEventLogs, parseUnits, type TransactionReceipt } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWalletClient } from 'wagmi'
import { Seal } from '@/components/seal'
import { buttonClass } from '@/components/section'
import { short, usdc } from '@/lib/fmt'
import { HandOverLink } from './hand-over'
import { RiskBanner } from './risk-banner'
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
  /** the issue transaction */
  hash: Hex
}

const DURATIONS = [
  { label: '1 day', seconds: 86_400n },
  { label: '7 days', seconds: 7n * 86_400n },
  { label: '30 days', seconds: 30n * 86_400n },
]

/**
 * A sent issue transaction waiting for its receipt (audit F5), kept in this tab's session so a slow receipt, a
 * reload or "Check status" can still finish it, including a key generated here that hasn't been handed over yet.
 * Cleared once the result screen is shown, or when the transaction reverted.
 */
interface PendingIssue {
  chain: string
  hash: Hex
  payee: Hex
  spender: Hex
  face: string
  durationIdx: number
  generated?: { key: Hex; address: Hex }
}
const PENDING_KEY = 'fm-pending-issue'
const loadPending = (): PendingIssue | null => {
  try {
    const v = sessionStorage.getItem(PENDING_KEY)
    return v ? (JSON.parse(v) as PendingIssue) : null
  } catch {
    return null
  }
}
const savePending = (p: PendingIssue | null) => {
  try {
    if (p) sessionStorage.setItem(PENDING_KEY, JSON.stringify(p))
    else sessionStorage.removeItem(PENDING_KEY)
  } catch {}
}

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
  const walletChainId = useChainId()
  const { switchChain, isPending: switching } = useSwitchChain()
  const wrongNetwork = Boolean(address) && walletChainId !== chain.chain.id
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
  // in request mode, never shorter than asked: the service may refuse a budget that ends too soon
  const durations = asked
    ? [
        ...(DURATIONS.some((d) => d.seconds === asked)
          ? []
          : [{ label: `${Number(asked / 86_400n)} days (asked)`, seconds: asked }]),
        ...DURATIONS.filter((d) => d.seconds >= asked),
      ]
    : DURATIONS
  const [amount, setAmount] = useState(preset?.amount ?? '5')
  const [durationIdx, setDurationIdx] = useState(
    asked ? durations.findIndex((d) => d.seconds === asked) : (preset?.durationIdx ?? 1),
  )
  const [issued, setIssued] = useState<{ id: Hex; hash: Hex } | null>(null)

  // Forget a generated key when leaving the page (only a sent, unfinished budget keeps it, in this tab's session).
  useEffect(() => () => setGenerated(null), [])

  function finishIssue(receipt: TransactionReceipt, p: PendingIssue) {
    const [log] = parseEventLogs({ abi: flyingMoneyAbi, logs: receipt.logs, eventName: 'CertificateIssued' })
    if (!log) return
    if (p.generated) setGenerated(p.generated)
    // the budget used the approval up
    setApprovedNow(null)
    void refetchAllowance()
    setIssued({ id: log.args.id, hash: receipt.transactionHash })
    onIssued({
      id: log.args.id,
      chain: chain.key,
      payee: p.payee,
      spender: p.spender,
      faceValue: BigInt(p.face),
      durationIdx: p.durationIdx,
      hash: receipt.transactionHash,
    })
    savePending(null)
  }
  // a budget sent before a reload (or a lost receipt): pick it up and finish it
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the chain's client is ready
  useEffect(() => {
    const p = loadPending()
    if (!p || p.chain !== chain.key || !publicClient) return
    if (p.generated) {
      setGenerated(p.generated)
      setSpenderMode('generate')
      setKeySaved(true)
    }
    void issueTx.watch(p.hash).then((r) => r && finishIssue(r, p))
  }, [publicClient, chain.key])
  // a reverted issue locked nothing: forget it
  useEffect(() => {
    if (issueTx.state.phase === 'failed' && issueTx.state.receipt) savePending(null)
  }, [issueTx.state])

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
  // say why the button is disabled: the wallet must be connected and on this network to sign
  if (!address) problems.push('Connect your wallet first.')
  else if (wrongNetwork) problems.push(`Your wallet is on another network: switch it to ${chain.chain.name}.`)
  else if (!wallet) problems.push('Waiting for your wallet… If this stays, disconnect and connect it again.')
  if (!payeeOk) problems.push('Choose who can be paid.')
  if (!spender) problems.push('Choose who can spend.')
  if (spender && address && sameAddress(spender, address))
    problems.push('The spender key can’t be your own wallet: use a separate key that holds no money.')
  if (spender && payee && sameAddress(spender, payee)) problems.push('The spender key can’t be the payee.')
  if (spenderMode === 'generate' && generated && !keySaved && !preset?.holderName)
    problems.push('Save the generated key first.')
  if (face === null || face === 0n) problems.push('Enter an amount above 0 (up to 6 decimals).')
  if (face && chain.maxFaceValue > 0n && face > chain.maxFaceValue)
    problems.push(`This deployment caps a budget at ${usdc(chain.maxFaceValue)} USDC.`)
  if (face && balance !== undefined && face > balance)
    problems.push(`Your wallet holds ${usdc(balance)} USDC on ${chain.chain.name}.`)

  // The receipt's Approval event is the truth right after an approve: a load-balanced RPC can still serve the old
  // allowance for a moment, which used to leave the form asking to approve again
  const [approvedNow, setApprovedNow] = useState<bigint | null>(null)
  const effectiveAllowance =
    allowance === undefined ? undefined : approvedNow !== null && approvedNow > allowance ? approvedNow : allowance
  const needsApproval = face !== null && effectiveAllowance !== undefined && effectiveAllowance < face
  const busy = [approveTx.state, issueTx.state].some((s) =>
    ['preparing', 'awaiting-wallet', 'submitted', 'confirming'].includes(s.phase),
  )
  // once an issue transaction is out, never offer to send another (it would lock the money twice); only a revert
  // frees the button (audit F5)
  const issueSent = Boolean(issueTx.state.hash) && !(issueTx.state.phase === 'failed' && issueTx.state.receipt)
  if (issueSent && issueTx.state.phase === 'failed')
    problems.push('Your budget was already sent. Use Check status below; don’t send it again.')

  // Gas is estimated here through the site's own RPC and handed to the wallet, so a wallet whose own RPC
  // mis-estimates (seen live: MetaMask reporting an empty "revert" for a valid approve) can still send.
  const withMargin = (g: bigint) => (g * 13n) / 10n

  async function approve() {
    if (!wallet || !publicClient || !face || !chain.flyingMoney || !address) return
    // never send a second approve: if the chain already has enough, just move on
    const current = await publicClient
      .readContract({
        address: chain.usdc,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, chain.flyingMoney],
      })
      .catch(() => undefined)
    if (current !== undefined && current >= face) {
      setApprovedNow(current)
      void refetchAllowance()
      return
    }
    const r = await approveTx.run(async () => {
      const gas = await publicClient.estimateContractGas({
        account: address,
        address: chain.usdc,
        abi: erc20Abi,
        functionName: 'approve',
        args: [chain.flyingMoney!, face!],
      })
      return wallet.writeContract({
        chain: chain.chain,
        address: chain.usdc,
        abi: erc20Abi,
        functionName: 'approve',
        args: [chain.flyingMoney!, face!],
        gas: withMargin(gas),
      })
    })
    if (r) {
      const [ev] = parseEventLogs({ abi: erc20Abi, logs: r.logs, eventName: 'Approval' })
      if (ev && sameAddress(ev.args.owner, address) && sameAddress(ev.args.spender, chain.flyingMoney))
        setApprovedNow(ev.args.value)
      void refetchAllowance()
    }
  }

  async function issue() {
    if (!wallet || !publicClient || !face || !payee || !spender || !chain.flyingMoney || !address) return
    const { timestamp } = await publicClient.getBlock()
    const expiresAt = timestamp + durations[durationIdx]!.seconds
    let pending: PendingIssue | undefined
    const receipt = await issueTx.run(async () => {
      // right after an approve, a lagging RPC node may not see it yet: give it a few seconds
      const simulate = () =>
        publicClient.simulateContract({
          account: address,
          address: chain.flyingMoney!,
          abi: flyingMoneyAbi,
          functionName: 'issue',
          args: [payee, spender, face!, expiresAt],
        })
      let sim: Awaited<ReturnType<typeof simulate>> | undefined
      for (let i = 0; !sim; i++) {
        try {
          sim = await simulate()
        } catch (e) {
          if (i >= 4 || !/allowance/i.test(String((e as Error).message))) throw e
          await new Promise((r) => setTimeout(r, 1500))
        }
      }
      const { request } = sim
      const gas = await publicClient.estimateContractGas(request)
      const hash = await wallet.writeContract({ ...request, chain: chain.chain, gas: withMargin(gas) })
      pending = {
        chain: chain.key,
        hash,
        payee,
        spender,
        face: face!.toString(),
        durationIdx,
        ...(spenderMode === 'generate' && generated ? { generated } : {}),
      }
      savePending(pending)
      return hash
    })
    if (receipt && pending) finishIssue(receipt, pending)
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
          <Seal size={72} animate label="Budget issued and sealed on-chain" />
        </div>
        <h3 className="mt-5 font-display text-3xl font-semibold">Budget created.</h3>
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
            Download the agent .env again (with the budget id)
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
            Open the budget page
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
            Create another
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
      aria-label={locked ? 'Fund the budget' : 'Issue a budget'}
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
          A budget pays exactly one place. Nobody else can ever receive its money.
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
              Paste the address of your agent’s own spending key (from its settings, e.g. its MCP config). The key
              itself never leaves the agent.
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
              {locked ? 'Amount (USDC): you can give less than asked' : 'Amount (USDC)'}
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
                ? `Cap: ${usdc(chain.maxFaceValue)} USDC per budget.`
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
        {payee && !locked && !place?.verified && (
          <div className="mt-4">
            <RiskBanner title="New payee: you haven’t verified this address">
              Only <span className="font-mono">{short(payee)}</span> can ever be paid from this budget. Scammers swap
              addresses in messages and web pages, so check it with the payee over a channel you trust. Money for a
              wrong address comes back only after the end date.
            </RiskBanner>
          </div>
        )}
        {wrongNetwork && (
          <button
            type="button"
            className={`${buttonClass('secondary')} mt-4`}
            disabled={switching}
            onClick={() => switchChain({ chainId: chain.chain.id })}
          >
            {switching ? 'Switching…' : `Switch wallet to ${chain.chain.name}`}
          </button>
        )}
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
              disabled={problems.length > 0 || busy || !wallet || issueSent}
              onClick={issue}
            >
              {locked ? 'Fund the budget' : 'Create the budget'}
            </button>
          )}
        </div>
        <TxStatus state={approveTx.state} explorer={chain.explorer} onCheck={(h) => approveTx.watch(h)} />
        <TxStatus
          state={issueTx.state}
          explorer={chain.explorer}
          onCheck={async (h) => {
            // "Check status" finishes the job too: the result screen, the hand-over link, the callback (audit F5)
            const r = await issueTx.watch(h)
            const p = loadPending()
            if (r && p && p.hash === h) finishIssue(r, p)
          }}
        />
      </section>
    </form>
  )
}
