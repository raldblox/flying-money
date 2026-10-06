// Silk Road Oracle as a local node server (§13.1). Config from env (.env.example); see hostedOracleFromEnv.
// Without store variables it runs on memory (development only); on Vercel the api/ entry requires a durable store.
import { existsSync } from 'node:fs'
import { announceSeller } from '@flying-money/server'
import { serve } from '@hono/node-server'
import { hostedOracleFromEnv } from './hosted.js'

for (const p of ['.env', '../../.env']) if (existsSync(p)) process.loadEnvFile(p)
const env = process.env

const h = hostedOracleFromEnv(env, { hosted: env.FM_REQUIRE_DURABLE === '1' })
console.log(
  h.seller.durable
    ? `store: ${h.seller.source} (${h.seller.prefix})`
    : 'store: MEMORY (not durable; development only; set the §21.5 store variables for a real seller)',
)
const { oracle } = h
oracle.events.on('note', (e) => console.log(`note ${e.status} ${e.path} cumulative ${e.accepted}`))
// collections and redeemer alerts are logged by the builder (hosted.ts)
oracle.server.startSweeper(60_000)
if (oracle.redeemer) oracle.redeemer.start(10_000)
else console.warn('no REDEEMER_KEY: notes are accepted but not redeemed by this process')

const port = Number(env.PORT ?? 8787)
serve({ fetch: oracle.app.fetch, port })
console.log(`Silk Road Oracle on :${port} accepting ${oracle.server.accepts.map((a) => a.chainId).join(', ')}`)

// ORACLE_ANNOUNCE=1: announce on the local network (mDNS, `_flying-money._tcp`), so agents on the same Wi-Fi find it
// with fm_discover, even with no internet. Off by default: everyone on the network sees an announcement.
if (env.ORACLE_ANNOUNCE === '1') {
  const a = announceSeller({
    name: env.ORACLE_NAME ?? 'Silk Road Oracle',
    port,
    payee: h.oracle.server.accepts[0]!.payee,
    chainIds: oracle.server.accepts.map((x) => x.chainId),
    path: '/v1',
  })
  console.log('announced on the local network as _flying-money._tcp')
  process.on('SIGINT', () => void a.stop().then(() => process.exit(0)))
}
