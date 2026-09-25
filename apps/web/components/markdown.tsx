import { renderMarkdown } from '@/lib/markdown'

/**
 * Renders Markdown from this repository (docs/site/*.md). The only place the site sets HTML directly, and the HTML
 * is sanitised first (raw HTML shown as text, safe link targets only; audit F11).
 */
export function Markdown({
  source,
  inline = false,
  className = '',
}: {
  source: string
  inline?: boolean
  className?: string
}) {
  const html = renderMarkdown(source, inline)
  const Tag = inline ? 'p' : 'div'
  // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised by renderMarkdown (see above)
  return <Tag className={`doc-prose ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}
