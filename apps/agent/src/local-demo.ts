// pnpm --filter @flying-money/agent demo:local — the whole demo on a private anvil (needs Foundry).
import { runLocalDemo } from './local.js'

const r = await runLocalDemo()
if (r.merchant.bestTrade) console.log('\nbest trade:', r.merchant.bestTrade)
process.exit(0)
