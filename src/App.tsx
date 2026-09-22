import { useEventSearchFromUrl } from './features/event-search/useEventSearchFromUrl'

function App() {
  const { data, isPending, isError, fetchStatus } = useEventSearchFromUrl()

  // Disabled query (no valid EventSearchParams yet, e.g. an unsupported
  // city) — not loading, not an error, just nothing to search for.
  if (fetchStatus === 'idle' && isPending) {
    return <main></main>
  }

  if (isPending) {
    return (
      <main>
        <p>Loading events…</p>
      </main>
    )
  }

  if (isError) {
    return (
      <main>
        <p>Could not load events.</p>
      </main>
    )
  }

  if (data.events.length === 0) {
    return (
      <main>
        <p>No events found.</p>
      </main>
    )
  }

  return (
    <main>
      <ul>
        {data.events.map(event => (
          <li key={event.id}>
            <p>{event.name}</p>
            <p>{event.category}</p>
            <p>{event.venue.name}</p>
            <p>{event.start.utc}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}

export default App
