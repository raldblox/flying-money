/** An account page loading: the shape of a list, never an empty screen (§22.5 h). */
export default function Loading() {
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        Loading…
      </p>
      <div className="h-10 w-48 animate-pulse rounded bg-paper-2 motion-reduce:animate-none" />
      <div className="mt-6 grid gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-md bg-paper-2 motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  )
}
