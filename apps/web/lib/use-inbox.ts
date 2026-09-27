'use client'
import type { Hex } from '@flying-money/core'
import { useCallback, useEffect, useState } from 'react'
import { type InboxItem, InboxSignInNeeded, inboxOwner, listInbox } from './inbox-client'

/**
 * The owner's request inbox on this browser: who is signed in, and the requests. Re-reads when the page regains focus,
 * every minute, and whenever this tab signs in or decides (the "fm-inbox" event).
 */
export function useInbox() {
  const [owner, setOwner] = useState<Hex | null | undefined>(undefined)
  const [items, setItems] = useState<InboxItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    const who = await inboxOwner()
    setOwner(who)
    if (!who) {
      setItems(null)
      return
    }
    try {
      setItems(await listInbox())
      setError(null)
    } catch (e) {
      if (e instanceof InboxSignInNeeded) setOwner(null)
      else setError((e as Error).message)
    }
  }, [])
  useEffect(() => {
    void load()
    const on = () => void load()
    window.addEventListener('fm-inbox', on)
    window.addEventListener('focus', on)
    const t = setInterval(on, 60_000)
    return () => {
      window.removeEventListener('fm-inbox', on)
      window.removeEventListener('focus', on)
      clearInterval(t)
    }
  }, [load])
  const waiting = items?.filter((i) => i.status === 'asked').length ?? 0
  return { owner, items, waiting, error, reload: load }
}
