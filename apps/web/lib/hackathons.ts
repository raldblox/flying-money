import type { ChainKey } from '@flying-money/chains'

/** The four submissions (BUILD_SPEC §16.2): one codebase, four framings. Only the framing and chains differ. */
export interface Hackathon {
  slug: 'arbitrum' | 'colosseum' | 'monad' | 'arc'
  name: string
  kind: string
  deadline: string
  /** Testnet first, then the capped mainnet. */
  chains: ChainKey[]
  track: string
  lead: 'shops' | 'agents'
  pitch: string
  why: string[]
}

export const HACKATHONS: Hackathon[] = [
  {
    slug: 'arbitrum',
    name: 'Arbitrum Open House Singapore',
    kind: 'Online buildathon',
    deadline: '4 Oct 2026',
    chains: ['arbitrum-sepolia', 'arbitrum'],
    track: 'Novel financial products',
    lead: 'shops',
    pitch: 'A novel financial product: one primitive, two front doors.',
    why: [
      'A prefunded, payee-scoped, expiring allowance: capped for the holder, reserved for the shop.',
      'Cumulative signed notes: any number of payments, one redemption.',
      'Anyone can redeem, so sellers and relayers need no special role; value only reaches the payee.',
      'No token, no points, no airdrop. Settlement is Circle USDC.',
    ],
  },
  {
    slug: 'colosseum',
    name: 'Colosseum Crypto World’s Fair',
    kind: 'EVM track (Base) and the general pool',
    deadline: '12 Oct 2026',
    chains: ['base-sepolia', 'base'],
    track: 'EVM track: agent payments',
    lead: 'agents',
    pitch: 'Give your AI agent a sealed certificate, not your wallet.',
    why: [
      'Agents pay per request over HTTP 402 with signed notes; the seller checks them locally in milliseconds.',
      'Claude and any MCP agent can pay through four tools, inside a budget it cannot raise.',
      'The budget is enforced by the certificate, not the prompt: a stolen key can only pay the named seller.',
      'The same certificates work at a shop counter, by QR, even offline.',
    ],
  },
  {
    slug: 'monad',
    name: 'Monad Metropolis',
    kind: 'Track 4: Trust, Identity & AI Infrastructure',
    deadline: '13 Oct 2026',
    chains: ['monad-testnet', 'monad'],
    track: 'Trust, Identity & AI Infrastructure',
    lead: 'agents',
    pitch: 'Trust infrastructure for agents that spend: budgets the math enforces.',
    why: [
      'Payee-scoped certificates: an agent key can pay one seller, up to one amount, until one date.',
      'Near-instant redemption on Monad: many notes settle in one transaction.',
      'MCP server and llms.txt so any agent framework can pay without custom code.',
      'Invariant-tested contract with no owner, admin, pause or fee.',
    ],
  },
  {
    slug: 'arc',
    name: 'Arc Microgrants (Circle, DoraHacks)',
    kind: 'Microgrant application',
    deadline: '14 Oct 2026',
    chains: ['arc-testnet', 'arc'],
    track: 'USDC-native payments for shops and agents',
    lead: 'shops',
    pitch: 'USDC-native payments for shops and agents.',
    why: [
      'Shops and sellers need only USDC, even for gas: collecting costs a little USDC, nothing else.',
      'Sub-second finality makes the one-transaction collect feel instant at the counter.',
      'The Lantern Café flow: a parent funds a café certificate; the child pays by QR; the café collects in one go.',
      'Every certificate is fully backed by USDC reserved for the named shop until it expires.',
    ],
  },
]

export const getHackathon = (slug: string) => HACKATHONS.find((h) => h.slug === slug)
