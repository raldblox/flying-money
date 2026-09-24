'use client'
import type { ChainConfig } from '@flying-money/chains'
import {
  type Certificate,
  decodeNote,
  flyingMoneyAbi,
  type Hex,
  readCertificate,
  type SignedNote,
  sameAddress,
  verifyNoteSignature,
} from '@flying-money/core'
import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { PublicClient } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { Seal } from '@/components/seal'
import { buttonClass } from '@/components/section'
import { StatusChip } from '@/components/status-chip'
import { Tally } from '@/components/tally'
import { relTime, short, usdc } from '@/lib/fmt'
import { FunderActions } from './funder-actions'
import { TxStatus, useTx } from './tx'

type Role = 'funder' | 'payee'

async function loadCertificates(
  client: PublicClient,
  chain: ChainConfig,
  role: Role,
  who: Hex,
): Promise<Certificate[]> {
  const logs = await client.getContractEvents({
    address: chain.flyingMoney!,
    abi: flyingMoneyAbi,
    eventName: 'CertificateIssued',
    args: role === 'funder' ? { funder: who } : { payee: who },
    fromBlock: chain.deployedBlock ?? 0n,
  })
  const ids = [...new Set(logs.map((l) => l.args.id!))].reverse()
  const certs = await Promise.all(ids.map((id) => readCertificate(client, chain.flyingMoney!, id)))
  return certs.filter((c): c is Certificate => c !== null)
}

function useCertificates(chain: ChainConfig, role: Role, refreshKey: number) {
  const { address } = useAccount()
  const client = usePublicClient({ chainId: chain.chain.id })
  return useQuery({
    queryKey: ['certs', chain.key, role, address, refreshKey],
    queryFn: () => loadCertificates(client as PublicClient, chain, role, address as Hex),
    enabled: Boolean(address && client && chain.flyingMoney),
    staleTime: 15_000,
  })
}

const statusOf = (c: Certificate) =>
  c.closed ? 'closed' : BigInt(Math.floor(Date.now() / 1000)) > c.expiresAt ? 'expired' : 'open'

function Skeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
      {[0, 1].map((k) => (
        <div key={k} className="sheet h-40 animate-pulse p-6 motion-reduce:animate-none">
          <span className="sr-only">Loading certificates…</span>
        </div>
      ))}
    </div>
  )
}

function ErrorBox({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="sheet border-l-4 border-seal p-5">
      <p>Couldn’t read certificates from the chain: {(error as Error).message.split('\n')[0]}</p>
      <button type="button" onClick={retry} className={`${buttonClass('secondary')} mt-3`}>
        Try again
      </button>
    </div>
  )
}

export function IssuedList({ chain, refreshKey }: { chain: ChainConfig; refreshKey: number }) {
  const q = useCertificates(chain, 'funder', refreshKey)
  if (q.isPending) return <Skeleton />
  if (q.isError) return <ErrorBox error={q.error} retry={() => q.refetch()} />
  if (q.data.length === 0)
    return (
      <div className="sheet p-8 text-center text-ink-2">
        <p className="font-display text-2xl text-ink">No certificates yet.</p>
        <p className="mt-2">Issue one above: pick a place, a spender and a budget.</p>
      </div>
    )
  return (
    <ul className="grid gap-5 md:grid-cols-2">
      {q.data.map((c) => {
        const st = statusOf(c)
        return (
          <li key={c.id} className="sheet p-6">
            <div className="flex items-center justify-between gap-3">
              <a href={`/c/${chain.key}/${c.id}`} className="font-mono text-sm text-indigo underline">
                {short(c.id)}
              </a>
              <StatusChip kind={st}>{st[0]!.toUpperCase() + st.slice(1)}</StatusChip>
            </div>
            <p className="mt-3 font-display text-3xl font-semibold lining-nums tabular-nums">
              {c.closed ? (
                <>
                  {usdc(c.redeemed)}{' '}
                  <span className="text-base font-normal text-ink-2">
                    of {usdc(c.faceValue)} USDC spent · {usdc(c.faceValue - c.redeemed)} returned to you
                  </span>
                </>
              ) : (
                <>
                  {usdc(c.faceValue - c.redeemed)}{' '}
                  <span className="text-base font-normal text-ink-2">of {usdc(c.faceValue)} USDC left</span>
                </>
              )}
            </p>
            <div className="mt-3">
              <Tally used={c.redeemed} face={c.faceValue} />
            </div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-ink-2">Payee</dt>
              <dd className="font-mono">{short(c.payee)}</dd>
              <dt className="text-ink-2">Spender</dt>
              <dd className="font-mono">{short(c.spender)}</dd>
              <dt className="text-ink-2">Expires</dt>
              <dd>{relTime(c.expiresAt)}</dd>
            </dl>
            <FunderActions chain={chain} cert={c} onDone={() => void q.refetch()} />
          </li>
        )
      })}
    </ul>
  )
}

