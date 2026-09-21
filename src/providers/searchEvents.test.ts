import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Event } from '../domain/events/event'
import type { EventLocation, EventSearchParams } from '../domain/events/provider'
import { jamBaseProvider } from './jambase/provider'
import { searchEvents } from './searchEvents'
import { ticketmasterProvider } from './ticketmaster/provider'

vi.mock('./ticketmaster/provider', () => ({
  ticketmasterProvider: { id: 'ticketmaster', searchEvents: vi.fn(), getEventById: vi.fn() },
}))
vi.mock('./jambase/provider', () => ({
  jamBaseProvider: { id: 'jambase', searchEvents: vi.fn(), getEventById: vi.fn() },
}))

const mockedTicketmasterSearch = vi.mocked(ticketmasterProvider.searchEvents)
const mockedJamBaseSearch = vi.mocked(jamBaseProvider.searchEvents)

const BARCELONA: EventLocation = { type: 'city', citySlug: 'barcelona' }

function params(overrides: Partial<EventSearchParams> = {}): EventSearchParams {
  return { timeMode: 'today', referenceTime: '2026-09-19T13:00:00Z', location: BARCELONA, ...overrides }
}

function event(id: string, provider: 'ticketmaster' | 'jambase'): Event {
  return {
    id,
    source: { provider, externalId: id },
    name: `Event ${id}`,
    category: 'music',
    start: { utc: '2026-09-19T19:00:00Z', timeZone: 'Europe/Madrid' },
    spansMultipleDays: false,
    venue: { name: 'Venue', coordinates: { latitude: 41.38, longitude: 2.17 } },
    url: 'https://example.com',
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('searchEvents (aggregator)', () => {
  it('combines results from both providers', async () => {
    mockedTicketmasterSearch.mockResolvedValue({ events: [event('tm-1', 'ticketmaster')], hasNextPage: false })
    mockedJamBaseSearch.mockResolvedValue({ events: [event('jb-1', 'jambase')], hasNextPage: false })

    const result = await searchEvents(params())

    expect(result.events).toHaveLength(2)
    expect(result.events.map((e) => e.id)).toEqual(['tm-1', 'jb-1'])
  })

  it('preserves Ticketmaster-then-JamBase order, and each provider\'s own internal order', async () => {
    mockedTicketmasterSearch.mockResolvedValue({
      events: [event('tm-2', 'ticketmaster'), event('tm-1', 'ticketmaster')],
      hasNextPage: false,
    })
    mockedJamBaseSearch.mockResolvedValue({
      events: [event('jb-2', 'jambase'), event('jb-1', 'jambase')],
      hasNextPage: false,
    })

    const result = await searchEvents(params())

    expect(result.events.map((e) => e.id)).toEqual(['tm-2', 'tm-1', 'jb-2', 'jb-1'])
  })

  it.each([
    [false, false, false],
    [true, false, true],
    [false, true, true],
    [true, true, true],
  ])('combines hasNextPage as OR (ticketmaster=%s, jambase=%s -> %s)', async (tmHasNext, jbHasNext, expected) => {
    mockedTicketmasterSearch.mockResolvedValue({ events: [], hasNextPage: tmHasNext })
    mockedJamBaseSearch.mockResolvedValue({ events: [], hasNextPage: jbHasNext })

    const result = await searchEvents(params())

    expect(result.hasNextPage).toBe(expected)
  })

  it('passes the exact same params to both providers', async () => {
    mockedTicketmasterSearch.mockResolvedValue({ events: [], hasNextPage: false })
    mockedJamBaseSearch.mockResolvedValue({ events: [], hasNextPage: false })

    const searchParams = params({ page: 2, categories: ['music'] })
    await searchEvents(searchParams)

    expect(mockedTicketmasterSearch).toHaveBeenCalledWith(searchParams)
    expect(mockedJamBaseSearch).toHaveBeenCalledWith(searchParams)
  })

  it('works correctly when one provider returns zero events', async () => {
    mockedTicketmasterSearch.mockResolvedValue({ events: [event('tm-1', 'ticketmaster')], hasNextPage: false })
    mockedJamBaseSearch.mockResolvedValue({ events: [], hasNextPage: false })

    const result = await searchEvents(params())

    expect(result.events).toHaveLength(1)
    expect(result.events[0].id).toBe('tm-1')
  })

  it('propagates the error if Ticketmaster fails', async () => {
    mockedTicketmasterSearch.mockRejectedValue(new Error('ticketmaster boom'))
    mockedJamBaseSearch.mockResolvedValue({ events: [], hasNextPage: false })

    await expect(searchEvents(params())).rejects.toThrow('ticketmaster boom')
  })

  it('propagates the error if JamBase fails', async () => {
    mockedTicketmasterSearch.mockResolvedValue({ events: [], hasNextPage: false })
    mockedJamBaseSearch.mockRejectedValue(new Error('jambase boom'))

    await expect(searchEvents(params())).rejects.toThrow('jambase boom')
  })

  it('does not deduplicate events with different ids, even if otherwise similar', async () => {
    const tmEvent = { ...event('tm-1', 'ticketmaster'), name: 'Same Concert' }
    const jbEvent = { ...event('jb-1', 'jambase'), name: 'Same Concert' }
    mockedTicketmasterSearch.mockResolvedValue({ events: [tmEvent], hasNextPage: false })
    mockedJamBaseSearch.mockResolvedValue({ events: [jbEvent], hasNextPage: false })

    const result = await searchEvents(params())

    expect(result.events).toHaveLength(2)
    expect(result.events.map((e) => e.id)).toEqual(['tm-1', 'jb-1'])
  })
})
