/**
 * Hands a carried payload to a Flying Money page already open on this device (an open till takes slips, an open
 * wallet takes price codes), so a link or share opened in a new tab lands where the person is working.
 */
const NAME = 'fm-carry'
type Msg = { type: 'payload'; id: string; payload: string } | { type: 'taken'; id: string; by: string }

/** Offers the payload; resolves with who took it, or null if no open page did within the wait. */
export function offerToOpenPage(payload: string, waitMs = 700): Promise<string | null> {
  if (typeof BroadcastChannel === 'undefined') return Promise.resolve(null)
  const ch = new BroadcastChannel(NAME)
  const id = Math.random().toString(36).slice(2)
  return new Promise((resolve) => {
    const done = (by: string | null) => {
      clearTimeout(t)
      ch.close()
      resolve(by)
    }
    const t = setTimeout(() => done(null), waitMs)
    ch.onmessage = (e: MessageEvent<Msg>) => {
      if (e.data.type === 'taken' && e.data.id === id) done(e.data.by)
    }
    ch.postMessage({ type: 'payload', id, payload } satisfies Msg)
  })
}

/** An open page listens: `take` returns true if it used the payload. Returns the unsubscribe function. */
export function listenForCarried(by: string, take: (payload: string) => boolean): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const ch = new BroadcastChannel(NAME)
  ch.onmessage = (e: MessageEvent<Msg>) => {
    if (e.data.type === 'payload' && take(e.data.payload))
      ch.postMessage({ type: 'taken', id: e.data.id, by } satisfies Msg)
  }
  return () => ch.close()
}

/** A price code waiting for the wallet to open (set by /carry when no wallet tab was open). */
export const PENDING_OFFER = 'fm-pending-offer'
