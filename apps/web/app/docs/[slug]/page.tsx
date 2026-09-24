import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DocsNav } from '@/components/docs-nav'
import { Markdown } from '@/components/markdown'
import { allDocs, getDoc } from '@/lib/docs'

export const dynamicParams = false

export function generateStaticParams() {
  return allDocs().map((d) => ({ slug: d.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const doc = getDoc((await params).slug)
  return doc ? { title: doc.title, description: doc.description } : {}
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const doc = getDoc((await params).slug)
  if (!doc) notFound()
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[13rem_1fr]">
      <DocsNav current={doc.slug} />
      <article className="sheet min-w-0 px-6 py-10 sm:px-12">
        <p className="smallcaps text-sm text-seal">
          Docs · {doc.group} ·{' '}
          <a className="text-indigo underline" href={`/docs/${doc.slug}.md`}>
            Markdown
          </a>
        </p>
        <Markdown source={doc.body} className="mt-4" />
      </article>
    </div>
  )
}
