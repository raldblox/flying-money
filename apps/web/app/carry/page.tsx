import type { Metadata } from 'next'
import { CarryRouter } from './carry-router'

export const metadata: Metadata = { title: 'Opening a payment', robots: { index: false } }

/**
 * /carry#… : where links, shares, AirDrop and saved files open. The payload rides in the fragment, or arrives as
 * ?url=/?text= from the share menu (the installed app is a share target); it's handed to an open till or wallet on
 * this device, or opened in the right place.
 */
export default function CarryPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <p className="smallcaps text-sm text-seal">Flying Money</p>
      <CarryRouter />
    </div>
  )
}
