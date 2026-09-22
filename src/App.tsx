import { useEventSearchFromUrl } from './features/event-search/useEventSearchFromUrl'
import { EventMap } from './features/event-map/EventMap'

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

  // Mobile: map on top with an explicit viewport-relative height (self-
  // contained, doesn't depend on an ancestor's resolved height), list below
  // in normal document flow — the page itself scrolls, no toggle/sheet yet.
  // Desktop (md+): a fixed-height row filling the viewport (`md:h-dvh`), so
  // percentage heights resolve down to EventMap's own `height: 100%`; the
  // list becomes a fixed-width side panel with its own internal scroll, and
  // `md:overflow-hidden` keeps the page itself from also scrolling.
  return (
    <main className="flex flex-col md:h-dvh md:flex-row md:overflow-hidden">
      <div className="h-[50vh] w-full shrink-0 md:order-2 md:h-full md:flex-1">
        <EventMap events={data.events} />
      </div>
      <ul className="md:order-1 md:h-full md:w-96 md:shrink-0 md:overflow-y-auto">
        {data.events.map((event) => (
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
