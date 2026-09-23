// Silk Road Oracle game data (BUILD_SPEC §13.1). Tea prices and routes are FICTIONAL and labelled
// `illustrative: true`. Coordinates are approximate modern locations of the historical cities.

export interface City {
  name: string
  lat: number
  lon: number
}

export const CITIES: City[] = [
  { name: "Chang'an", lat: 34.26, lon: 108.94 },
  { name: 'Luoyang', lat: 34.62, lon: 112.45 },
  { name: 'Yangzhou', lat: 32.39, lon: 119.42 },
  { name: 'Dunhuang', lat: 40.14, lon: 94.66 },
  { name: 'Kaifeng', lat: 34.8, lon: 114.31 },
  { name: 'Chengdu', lat: 30.66, lon: 104.07 },
  { name: 'Guangzhou', lat: 23.13, lon: 113.26 },
  { name: 'Hangzhou', lat: 30.27, lon: 120.16 },
]

export const findCity = (name: string | undefined) =>
  name ? CITIES.find((c) => c.name.toLowerCase() === name.toLowerCase().replace(/’/g, "'")) : undefined

/** Small deterministic hash (FNV-1a) so the game data is stable within a UTC day. */
function fnv(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

export function teaPrice(city: City, day: string) {
  const h = fnv(`${city.name}|${day}`)
  return {
    city: city.name,
    day,
    pricePerJin: 80 + (h % 141), // 80–220
    trend: (['rising', 'steady', 'falling'] as const)[h % 3],
    currency: 'illustrative strings of cash',
    illustrative: true as const,
    note: 'Fictional game data for the Flying Money demo.',
  }
}

const TANG_LI_KM = 0.531 // one Tang-dynasty li ≈ 531 m

export function route(from: City, to: City) {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(to.lat - from.lat)
  const dLon = rad(to.lon - from.lon)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLon / 2) ** 2
  const km = 2 * R * Math.asin(Math.sqrt(a)) * 1.25 // roads are not straight
  const distanceLi = Math.round(km / TANG_LI_KM)
  return {
    from: from.name,
    to: to.name,
    distanceLi,
    distanceKm: Math.round(km),
    caravanDays: Math.max(1, Math.round(distanceLi / 80)),
    illustrative: true as const,
    note: 'Illustrative caravan route: great-circle distance with a road factor; not a historical itinerary.',
  }
}

/** Public-domain translations (James Legge, 1861 and 1891). */
export const PROVERBS: Array<{ text: string; source: string }> = [
  {
    text: 'Learning without thought is labour lost; thought without learning is perilous.',
    source: 'Analects 2.15, tr. James Legge (1861), public domain',
  },
  {
    text: 'When you know a thing, to hold that you know it; and when you do not know a thing, to allow that you do not know it;—this is knowledge.',
    source: 'Analects 2.17, tr. James Legge (1861), public domain',
  },
  {
    text: 'Virtue is not left to stand alone. He who practises it will have neighbours.',
    source: 'Analects 4.25, tr. James Legge (1861), public domain',
  },
  {
    text: 'What you do not want done to yourself, do not do to others.',
    source: 'Analects 15.24, tr. James Legge (1861), public domain',
  },
  {
    text: 'The superior man is modest in his speech, but exceeds in his actions.',
    source: 'Analects 14.29, tr. James Legge (1861), public domain',
  },
  {
    text: 'The journey of a thousand li commenced with a single step.',
    source: 'Tao Te Ching 64, tr. James Legge (1891), public domain',
  },
]

export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10)
