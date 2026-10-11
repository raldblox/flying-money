import { type ChainKey, getChain, rpcUrl } from '@flying-money/chains'
import { type Hex, readCertificate } from '@flying-money/core'
import { createPublicClient, http } from 'viem'

export async function loadCertificate(chain: ChainKey, id: Hex) {
  const network = getChain(chain)
  if (!network.flyingMoney) return null
  return readCertificate(
    createPublicClient({ transport: http(rpcUrl(chain), { timeout: 8_000, retryCount: 0 }) }),
    network.flyingMoney,
    id,
  )
}
