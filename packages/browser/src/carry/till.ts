import { counterRequestId, decodeOffer, encodeHeader } from '@flying-money/core'
import { decodeCarried, encodeOfferCompact } from './codec.js'

/** The price code as carriers send it: compact where it fits (sound, dense QR), else as the till made it. */
export function carriedPrice(priceQr: string): string {
  try {
    return encodeOfferCompact(decodeOffer(priceQr)) ?? priceQr
  } catch {
    return priceQr
  }
}

/**
 * A slip that arrived for this till's current order, in the form the till checks (`fm1.`). A compact slip may leave
 * out its memo: it's this order's, so the till supplies it. Returns the text unchanged if it isn't a slip, so the
 * till rejects it with its usual reason.
 */
export function slipForOrder(text: string, orderId: string): string {
  try {
    const c = decodeCarried(text, { memo: counterRequestId(orderId) })
    return c.kind === 'note' ? encodeHeader(c.note) : text
  } catch {
    return text
  }
}
