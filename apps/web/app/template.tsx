import type { ReactNode } from 'react'

/** Re-mounts on every navigation, so each page fades in instead of snapping (reduced motion: no fade). */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>
}
