import { type FlyingMoneyClient, NoCertificateError, PriceTooHighError } from '@flying-money/client'

/** "The Merchant" (§13.2 mode A): a deterministic, scripted buyer planning a tea trade. About 20 paid calls. */

export interface MerchantStep {
  label: string
  path: string
}

const CITIES = ["Chang'an", 'Luoyang', 'Yangzhou', 'Dunhuang', 'Kaifeng', 'Chengdu', 'Guangzhou', 'Hangzhou']
const WEATHER: Array<[string, number, number]> = [
  ["Chang'an", 34.26, 108.94],
  ['Dunhuang', 40.14, 94.66],
  ['Yangzhou', 32.39, 119.42],
  ['Guangzhou', 23.13, 113.26],
]
const ROUTES: Array<[string, string]> = [
  ["Chang'an", 'Dunhuang'],
  ["Chang'an", 'Yangzhou'],
  ['Luoyang', 'Kaifeng'],
  ['Chengdu', "Chang'an"],
  ['Hangzhou', 'Yangzhou'],
  ['Guangzhou', 'Hangzhou'],
]

export function merchantPlan(): MerchantStep[] {
  const q = encodeURIComponent
  return [
    ...CITIES.map((c) => ({ label: `asked tea price @${c}`, path: `/v1/tea-price?city=${q(c)}` })),
    ...WEATHER.map(([c, lat, lon]) => ({ label: `asked weather @${c}`, path: `/v1/weather?lat=${lat}&lon=${lon}` })),
    ...ROUTES.map(([a, b]) => ({ label: `asked route ${a} → ${b}`, path: `/v1/route?from=${q(a)}&to=${q(b)}` })),
    { label: 'asked for a proverb', path: '/v1/proverb' },
    { label: 'asked for another proverb', path: '/v1/proverb' },
  ]
}

export interface MerchantResult {
  calls: number
  served: number
  failed: number
  stoppedReason?: string
  bestTrade?: { buy: string; sell: string; buyPrice: number; sellPrice: number; margin: number; caravanDays?: number }
  answers: Array<{ step: string; status: number; body: unknown }>
}

export type MerchantLog = (line: string) => void | Promise<void>

export async function runMerchant(opts: {
  fm: FlyingMoneyClient
  oracleUrl: string
  log?: MerchantLog
  steps?: MerchantStep[]
}): Promise<MerchantResult> {
  const log = opts.log ?? (() => {})
  const steps = opts.steps ?? merchantPlan()
  const base = opts.oracleUrl.replace(/\/$/, '')
  const out: MerchantResult = { calls: 0, served: 0, failed: 0, answers: [] }
  const tea = new Map<string, number>()
  const routes = new Map<string, number>()

  for (const step of steps) {
    out.calls++
    try {
      const res = await opts.fm.fetch(base + step.path)
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
      out.answers.push({ step: step.label, status: res.status, body })
      if (res.ok) {
        out.served++
        if (typeof body?.pricePerJin === 'number') tea.set(String(body.city), body.pricePerJin)
        if (typeof body?.caravanDays === 'number') routes.set(`${body.from}|${body.to}`, body.caravanDays)
        await log(`${step.label} → ${summarise(body)}`)
      } else {
        out.failed++
        await log(`${step.label} → HTTP ${res.status} (not charged; credited)`)
      }
    } catch (e) {
      if (e instanceof NoCertificateError || e instanceof PriceTooHighError) {
        out.stoppedReason = e.message
        await log(`stopped: ${e.message} (the certificate enforces the budget, not the prompt)`)
        break
      }
      out.failed++
      await log(`${step.label} → error: ${(e as Error).message}`)
    }
  }

  // Best trade: buy where tea is cheapest, sell where it is dearest.
  const sorted = [...tea.entries()].sort((a, b) => a[1] - b[1])
  const cheap = sorted[0]
  const dear = sorted[sorted.length - 1]
  if (cheap && dear && dear[1] > cheap[1]) {
    const days = routes.get(`${cheap[0]}|${dear[0]}`) ?? routes.get(`${dear[0]}|${cheap[0]}`)
    out.bestTrade = {
      buy: cheap[0],
      sell: dear[0],
      buyPrice: cheap[1],
      sellPrice: dear[1],
      margin: dear[1] - cheap[1],
      ...(days !== undefined ? { caravanDays: days } : {}),
    }
    await log(
      `best trade: buy tea in ${cheap[0]} at ${cheap[1]}, sell in ${dear[0]} at ${dear[1]} (margin ${dear[1] - cheap[1]} per jin; illustrative game data)`,
    )
  }
  return out
}

function summarise(body: Record<string, unknown> | null): string {
  if (!body) return 'ok'
  if ('pricePerJin' in body) return `${body.pricePerJin} per jin (${body.trend})`
  if ('temperature_c' in body) return `${body.temperature_c}°C, wind ${body.wind_kmh} km/h`
  if ('distanceLi' in body) return `${body.distanceLi} li, ~${body.caravanDays} caravan days`
  if ('text' in body) return `“${body.text}”`
  return 'ok'
}
