import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Event } from '../domain/events/event'
import type { EventLocation, EventSearchParams } from '../domain/events/provider'
import { agendaCatProvider } from './agendaCat/provider'
import { jamBaseProvider } from './jambase/provider'
import { searchEvents } from './searchEvents'
import { ticketmasterProvider } from './ticketmaster/provider'

vi.mock('./ticketmaster/provider', () => ({
  ticketmasterProvider: { id: 'ticketmaster', searchEvents: vi.fn(), getEventById: vi.fn() },
}))
vi.mock('./jambase/provider', () => ({
  jamBaseProvider: { id: 'jambase', searchEvents: vi.fn(), getEventById: vi.fn() },
}))
vi.mock('./agendaCat/provider', () => ({
  agendaCatProvider: { id: 'agenda-cat', searchEvents: vi.fn(), getEventById: vi.fn() },
}))

const mockedTicketmasterSearch = vi.mocked(ticketmasterProvider.searchEvents)
const mockedJamBaseSearch = vi.mocked(jamBaseProvider.searchEvents)
const mockedAgendaCatSearch = vi.mocked(agendaCatProvider.searchEvents)

const EMPTY = { events: [], truncated: false }

const BARCELONA: EventLocation = { type: 'city', citySlug: 'barcelona' }

function params(overrides: Partial<EventSearchParams> = {}): EventSearchParams {
  return { timeMode: 'today', referenceTime: '2026-09-19T13:00:00Z', location: BARCELONA, ...overrides }
}

function event(id: string, provider: 'ticketmaster' | 'jambase' | 'agenda-cat'): Event {
  return {
    id,
    source: { provider, externalId: id },
    // Deliberately just the bare id, not "Event {id}" — a shared "Event"
    // word plus the same default venue/time would make every pair of
    // fixtures in this file look like a plausible cross-provider
    // duplicate to `deduplicateEvents`, which isn't what these tests (not
    // about deduplication) are asserting.
    name: id,
    category: 'music',
    start: { utc: '2026-09-19T19:00:00Z', timeZone: 'Europe/Madrid', timeKnown: true },
    venue: { name: 'Venue', coordinates: { latitude: 41.38, longitude: 2.17 } },
    url: 'https://example.com',
  }
}

