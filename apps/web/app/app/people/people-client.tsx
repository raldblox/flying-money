'use client'
import { useCallback, useEffect, useId, useState } from 'react'
import { type Hex, isAddress } from 'viem'
import { buttonClass } from '@/components/section'
import {
  defaultKeyPolicy,
  exportContacts,
  type Holder,
  type HolderType,
  importContacts,
  type KeyPolicy,
  listHolders,
  saveHolder,
} from '@/lib/contacts'
import { short } from '@/lib/fmt'

const TYPES: Array<[HolderType, string, string]> = [
  ['child', 'Child', '🧒'],
  ['person', 'Person', '🙂'],
  ['employee', 'Employee', '🧑‍🔧'],
  ['agent', 'Agent', '🤖'],
]

/** /app/people (§12.6): who spends on your behalf. Kept on this device only. */
export function People() {
  const [holders, setHolders] = useState<Holder[] | null>(null)
  const refresh = useCallback(async () => setHolders(await listHolders()), [])
  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <section aria-labelledby="holders">
        <h2 id="holders" className="font-display text-3xl font-semibold">
          People & agents
        </h2>
        {holders === null ? (
          <p className="mt-3 text-ink-2">Loading…</p>
        ) : holders.length === 0 ? (
          <p className="mt-3 text-ink-2">Nobody yet. Add a child, an employee, a friend or an agent.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {holders.map((h) => (
              <li key={h.id}>
                <a
                  href={`/app/people/${h.id}`}
                  className="sheet flex items-center justify-between gap-3 p-4 transition-transform hover:-translate-y-0.5"
                >
                  <span className="flex items-center gap-3">
                    <span aria-hidden className="text-3xl">
                      {h.emoji}
                    </span>
                    <span>
                      <span className="block font-display text-2xl font-semibold">{h.name}</span>
                      <span className="text-sm text-ink-2">
                        {TYPES.find((t) => t[0] === h.type)?.[1]} ·{' '}
                        {h.keyPolicy === 'per-certificate' ? 'fresh key per budget' : 'one key'}
                        {h.address && <span className="font-mono"> · {short(h.address)}</span>}
                      </span>
                    </span>
                  </span>
                  <span className="text-sm text-ink-2">
                    {h.certificates.length} certificate{h.certificates.length === 1 ? '' : 's'} →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="grid gap-8 self-start">
        <AddHolder onAdded={refresh} />
        <Backup onChanged={refresh} />
      </div>
    </div>
  )
}

/** Encrypted export / import of contacts (§12.6): for moving to another device. */
function Backup({ onChanged }: { onChanged: () => Promise<void> }) {
  const [pass, setPass] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const ids = useId()
  const ok = pass.length >= 8
  return (
    <details className="sheet p-5">
      <summary className="cursor-pointer font-medium">Move contacts to another device</summary>
      <p className="mt-2 text-sm text-ink-2">
        The file is encrypted with a passphrase you choose. It holds names and addresses, never keys or money.
      </p>
      <label htmlFor={`${ids}-p`} className="mt-3 block text-sm font-medium">
        Passphrase (8+ characters)
      </label>
      <input
        id={`${ids}-p`}
        type="password"
        autoComplete="new-password"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        className="mt-1 min-h-11 w-full rounded border border-line bg-paper px-3"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!ok}
          className={buttonClass('secondary')}
          onClick={async () => {
            const url = URL.createObjectURL(new Blob([await exportContacts(pass)], { type: 'application/json' }))
            const a = document.createElement('a')
            a.href = url
            a.download = 'flying-money-contacts.json'
            a.click()
            URL.revokeObjectURL(url)
            setMsg('Exported.')
          }}
        >
          Export
        </button>
        <label
          htmlFor={`${ids}-f`}
          className={`${buttonClass('secondary')} ${ok ? 'cursor-pointer' : 'pointer-events-none opacity-50'}`}
        >
          Import
        </label>
        <input
          id={`${ids}-f`}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          disabled={!ok}
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try {
              const r = await importContacts(await f.text(), pass)
              setMsg(`Imported ${r.holders} people and ${r.places} places.`)
              await onChanged()
            } catch (err) {
              setMsg((err as Error).message)
            }
          }}
        />
      </div>
      {msg && (
        <p role="status" className="mt-2 text-sm">
          {msg}
        </p>
      )}
    </details>
  )
}

function AddHolder({ onAdded }: { onAdded: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<HolderType>('child')
  const [policy, setPolicy] = useState<KeyPolicy>(defaultKeyPolicy('child'))
  const [address, setAddress] = useState('')
  const ids = useId()
  const needsAddress = type === 'agent'
  const ok = name.trim().length > 0 && (!needsAddress || isAddress(address)) && (address === '' || isAddress(address))

  return (
    <form
      className="sheet grid gap-4 p-6"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!ok) return
        await saveHolder({
          name: name.trim(),
          type,
          emoji: TYPES.find((t) => t[0] === type)![2],
          keyPolicy: policy,
          ...(isAddress(address) ? { address: address as Hex } : {}),
        })
        setName('')
        setAddress('')
        await onAdded()
      }}
    >
      <h2 className="font-display text-3xl font-semibold">Add someone</h2>
      <div className="grid gap-1">
        <label htmlFor={`${ids}-n`} className="text-sm font-medium">
          Name (only on this device)
        </label>
        <input
          id={`${ids}-n`}
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mia"
          className="min-h-11 rounded border border-line bg-paper px-3"
        />
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Who is it?</legend>
        <div className="flex flex-wrap gap-2">
          {TYPES.map(([k, label, emoji]) => (
            <button
              key={k}
              type="button"
              aria-pressed={type === k}
              onClick={() => {
                setType(k)
                setPolicy(defaultKeyPolicy(k))
              }}
              className={`min-h-11 rounded border px-3 text-sm ${type === k ? 'border-seal bg-paper-2' : 'border-ink/25'}`}
            >
              <span aria-hidden>{emoji}</span> {label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Spending keys</legend>
        {(
          [
            [
              'per-certificate',
              'A fresh key for every budget',
              'Recommended for people: different places can’t be linked to one address.',
            ],
            ['one-key', 'One key for all their budgets', 'Simpler; the default for agents and employees.'],
          ] as const
        ).map(([k, label, hint]) => (
          <label
            key={k}
            className="flex cursor-pointer items-start gap-3 rounded border border-line p-3 has-[:checked]:border-seal"
          >
            <input
              type="radio"
              name={`${ids}-p`}
              checked={policy === k}
              onChange={() => setPolicy(k)}
              className="mt-1 accent-[var(--seal)]"
            />
            <span>
              <span className="block font-medium">{label}</span>
              <span className="text-sm text-ink-2">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {(type === 'agent' || policy === 'one-key') && (
        <div className="grid gap-1">
          <label htmlFor={`${ids}-a`} className="text-sm font-medium">
            Spending address{' '}
            {type === 'agent' ? '(from the agent’s keygen)' : '(optional; otherwise made at hand-over)'}
          </label>
          <input
            id={`${ids}-a`}
            value={address}
            onChange={(e) => setAddress(e.target.value.trim())}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            className="min-h-11 rounded border border-line bg-paper px-3 font-mono text-sm"
          />
          {type === 'agent' && (
            <p className="text-xs text-ink-2">
              Run <span className="font-mono">npx @flying-money/client keygen --out .env</span> where the agent runs; it
              prints only the address.
            </p>
          )}
        </div>
      )}
      <button type="submit" className={buttonClass('primary')} disabled={!ok}>
        Add
      </button>
      <p className="text-xs text-ink-2">
        Names stay on this device. On the blockchain there is only a random spending address that holds nothing.
      </p>
    </form>
  )
}
