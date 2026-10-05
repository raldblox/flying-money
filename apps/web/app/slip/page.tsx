import type { Metadata } from 'next'
import { SlipClient } from './slip-client'

export const metadata: Metadata = {
  title: 'A payment slip',
  description: 'A signed Flying Money payment slip: check it on this device, pass it on, or spend it.',
  robots: { index: false },
}

/** /slip#fm2n.… : one payment slip, carried here by any carrier. The slip stays in the fragment (never sent). */
export default function SlipPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="smallcaps text-sm text-seal">A payment slip</p>
      <SlipClient />
    </div>
  )
}
