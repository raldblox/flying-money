'use client'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders a full-screen layer at the top of the page. A `position: fixed` element inside a transformed ancestor (the
 * slightly rotated paper sheets) is fixed to that ancestor, not the screen, and ends up under the page: so overlays
 * leave the tree.
 */
export function inBody(node: ReactNode) {
  return typeof document === 'undefined' ? node : createPortal(node, document.body)
}
