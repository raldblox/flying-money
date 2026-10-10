'use client'
import type { MerchantAnswer } from '@flying-money/agent'
import { Keepsake, type KeepsakeData } from '@/components/carry/keepsake'
import type { DemoEvent } from '@/lib/demo-story'

function keepsake(body: Record<string, unknown> | null): KeepsakeData | null {
  if (body?.kind !== 'flying-money-certificate') return null
  const proverb = body.proverb as Record<string, unknown> | undefined
  if (
    typeof body.serial !== 'string' ||
    typeof body.name !== 'string' ||
    typeof body.issuedAt !== 'string' ||
    typeof body.paid !== 'string' ||
    !/^\d+$/.test(body.paid) ||
    typeof body.chainId !== 'number' ||
    typeof body.certificateId !== 'string' ||
    typeof proverb?.text !== 'string' ||
    typeof proverb.source !== 'string'
  )
    return null
  return {
    serial: body.serial,
    name: body.name,
    issuedAt: body.issuedAt,
    paid: body.paid,
    chainId: body.chainId,
    certificateId: body.certificateId,
    proverb: { text: proverb.text, source: proverb.source },
  }
}

export function Briefing({
  answers,
  done,
  stopped = false,
  network,
  statusUrl,
}: {
  answers: MerchantAnswer[]
  done?: Extract<DemoEvent, { type: 'done' }>
  stopped?: boolean
  network: string
  statusUrl?: string
}) {
  const gift = answers.find((a) => a.status >= 200 && a.status < 300 && a.body?.kind === 'flying-money-certificate')
  const souvenir = keepsake(gift?.body ?? null)
  const groups = [
    { path: '/v1/tea-price', name: 'Tea prices', source: 'Fictional game prices · strings of cash per jin', count: 8 },
    { path: '/v1/weather', name: 'Current weather', source: 'Open-Meteo · modern city coordinates', count: 4 },
    { path: '/v1/route', name: 'Caravan routes', source: 'Illustrative distances and travel times', count: 6 },
  ]
  return (
    <section className="demo-panel p-5 sm:p-7" aria-labelledby="briefing-title">
      <p className="smallcaps text-xs text-ink-2">What your agent brought back</p>
      <h2 id="briefing-title" className="mt-2 font-display text-3xl font-semibold">
        Your Silk Road briefing
      </h2>
      <p className="mt-2 text-sm text-ink-2">
        {done
          ? `${done.served} of 19 approved purchases delivered.`
          : stopped
            ? 'The run stopped. Answers already delivered are preserved below.'
            : 'Answers appear here as they arrive. Each purchase stays on the record.'}
      </p>
      {done?.bestTrade && (
        <div className="my-5 border-l-4 border-seal bg-paper-2 p-4">
          <h3 className="font-display text-2xl font-semibold">Tea-price comparison</h3>
          <p className="mt-2">
            Lowest price: <strong>{done.bestTrade.buy}</strong>. Highest price: <strong>{done.bestTrade.sell}</strong>.
          </p>
          <p className="mt-1 text-sm text-ink-2">
            A fictional price spread of {done.bestTrade.margin} strings of cash per jin. This compares tea prices only;
            it is not profit after travel costs or a weather-based recommendation.
          </p>
        </div>
      )}
      <details className="mt-5 rounded border border-line p-4">
        <summary className="cursor-pointer font-semibold">
          Explore all purchased answers · {answers.filter((a) => a.path.split('?')[0] !== '/v1/certificate').length}{' '}
          purchase results
        </summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {groups.map((g) => {
            const rows = answers.filter((a) => a.path.split('?')[0] === g.path)
            return (
              <div key={g.path} className="min-w-0 rounded border border-line bg-paper p-4">
                <h3 className="font-display text-xl font-semibold">{g.name}</h3>
                <p className="mt-1 text-xs text-ink-2">{g.source}</p>
                <ul className="mt-3 divide-y divide-line text-sm">
                  {rows.map((a) => (
                    <li key={a.path} className="py-2">
                      <Answer answer={a} />
                    </li>
                  ))}
                </ul>
                {rows.length < g.count && (
                  <p className="mt-2 text-sm text-ink-2">
                    {g.count - rows.length} {done || stopped ? 'not delivered' : 'still to arrive'}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </details>
      {souvenir && statusUrl ? (
        <details className="mt-5 rounded border border-seal p-4" open>
          <summary className="cursor-pointer font-display text-2xl font-semibold">Your purchased keepsake</summary>
          <p className="my-3 text-sm text-ink-2">
            The Oracle issued this keepsake in return for your agent’s signed payment. Save it as a souvenir of this
            run.
          </p>
          <Keepsake data={souvenir} network={network} statusUrl={statusUrl} />
        </details>
      ) : (
        <p className="mt-5 text-sm text-ink-2">
          Keepsake: {done || stopped ? 'not delivered in this run.' : 'the final item on your approved list.'}
        </p>
      )}
      <p className="mt-4 text-xs text-ink-2">
        Weather data by Open-Meteo (CC BY 4.0). Tea prices and routes are illustrative. A failed purchase is shown as
        failed, not as a delivered answer.
      </p>
    </section>
  )
}

function Answer({ answer: a }: { answer: MerchantAnswer }) {
  const b = a.body
  if (a.status < 200 || a.status >= 300 || !b)
    return (
      <p className="text-seal">
        {a.step}: unavailable{a.status ? ` (HTTP ${a.status})` : ''}. See payment details for credit or pending status.
      </p>
    )
  if (typeof b.pricePerJin === 'number')
    return (
      <p>
        <strong>{String(b.city)}</strong>
        <br />
        {b.pricePerJin} per jin · {String(b.trend)}
      </p>
    )
  if (typeof b.temperature_c === 'number')
    return (
      <p>
        <strong>{a.step.replace('asked weather @', '')}</strong>
        <br />
        {b.temperature_c}°C · wind {String(b.wind_kmh)} km/h
        <br />
        <span className="text-xs text-ink-2">Reported {String(b.time)}</span>
      </p>
    )
  if (typeof b.distanceLi === 'number')
    return (
      <p>
        <strong>
          {String(b.from)} → {String(b.to)}
        </strong>
        <br />
        {b.distanceLi} li · about {String(b.caravanDays)} days
      </p>
    )
  return <p>{a.step}: answer received.</p>
}