beforeEach(() => {
  // Each test opts into the providers it cares about; the rest answer empty.
  mockedTicketmasterSearch.mockResolvedValue(EMPTY)
  mockedJamBaseSearch.mockResolvedValue(EMPTY)
  mockedAgendaCatSearch.mockResolvedValue(EMPTY)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('searchEvents (aggregator)', () => {
  it('combines results from every provider', async () => {
    mockedTicketmasterSearch.mockResolvedValue({ events: [event('tm-1', 'ticketmaster')], truncated: false })
    mockedJamBaseSearch.mockResolvedValue({ events: [event('jb-1', 'jambase')], truncated: false })
    mockedAgendaCatSearch.mockResolvedValue({ events: [event('ag-1', 'agenda-cat')], truncated: false })

    const result = await searchEvents(params())

    expect(result.events.map((e) => e.id)).toEqual(['tm-1', 'jb-1', 'ag-1'])
  })

  it('preserves provider order, and each provider\'s own internal order', async () => {
    mockedTicketmasterSearch.mockResolvedValue({
      events: [event('tm-2', 'ticketmaster'), event('tm-1', 'ticketmaster')],
      truncated: false,
    })
    mockedJamBaseSearch.mockResolvedValue({
      events: [event('jb-2', 'jambase'), event('jb-1', 'jambase')],
      truncated: false,
    })

    mockedAgendaCatSearch.mockResolvedValue({
      events: [event('ag-2', 'agenda-cat'), event('ag-1', 'agenda-cat')],
      truncated: false,
    })

    const result = await searchEvents(params())

    expect(result.events.map((e) => e.id)).toEqual(['tm-2', 'tm-1', 'jb-2', 'jb-1', 'ag-2', 'ag-1'])
  })

  it.each([
    [false, false, false],
    [true, false, true],
    [false, true, true],
    [true, true, true],
  ])('combines truncated as OR (ticketmaster=%s, jambase=%s -> %s)', async (tmTruncated, jbTruncated, expected) => {
    mockedTicketmasterSearch.mockResolvedValue({ events: [], truncated: tmTruncated })
    mockedJamBaseSearch.mockResolvedValue({ events: [], truncated: jbTruncated })

    const result = await searchEvents(params())

    expect(result.truncated).toBe(expected)
  })

  it('passes the exact same params to every provider', async () => {
    const searchParams = params({ categories: ['music'] })
    await searchEvents(searchParams)

    expect(mockedTicketmasterSearch).toHaveBeenCalledWith(searchParams)
    expect(mockedJamBaseSearch).toHaveBeenCalledWith(searchParams)
    expect(mockedAgendaCatSearch).toHaveBeenCalledWith(searchParams)
  })

  it('works correctly when one provider returns zero events', async () => {
    mockedTicketmasterSearch.mockResolvedValue({ events: [event('tm-1', 'ticketmaster')], truncated: false })
    mockedJamBaseSearch.mockResolvedValue({ events: [], truncated: false })

    const result = await searchEvents(params())

    expect(result.events).toHaveLength(1)
    expect(result.events[0].id).toBe('tm-1')
  })

  it('still returns JamBase results when Ticketmaster fails, and names the failed source', async () => {
    mockedTicketmasterSearch.mockRejectedValue(new Error('ticketmaster boom'))
    mockedJamBaseSearch.mockResolvedValue({ events: [event('jb-1', 'jambase')], truncated: false })

    const result = await searchEvents(params())

    expect(result.events.map((e) => e.id)).toEqual(['jb-1'])
    expect(result.failedProviders).toEqual(['ticketmaster'])
  })

  it('still returns Ticketmaster results when JamBase fails, and names the failed source', async () => {
    mockedTicketmasterSearch.mockResolvedValue({ events: [event('tm-1', 'ticketmaster')], truncated: false })
    mockedJamBaseSearch.mockRejectedValue(new Error('jambase boom'))

    const result = await searchEvents(params())

    expect(result.events.map((e) => e.id)).toEqual(['tm-1'])
    expect(result.failedProviders).toEqual(['jambase'])
  })

  it('reports no failed providers when they all answer', async () => {
    const result = await searchEvents(params())

    expect(result.failedProviders).toEqual([])
  })

  it('throws when every provider fails, so an outage never looks like an empty city', async () => {
    mockedTicketmasterSearch.mockRejectedValue(new Error('ticketmaster boom'))
    mockedJamBaseSearch.mockRejectedValue(new Error('jambase boom'))
    mockedAgendaCatSearch.mockRejectedValue(new Error('agenda boom'))

    await expect(searchEvents(params())).rejects.toThrow('ticketmaster boom')
  })

  it('does not throw while any provider still answers', async () => {
    mockedTicketmasterSearch.mockRejectedValue(new Error('ticketmaster boom'))
    mockedJamBaseSearch.mockRejectedValue(new Error('jambase boom'))
    mockedAgendaCatSearch.mockResolvedValue({ events: [event('ag-1', 'agenda-cat')], truncated: false })

    const result = await searchEvents(params())

    expect(result.events.map((e) => e.id)).toEqual(['ag-1'])
    expect(result.failedProviders).toEqual(['ticketmaster', 'jambase'])
  })

  it('reports truncation from the Agenda provider too', async () => {
    mockedAgendaCatSearch.mockResolvedValue({ events: [], truncated: true })

    expect((await searchEvents(params())).truncated).toBe(true)
  })

  it('still reports truncation from the provider that did answer', async () => {
    mockedTicketmasterSearch.mockRejectedValue(new Error('ticketmaster boom'))
    mockedJamBaseSearch.mockResolvedValue({ events: [], truncated: true })

    const result = await searchEvents(params())

    expect(result.truncated).toBe(true)
  })

  describe('keeping the result inside the city that was asked for', () => {
    /** Sant Celoni: ~55km out, yet tagged `municipi=barcelona` upstream. */
    const FAR_VENUE = { name: 'Auditori Carme Serrallonga', coordinates: { latitude: 41.7884, longitude: 2.7808 } }

    it('drops an event whose venue is outside the city radius', async () => {
      const far = { ...event('ag-far', 'agenda-cat'), venue: FAR_VENUE }
      mockedAgendaCatSearch.mockResolvedValue({ events: [far], truncated: false })

      expect((await searchEvents(params())).events).toEqual([])
    })

    it('keeps an event at the far edge of the radius', async () => {
      // ~13km from the centre, inside Barcelona's configured 15km.
      const edge = {
        ...event('ag-edge', 'agenda-cat'),
        venue: { name: 'Edge', coordinates: { latitude: 41.5, longitude: 2.17 } },
      }
      mockedAgendaCatSearch.mockResolvedValue({ events: [edge], truncated: false })

      expect((await searchEvents(params())).events.map((e) => e.id)).toEqual(['ag-edge'])
    })

    it('applies to every provider, not just the one that reported the problem', async () => {
      mockedTicketmasterSearch.mockResolvedValue({
        events: [{ ...event('tm-far', 'ticketmaster'), venue: FAR_VENUE }],
        truncated: false,
      })
      mockedJamBaseSearch.mockResolvedValue({ events: [event('jb-near', 'jambase')], truncated: false })

      expect((await searchEvents(params())).events.map((e) => e.id)).toEqual(['jb-near'])
    })
  })

  describe('keeping the result inside the category that was asked for', () => {
    it('drops an event whose mapped category is not the one requested', async () => {
      // The reported case: Ticketmaster has no classification for some of our
      // categories, so it answers with everything rather than an error.
      mockedTicketmasterSearch.mockResolvedValue({
        events: [event('tm-music', 'ticketmaster'), { ...event('tm-kids', 'ticketmaster'), category: 'family' }],
        truncated: false,
      })

      const result = await searchEvents(params({ categories: ['family'] }))

      expect(result.events.map((e) => e.id)).toEqual(['tm-kids'])
    })

    it('filters on the mapped category, so filtering matches what the card shows', async () => {
      mockedAgendaCatSearch.mockResolvedValue({
        events: [{ ...event('ag-kids', 'agenda-cat'), category: 'family' }],
        truncated: false,
      })

      expect((await searchEvents(params({ categories: ['family'] }))).events.map((e) => e.id)).toEqual(['ag-kids'])
    })

    it('keeps an event matching any of several requested categories', async () => {
      mockedTicketmasterSearch.mockResolvedValue({
        events: [event('tm-music', 'ticketmaster'), { ...event('tm-film', 'ticketmaster'), category: 'film' }],
        truncated: false,
      })

      const result = await searchEvents(params({ categories: ['music', 'film'] }))

      expect(result.events.map((e) => e.id)).toEqual(['tm-music', 'tm-film'])
    })

    it('returns everything when no category is requested', async () => {
      mockedTicketmasterSearch.mockResolvedValue({
        events: [event('tm-1', 'ticketmaster'), { ...event('tm-2', 'ticketmaster'), category: 'other' }],
        truncated: false,
      })

      expect((await searchEvents(params())).events).toHaveLength(2)
    })
  })

  it('deduplicates a genuine cross-provider duplicate (same time/venue, matching name) into one event', async () => {
    // Full matching heuristic (name/location scenarios) is covered in
    // deduplicateEvents.test.ts — this just confirms searchEvents actually
    // applies it, not the old "never merge" behavior.
    const tmEvent = { ...event('tm-1', 'ticketmaster'), name: 'Only The Poets - AND I’D DO IT AGAIN' }
    const jbEvent = { ...event('jb-1', 'jambase'), name: 'Only The Poets at Venue' }
    mockedTicketmasterSearch.mockResolvedValue({ events: [tmEvent], truncated: false })
    mockedJamBaseSearch.mockResolvedValue({ events: [jbEvent], truncated: false })

    const result = await searchEvents(params())

    expect(result.events).toHaveLength(1)
  })

  it('does not deduplicate events with different ids when they represent clearly different plans', async () => {
    const tmEvent = { ...event('tm-1', 'ticketmaster'), name: 'Totally Unrelated Thing' }
    const jbEvent = { ...event('jb-1', 'jambase'), name: 'Something Else Entirely' }
    mockedTicketmasterSearch.mockResolvedValue({ events: [tmEvent], truncated: false })
    mockedJamBaseSearch.mockResolvedValue({ events: [jbEvent], truncated: false })

    const result = await searchEvents(params())

    expect(result.events).toHaveLength(2)
    expect(result.events.map((e) => e.id)).toEqual(['tm-1', 'jb-1'])
  })
})