export function PayeeList({ chain, refreshKey }: { chain: ChainConfig; refreshKey: number }) {
  const q = useCertificates(chain, 'payee', refreshKey)
  if (q.isPending) return <Skeleton />
  if (q.isError) return <ErrorBox error={q.error} retry={() => q.refetch()} />
  if (q.data.length === 0)
    return (
      <div className="sheet p-8 text-center text-ink-2">
        <p className="font-display text-2xl text-ink">No certificates name you as the payee.</p>
        <p className="mt-2">When a funder issues a certificate to your address, it appears here.</p>
      </div>
    )
  return (
    <ul className="grid gap-5">
      {q.data.map((c) => (
        <li key={c.id}>
          <RedeemCard chain={chain} cert={c} onRedeemed={() => q.refetch()} />
        </li>
      ))}
    </ul>
  )
}

function RedeemCard({ chain, cert, onRedeemed }: { chain: ChainConfig; cert: Certificate; onRedeemed: () => void }) {
  const ids = useId()
  const publicClient = usePublicClient({ chainId: chain.chain.id })
  const { data: wallet } = useWalletClient({ chainId: chain.chain.id })
  const { address } = useAccount()
  const tx = useTx(publicClient)
  const [header, setHeader] = useState('')
  const [paid, setPaid] = useState<bigint | null>(null)
  const st = statusOf(cert)

  let note: SignedNote | null = null
  let problem: string | null = null
  if (header.trim()) {
    try {
      note = decodeNote(header.trim())
      if (note.chainId !== chain.chain.id || !sameAddress(note.contract, chain.flyingMoney!))
        problem = 'This note is for another chain or contract.'
      else if (note.certificateId.toLowerCase() !== cert.id.toLowerCase())
        problem = 'This note is for a different certificate.'
      else if (!verifyNoteSignature(note, cert.spender))
        problem = 'The signature isn’t from this certificate’s spender.'
      else if (note.cumulative > cert.faceValue) problem = 'The note is above the face value.'
      else if (note.cumulative <= cert.redeemed) problem = 'Already redeemed: this note adds nothing.'
      else if (st !== 'open') problem = `The certificate is ${st}.`
    } catch (e) {
      problem = `Not a valid payment slip: ${(e as Error).message}`
      note = null
    }
  }

  async function redeem() {
    if (!wallet || !publicClient || !note || !address) return
    const r = await tx.run(async () => {
      const { request } = await publicClient.simulateContract({
        account: address,
        address: chain.flyingMoney!,
        abi: flyingMoneyAbi,
        functionName: 'redeem',
        args: [note!.certificateId, note!.cumulative, note!.memo, note!.sig],
      })
      return wallet.writeContract({ ...request, chain: chain.chain })
    })
    if (r) {
      setPaid(note.cumulative - cert.redeemed)
      setHeader('')
      onRedeemed()
    }
  }

  return (
    <article className="sheet p-6" aria-labelledby={`${ids}-t`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={`${ids}-t`} className="font-mono text-sm">
          <a className="text-indigo underline" href={`/c/${chain.key}/${cert.id}`}>
            Certificate {short(cert.id)}
          </a>
        </h3>
        <StatusChip kind={st}>{st[0]!.toUpperCase() + st.slice(1)}</StatusChip>
      </div>
      <div className={`mt-4 ${paid !== null ? 'tally-join' : ''}`}>
        <Tally used={cert.redeemed} face={cert.faceValue} />
      </div>
      {paid !== null && (
        <p className="mt-3 flex items-center gap-3">
          <Seal size={32} animate label="Redeemed on-chain" />
          <StatusChip kind="redeemed">Redeemed {usdc(paid)} USDC</StatusChip>
        </p>
      )}
      <label htmlFor={`${ids}-note`} className="mt-5 block text-sm font-medium">
        Latest payment slip (fm1…)
      </label>
      <textarea
        id={`${ids}-note`}
        rows={3}
        value={header}
        onChange={(e) => setHeader(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        className="mt-1 block w-full rounded-[3px] border border-ink/25 bg-paper px-3 py-2 font-mono text-xs focus-visible:outline-2 focus-visible:outline-indigo"
        placeholder="Paste the note your seller server or POS stored (the highest one it served)."
        aria-invalid={Boolean(problem)}
        aria-describedby={`${ids}-note-hint`}
      />
      <p id={`${ids}-note-hint`} className={`mt-1 text-sm ${problem ? 'text-seal' : 'text-ink-2'}`}>
        {problem ??
          (note
            ? `Valid note: redeeming pays ${usdc(note.cumulative - cert.redeemed)} USDC to ${short(cert.payee)}.`
            : 'Checked in your browser: signature, amount and expiry. Anyone may press redeem; the money only ever goes to the payee.')}
      </p>
      <button
        type="button"
        className={`${buttonClass('primary')} mt-4`}
        disabled={!note || Boolean(problem) || !wallet}
        onClick={redeem}
      >
        Redeem
      </button>
      <TxStatus state={tx.state} explorer={chain.explorer} onCheck={(h) => tx.watch(h)} />
    </article>
  )
}
