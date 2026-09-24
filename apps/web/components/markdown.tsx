import { marked } from 'marked'

/**
 * Renders Markdown from this repository (docs/site/*.md) — trusted, reviewed content, never user input.
 * The only place the site sets HTML directly.
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
  const html = inline ? marked.parseInline(source, { async: false }) : marked.parse(source, { async: false, gfm: true })
  const Tag = inline ? 'p' : 'div'
  // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted repository Markdown (see above)
  return <Tag className={`doc-prose ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}
