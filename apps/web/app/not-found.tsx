import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <h1 className="font-display text-5xl font-semibold">Not found</h1>
      <p className="mt-4 text-ink-2">That page, budget or chain doesn’t exist.</p>
      <p className="mt-8">
        <Link href="/" className="text-indigo underline">
          Back to the start
        </Link>
      </p>
    </div>
  )
}
