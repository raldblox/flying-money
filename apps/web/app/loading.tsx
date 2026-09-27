/** While a page loads (§22.5 h): a calm placeholder the size of the content, announced once. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-busy="true">
      <p className="sr-only" role="status">
        Loading…
      </p>
      <div className="h-10 w-2/3 animate-pulse rounded bg-paper-2 motion-reduce:animate-none" />
      <div className="mt-4 h-5 w-1/2 animate-pulse rounded bg-paper-2 motion-reduce:animate-none" />
      <div className="mt-10 h-64 animate-pulse rounded-md bg-paper-2 motion-reduce:animate-none" />
    </div>
  )
}
