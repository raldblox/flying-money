'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { offerToOpenPage, PENDING_OFFER } from '@/lib/carry/channel'
import { decodeCarried, decodeNoteCompact, NOTE_PREFIX, payloadOf } from '@/lib/carry/codec'

function canDecodeAlone(p: string) {
  try {
    decodeNoteCompact(p)
    return true
  } catch {
    return false
  }
}

export function CarryRouter() {
  const [msg, setMsg] = useState('Opening…')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    // from the share menu the code may sit in the shared url, the text, or the title
    const candidates = [window.location.href, q.get('url'), q.get('text'), q.get('title')].filter(Boolean) as string[]
    const found = candidates
      .flatMap((c) => [c, ...(c.match(/https?:\/\/\S+|fm[12][a-z]?\.[A-Za-z0-9_.-]+/g) ?? [])])
      .map(payloadOf)
      .find((p) => /^fm[12]/.test(p))
    if (!found) {
      setError('This link doesn’t carry a Flying Money slip or price code.')
      return
    }
    // a till's slip leaves out the order it already knows: only that till can read it, so just hand it over
    const tillOnly = found.startsWith(NOTE_PREFIX) && !canDecodeAlone(found)
    let kind: 'note' | 'offer' = 'note'
    if (!tillOnly)
      try {
        kind = decodeCarried(found).kind
      } catch (e) {
        setError((e as Error).message)
        return
      }
    void offerToOpenPage(found).then((by) => {
      if (by) {
        setMsg(`Sent to your open ${by}. You can close this tab.`)
        return
      }
      if (tillOnly)
        setError(
          'This slip is for a till’s current order. Open it on the device running that till, with the till open.',
        )
      else if (kind === 'note') window.location.replace(`/slip#${found}`)
      else {
        sessionStorage.setItem(PENDING_OFFER, found)
        window.location.replace('/wallet')
      }
    })
  }, [])
  return error ? (
    <>
      <h1 className="mt-2 font-display text-4xl font-semibold">Nothing to open</h1>
      <p role="alert" className="mt-3 text-seal">
        {error}
      </p>
      <Link href="/slip" className="mt-6 inline-block text-indigo underline">
        Receive a slip another way
      </Link>
    </>
  ) : (
    <h1 className="mt-2 font-display text-4xl font-semibold">{msg}</h1>
  )
}
