import { Marked } from 'marked'

/**
 * Markdown → HTML for the docs and the story page (audit F11). The sources are this repository's own files, but the
 * output is still sanitised: raw HTML is shown as text, and links and images may only point to http(s), mailto,
 * same-site paths or anchors.
 */
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const safeUrl = (href: string) => /^(https?:|mailto:|\/(?!\/)|#)/i.test(href.trim())

const md = new Marked({
  gfm: true,
  async: false,
  renderer: {
    html: ({ text }) => escapeHtml(text),
  },
  walkTokens: (token) => {
    if ((token.type === 'link' || token.type === 'image') && !safeUrl(token.href)) token.href = '#'
  },
})

export function renderMarkdown(source: string, inline = false): string {
  return inline ? (md.parseInline(source) as string) : (md.parse(source) as string)
}
