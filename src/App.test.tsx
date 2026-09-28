import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Event } from './domain/events/event'
import type { AggregatedSearchResult } from './providers/searchEvents'
import { searchEvents } from './providers/searchEvents'

vi.mock('./providers/searchEvents', () => ({
  searchEvents: vi.fn(),
}))

const mockedSearchEvents = vi.mocked(searchEvents)

const SAMPLE_EVENT: Event = {
  id: 'evt-1',
  source: { provider: 'ticketmaster', externalId: 'ext-1' },
  name: 'Test Concert',
  category: 'music',
  // Computed relative to "now" (not a fixed calendar date) so this stays
  // classified as "starting soon" — and therefore in the normal
  // featured/hero path — regardless of when the suite actually runs.
  start: { utc: new Date(Date.now() + 60 * 60 * 1000).toISOString(), timeZone: 'Europe/Madrid', timeKnown: true },
  venue: { name: 'Test Venue', coordinates: { latitude: 41.38, longitude: 2.17 } },
  url: 'https://example.com/event',
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

function renderApp(initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <App />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('App', () => {
  it('renders the main landmark', async () => {
    mockedSearchEvents.mockResolvedValue({ events: [], truncated: false, failedProviders: [] })

    renderApp('/')

    expect(screen.getByRole('main')).toBeInTheDocument()
    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalled())
  })

  it('starts a search on / using the established defaults', async () => {
    mockedSearchEvents.mockResolvedValue({ events: [], truncated: false, failedProviders: [] })

    renderApp('/')

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))
    const params = mockedSearchEvents.mock.calls[0][0]
    expect(params.timeMode).toBe('now')
    expect(params.location).toEqual({ type: 'city', citySlug: 'barcelona' })
    expect(params.categories).toBeUndefined()
  })

  it('shows a loading state while the search is pending', () => {
    mockedSearchEvents.mockReturnValue(new Promise(() => {}))

    renderApp('/')

    expect(screen.getByText('Finding your next plan…')).toBeInTheDocument()
  })

  it('shows the resulting events once the search resolves', async () => {
    const searchResult: AggregatedSearchResult = { events: [SAMPLE_EVENT], truncated: false, failedProviders: [] }
    mockedSearchEvents.mockResolvedValue(searchResult)

    const { container } = renderApp('/')

    // A single event with no `end` can never classify as "happening now",
    // so it renders as the featured event (not live). Category shows as
    // an icon only (see FeaturedEvent) — no textual "Music" label anymore;
    // scoped to <main> since "Music" still appears as text in the header's
    // CategoryNav tab.
    expect(await screen.findByText('Test Concert')).toBeInTheDocument()
    const main = within(screen.getByRole('main'))
    expect(main.queryByText('Music')).not.toBeInTheDocument()
    expect(main.getByText('Test Venue')).toBeInTheDocument()
    expect(main.getByText('View tickets')).toBeInTheDocument()
    // EventMap renders a `.leaflet-container` root — confirms the map is
    // actually wired to the real search results, not just the list.
    expect(container.querySelector('.leaflet-container')).toBeInTheDocument()
  })

  it('does not render the map when the search resolves with no events (non-now mode)', async () => {
    mockedSearchEvents.mockResolvedValue({ events: [], truncated: false, failedProviders: [] })

    // 'now' mode has its own dedicated empty treatment (see the "now mode"
    // tests below) — this covers the generic EmptyState still used by
    // every other mode.
    const { container } = renderApp('/?mode=today')

    expect(await screen.findByText('Nothing quite like that, yet')).toBeInTheDocument()
    expect(container.querySelector('.leaflet-container')).not.toBeInTheDocument()
  })

  it('shows an explicit empty state when the search resolves with no events (non-now mode)', async () => {
    mockedSearchEvents.mockResolvedValue({ events: [], truncated: false, failedProviders: [] })

    renderApp('/?mode=today')

    expect(await screen.findByText('Nothing quite like that, yet')).toBeInTheDocument()
  })

  describe('now mode empty states', () => {
    it('shows the normal featured/map hero when there are live-or-soon events', async () => {
      const searchResult: AggregatedSearchResult = { events: [SAMPLE_EVENT], truncated: false, failedProviders: [] }
      mockedSearchEvents.mockResolvedValue(searchResult)

      const { container } = renderApp('/')

      expect(await screen.findByText('Test Concert')).toBeInTheDocument()
      expect(container.querySelector('.hero-panel')).toBeInTheDocument()
    })

    it('shows the later-today empty state, hides markers/featured, and links to More plans', async () => {
      const laterToday: Event = {
        ...SAMPLE_EVENT,
        id: 'evt-later',
        // Well past the 180min "starting soon" window, same local day.
        start: { utc: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), timeZone: 'Europe/Madrid', timeKnown: true },
      }
      mockedSearchEvents.mockResolvedValue({ events: [laterToday], truncated: false, failedProviders: [] })

      const { container } = renderApp('/')

      expect(await screen.findByText('Nothing happening right now.')).toBeInTheDocument()
      const cta = screen.getByText("Explore what's coming up later today")
      expect(cta.closest('a')).toHaveAttribute('href', '#more-plans')
      expect(container.querySelector('.hero-panel')).not.toBeInTheDocument()
      expect(container.querySelector('.leaflet-container')).toBeInTheDocument()
      // Still reachable via "More plans", not hidden entirely.
      expect(screen.getByText('Test Concert')).toBeInTheDocument()
    })

    it('shows the nothing-today empty state and switches timeMode to tomorrow on click', async () => {
      mockedSearchEvents.mockResolvedValue({ events: [], truncated: false, failedProviders: [] })

      renderApp('/')

      expect(await screen.findByText('Nothing happening right now.')).toBeInTheDocument()
      const cta = screen.getByText(/coming up tomorrow/i)

      fireEvent.click(cta)

      await waitFor(() =>
        expect(mockedSearchEvents).toHaveBeenLastCalledWith(expect.objectContaining({ timeMode: 'tomorrow' })),
      )
    })
  })

  it('shows an error state when the search fails', async () => {
    mockedSearchEvents.mockRejectedValue(new Error('boom'))

    renderApp('/')

    expect(await screen.findByText('Could not load events.')).toBeInTheDocument()
  })

  it('retries the search from the error state and recovers', async () => {
    mockedSearchEvents.mockRejectedValueOnce(new Error('boom'))
    mockedSearchEvents.mockResolvedValue({ events: [SAMPLE_EVENT], truncated: false, failedProviders: [] })

    renderApp('/')

    const retry = await screen.findByRole('button', { name: 'Try again' })
    fireEvent.click(retry)

    expect(await screen.findByText('Test Concert')).toBeInTheDocument()
    expect(screen.queryByText('Could not load events.')).not.toBeInTheDocument()
  })

  it('says so when a source failed, instead of passing a short list off as complete', async () => {
    mockedSearchEvents.mockResolvedValue({
      events: [SAMPLE_EVENT],
      truncated: false,
      failedProviders: ['jambase'],
    })

    renderApp('/')

    expect(
      await screen.findByText('One of our sources is not responding, so some plans may be missing.'),
    ).toBeInTheDocument()
  })

  it('discloses a failed source even when the surviving one returned nothing', async () => {
    // Otherwise an outage is indistinguishable from a genuinely quiet city.
    mockedSearchEvents.mockResolvedValue({ events: [], truncated: false, failedProviders: ['ticketmaster'] })

    renderApp('/?mode=today')

    expect(await screen.findByText('Nothing quite like that, yet')).toBeInTheDocument()
    expect(
      screen.getByText('One of our sources is not responding, so some plans may be missing.'),
    ).toBeInTheDocument()
  })

  it('says so when there are more results than can be reached', async () => {
    mockedSearchEvents.mockResolvedValue({ events: [SAMPLE_EVENT], truncated: true, failedProviders: [] })

    renderApp('/')

    expect(
      await screen.findByText('There are more plans than we can show here — try narrowing by category.'),
    ).toBeInTheDocument()
  })

  it('shows no such notice when the result is complete', async () => {
    mockedSearchEvents.mockResolvedValue({ events: [SAMPLE_EVENT], truncated: false, failedProviders: [] })

    renderApp('/')

    expect(await screen.findByText('Test Concert')).toBeInTheDocument()
    expect(screen.queryByText(/not responding/)).not.toBeInTheDocument()
    expect(screen.queryByText(/more plans than we can show/)).not.toBeInTheDocument()
  })

  it('passes mode=tonight through to the search', async () => {
    mockedSearchEvents.mockResolvedValue({ events: [], truncated: false, failedProviders: [] })

    renderApp('/?mode=tonight')

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))
    expect(mockedSearchEvents.mock.calls[0][0].timeMode).toBe('tonight')
  })

  it('works with an explicit city=barcelona', async () => {
    mockedSearchEvents.mockResolvedValue({ events: [], truncated: false, failedProviders: [] })

    renderApp('/?city=barcelona')

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))
    expect(mockedSearchEvents.mock.calls[0][0].location).toEqual({ type: 'city', citySlug: 'barcelona' })
  })

  it('does not execute a search for an unknown city', async () => {
    mockedSearchEvents.mockResolvedValue({ events: [], truncated: false, failedProviders: [] })

    renderApp('/?city=atlantis')

    // The disabled-query branch renders only the header chrome, no <main>
    // (nothing to search for) — waiting for the header's city context to
    // settle confirms rendering has finished before asserting nothing was
    // fetched. The name renders twice (mobile-abbreviation + desktop-full
    // variants, both present in the DOM — CSS decides which is visible).
    await waitFor(() => expect(screen.getAllByText('Atlantis').length).toBeGreaterThan(0))
    expect(screen.queryByRole('main')).not.toBeInTheDocument()
    expect(mockedSearchEvents).not.toHaveBeenCalled()
  })

  it('does not rewrite / to include city=barcelona', async () => {
    mockedSearchEvents.mockResolvedValue({ events: [], truncated: false, failedProviders: [] })

    renderApp('/')

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('location-search').textContent).toBe('')
  })
})
