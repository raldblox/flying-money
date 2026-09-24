import type { Metadata } from 'next'
import { SilkRoadMap } from '@/components/art/silk-road-map'
import { TallyArt } from '@/components/art/tally'
import { Markdown } from '@/components/markdown'
import { ButtonLink, Chapter, Sheet } from '@/components/section'
import { getDoc } from '@/lib/docs'

export const metadata: Metadata = {
  title: 'The story: 804 CE',
  description: 'How Tang-dynasty merchants stopped carrying coins, and why AI agents need the same idea.',
}

/** /story (§10.3): the four chapters come from docs/site/story.md (sourced claims only). */
export default function StoryPage() {
  const doc = getDoc('story')
  if (!doc) return null
  const [intro = '', ...chapters] = doc.body.split(/^## /m)
  const sources = /Sources:.*$/m.exec(doc.body)?.[0] ?? ''
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pt-16 text-center sm:px-6">
        <p className="smallcaps text-sm text-seal">
          <span lang="zh-Hant">飛錢</span> · the story
        </p>
        <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight text-balance sm:text-7xl">
          {intro.replace(/^# /, '').trim()}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-2">{doc.description}</p>
      </section>
      {chapters.map((c, i) => {
        const [title = '', ...rest] = c.split('\n')
        return (
          <Chapter
            key={title}
            id={`ch-${i + 1}`}
            n={i + 1}
            eyebrow={['Chang’an', 'Why it worked', 'Today', 'The mapping'][i] ?? ''}
            title={title}
          >
            <Sheet as="article" className="px-6 py-10 sm:px-12">
              <Markdown source={rest.join('\n').replace(/Sources:.*$/m, '')} className="max-w-3xl text-lg" />
              {i === 0 && <SilkRoadMap className="mt-10 w-full" />}
              {i === 1 && (
                <div className="mx-auto mt-10 max-w-lg">
                  <TallyArt />
                </div>
              )}
            </Sheet>
          </Chapter>
        )
      })}
      <section className="mx-auto max-w-4xl px-4 pb-20 text-center sm:px-6">
        <Markdown source={sources} inline className="text-sm text-ink-2" />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/how-it-works">How it works today →</ButtonLink>
          <ButtonLink href="/demo" variant="secondary">
            Watch an agent pay
          </ButtonLink>
        </div>
      </section>
    </>
  )
}
