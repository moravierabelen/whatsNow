import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Event } from './domain/events/event'
import type { EventPage } from './domain/events/provider'
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
  start: { utc: '2026-09-22T20:00:00.000Z', timeZone: 'Europe/Madrid' },
  spansMultipleDays: false,
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
    mockedSearchEvents.mockResolvedValue({ events: [], hasNextPage: false })

    renderApp('/')

    expect(screen.getByRole('main')).toBeInTheDocument()
    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalled())
  })

  it('starts a search on / using the established defaults', async () => {
    mockedSearchEvents.mockResolvedValue({ events: [], hasNextPage: false })

    renderApp('/')

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))
    const params = mockedSearchEvents.mock.calls[0][0]
    expect(params.timeMode).toBe('now')
    expect(params.location).toEqual({ type: 'city', citySlug: 'barcelona' })
    expect(params.page).toBe(1)
    expect(params.categories).toBeUndefined()
  })

  it('shows a loading state while the search is pending', () => {
    mockedSearchEvents.mockReturnValue(new Promise(() => {}))

    renderApp('/')

    expect(screen.getByText('Loading events…')).toBeInTheDocument()
  })

  it('shows the resulting events once the search resolves', async () => {
    const page: EventPage = { events: [SAMPLE_EVENT], hasNextPage: false }
    mockedSearchEvents.mockResolvedValue(page)

    renderApp('/')

    expect(await screen.findByText('Test Concert')).toBeInTheDocument()
    expect(screen.getByText('music')).toBeInTheDocument()
    expect(screen.getByText('Test Venue')).toBeInTheDocument()
    expect(screen.getByText('2026-09-22T20:00:00.000Z')).toBeInTheDocument()
  })

  it('shows an explicit empty state when the search resolves with no events', async () => {
    mockedSearchEvents.mockResolvedValue({ events: [], hasNextPage: false })

    renderApp('/')

    expect(await screen.findByText('No events found.')).toBeInTheDocument()
  })

  it('shows an error state when the search fails', async () => {
    mockedSearchEvents.mockRejectedValue(new Error('boom'))

    renderApp('/')

    expect(await screen.findByText('Could not load events.')).toBeInTheDocument()
  })

  it('passes mode=tonight through to the search', async () => {
    mockedSearchEvents.mockResolvedValue({ events: [], hasNextPage: false })

    renderApp('/?mode=tonight')

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))
    expect(mockedSearchEvents.mock.calls[0][0].timeMode).toBe('tonight')
  })

  it('works with an explicit city=barcelona', async () => {
    mockedSearchEvents.mockResolvedValue({ events: [], hasNextPage: false })

    renderApp('/?city=barcelona')

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))
    expect(mockedSearchEvents.mock.calls[0][0].location).toEqual({ type: 'city', citySlug: 'barcelona' })
  })

  it('does not execute a search for an unknown city', async () => {
    mockedSearchEvents.mockResolvedValue({ events: [], hasNextPage: false })

    renderApp('/?city=atlantis')

    // The disabled-query branch renders an empty <main>; waiting for that
    // confirms rendering has settled before asserting nothing was fetched.
    await waitFor(() => expect(screen.getByRole('main')).toBeEmptyDOMElement())
    expect(mockedSearchEvents).not.toHaveBeenCalled()
  })

  it('does not rewrite / to include city=barcelona', async () => {
    mockedSearchEvents.mockResolvedValue({ events: [], hasNextPage: false })

    renderApp('/')

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('location-search').textContent).toBe('')
  })
})
