import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EventLocation, EventSearchParams } from '../../domain/events/provider'
import { TicketmasterRequestError, fetchTicketmasterEventById, fetchTicketmasterEvents } from './client'
import { ticketmasterProvider } from './provider'
import type { TicketmasterEvent, TicketmasterEventSearchResponse } from './types'

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>()
  return {
    ...actual,
    fetchTicketmasterEvents: vi.fn(),
    fetchTicketmasterEventById: vi.fn(),
  }
})

const mockedFetchEvents = vi.mocked(fetchTicketmasterEvents)
const mockedFetchEventById = vi.mocked(fetchTicketmasterEventById)

const BARCELONA: EventLocation = { type: 'city', citySlug: 'barcelona' }
const REFERENCE_TIME = '2026-09-15T10:00:00Z' // Tuesday, Europe/Madrid

function searchResponse(overrides: Partial<TicketmasterEventSearchResponse> = {}): TicketmasterEventSearchResponse {
  return {
    page: { size: 20, totalElements: 0, totalPages: 0, number: 0 },
    ...overrides,
  }
}

function rawEvent(overrides: Partial<TicketmasterEvent> = {}): TicketmasterEvent {
  return {
    id: 'tm-1',
    name: 'Test Event',
    url: 'https://www.ticketmaster.es/event/test',
    dates: {
      start: { dateTime: '2026-09-18T19:00:00Z' },
      timezone: 'Europe/Madrid',
    },
    _embedded: {
      venues: [
        {
          name: 'Sala Razzmatazz',
          location: { latitude: '41.39701', longitude: '2.19147' },
        },
      ],
    },
    ...overrides,
  }
}

function searchParams(overrides: Partial<EventSearchParams> = {}): EventSearchParams {
  return { timeMode: 'today', referenceTime: REFERENCE_TIME, location: BARCELONA, ...overrides }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('ticketmasterProvider.searchEvents — temporal window', () => {
  it('uses the same query window for now and today', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    await ticketmasterProvider.searchEvents(searchParams({ timeMode: 'now' }))
    const nowQuery = mockedFetchEvents.mock.calls[0][0]

    await ticketmasterProvider.searchEvents(searchParams({ timeMode: 'today' }))
    const todayQuery = mockedFetchEvents.mock.calls[1][0]

    expect(nowQuery.startDateTime).toBe('2026-09-14T22:00:00Z')
    expect(nowQuery.endDateTime).toBe('2026-09-15T22:00:00Z')
    expect(nowQuery).toEqual(todayQuery)
  })

  it('produces the correct Tomorrow window', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    await ticketmasterProvider.searchEvents(searchParams({ timeMode: 'tomorrow' }))
    const query = mockedFetchEvents.mock.calls[0][0]

    expect(query.startDateTime).toBe('2026-09-15T22:00:00Z')
    expect(query.endDateTime).toBe('2026-09-16T22:00:00Z')
  })

  it('produces the correct Friday 18:00 -> Monday 00:00 Weekend window', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    await ticketmasterProvider.searchEvents(searchParams({ timeMode: 'weekend' }))
    const query = mockedFetchEvents.mock.calls[0][0]

    expect(query.startDateTime).toBe('2026-09-18T16:00:00Z')
    expect(query.endDateTime).toBe('2026-09-20T22:00:00Z')
  })
})

describe('ticketmasterProvider.searchEvents — location', () => {
  it('translates a city location into city/countryCode params', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    await ticketmasterProvider.searchEvents(searchParams({ location: BARCELONA }))
    const query = mockedFetchEvents.mock.calls[0][0]

    expect(query.city).toBe('Barcelona')
    expect(query.countryCode).toBe('ES')
    expect(query.latlong).toBeUndefined()
  })

  it('throws an explicit error for coordinate-based search, which is not yet supported', async () => {
    await expect(
      ticketmasterProvider.searchEvents(
        searchParams({
          location: { type: 'coordinates', coordinates: { latitude: 41.38, longitude: 2.17 }, radiusKm: 5 },
        }),
      ),
    ).rejects.toThrow('Coordinate-based search is not yet supported')

    expect(mockedFetchEvents).not.toHaveBeenCalled()
  })
})

describe('ticketmasterProvider.searchEvents — pagination', () => {
  /** A page whose metadata claims `totalPages`, carrying `count` distinct events. */
  function pageOf(count: number, totalPages: number, number: number): TicketmasterEventSearchResponse {
    return searchResponse({
      page: { size: 199, totalElements: totalPages * 199, totalPages, number },
      _embedded: { events: Array.from({ length: count }, (_, i) => rawEvent({ id: `tm-${number}-${i}` })) },
    })
  }

  it('requests the largest page size Ticketmaster accepts', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    await ticketmasterProvider.searchEvents(searchParams())

    // 200 or more is rejected by the API with DIS1036.
    expect(mockedFetchEvents.mock.calls[0][0].size).toBe('199')
  })

  it('starts from Ticketmaster page 0', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    await ticketmasterProvider.searchEvents(searchParams())

    expect(mockedFetchEvents.mock.calls[0][0].page).toBe('0')
  })

  it('makes a single request when the first page is the only one', async () => {
    mockedFetchEvents.mockResolvedValue(pageOf(2, 1, 0))

    const result = await ticketmasterProvider.searchEvents(searchParams())

    expect(mockedFetchEvents).toHaveBeenCalledTimes(1)
    expect(result.events).toHaveLength(2)
    expect(result.truncated).toBe(false)
  })

  it('fetches every remaining page and returns the combined set', async () => {
    mockedFetchEvents
      .mockResolvedValueOnce(pageOf(3, 3, 0))
      .mockResolvedValueOnce(pageOf(3, 3, 1))
      .mockResolvedValueOnce(pageOf(2, 3, 2))

    const result = await ticketmasterProvider.searchEvents(searchParams())

    expect(mockedFetchEvents).toHaveBeenCalledTimes(3)
    expect(mockedFetchEvents.mock.calls.map((call) => call[0].page)).toEqual(['0', '1', '2'])
    expect(result.events).toHaveLength(8)
    expect(result.truncated).toBe(false)
  })

  it('keeps every page on the same query apart from the page number', async () => {
    mockedFetchEvents.mockResolvedValueOnce(pageOf(1, 2, 0)).mockResolvedValueOnce(pageOf(1, 2, 1))

    await ticketmasterProvider.searchEvents(searchParams())

    const [{ page: firstPage, ...firstQuery }, { page: secondPage, ...secondQuery }] =
      mockedFetchEvents.mock.calls.map((call) => call[0])
    expect(firstQuery).toEqual(secondQuery)
    expect([firstPage, secondPage]).toEqual(['0', '1'])
  })

  it('stops at the paging depth Ticketmaster allows and reports the result as truncated', async () => {
    // (page * size) must stay under 1,000, so with size=199 only pages 0-5
    // are reachable — a search with more pages than that cannot be completed.
    mockedFetchEvents.mockResolvedValue(pageOf(1, 40, 0))

    const result = await ticketmasterProvider.searchEvents(searchParams())

    expect(mockedFetchEvents).toHaveBeenCalledTimes(6)
    expect(mockedFetchEvents.mock.calls.map((call) => call[0].page)).toEqual(['0', '1', '2', '3', '4', '5'])
    expect(result.truncated).toBe(true)
  })

  it('does not request further pages when the first response reports none', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    const result = await ticketmasterProvider.searchEvents(searchParams())

    expect(mockedFetchEvents).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ events: [], truncated: false })
  })

  it('applies the eligibility and mapping pipeline to every page, not just the first', async () => {
    const ineligible = rawEvent({
      id: 'tm-ineligible',
      dates: {
        start: { dateTime: '2026-09-18T09:00:00Z' },
        timezone: 'Europe/Madrid',
        access: { startDateTime: '2026-07-20T15:04:14Z', endDateTime: '2026-09-15T10:00:00Z' },
      },
    })
    mockedFetchEvents
      .mockResolvedValueOnce(pageOf(1, 2, 0))
      .mockResolvedValueOnce(
        searchResponse({
          page: { size: 199, totalElements: 398, totalPages: 2, number: 1 },
          _embedded: { events: [ineligible] },
        }),
      )

    const result = await ticketmasterProvider.searchEvents(searchParams())

    expect(mockedFetchEvents).toHaveBeenCalledTimes(2)
    expect(result.events).toHaveLength(1)
  })

  it('propagates a failure on a later page rather than returning a partial set', async () => {
    mockedFetchEvents
      .mockResolvedValueOnce(pageOf(1, 3, 0))
      .mockRejectedValueOnce(new TicketmasterRequestError('boom', 500))

    await expect(ticketmasterProvider.searchEvents(searchParams())).rejects.toBeInstanceOf(TicketmasterRequestError)
  })
})

describe('ticketmasterProvider.searchEvents — mapping pipeline', () => {
  it('maps and returns eligible raw events', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse({ _embedded: { events: [rawEvent()] } }))

    const result = await ticketmasterProvider.searchEvents(searchParams())

    expect(result.events).toHaveLength(1)
    expect(result.events[0].name).toBe('Test Event')
  })

  it('excludes ineligible raw events (e.g. timed-entry / flexible-admission listings)', async () => {
    const ineligible = rawEvent({
      dates: {
        start: { dateTime: '2026-09-18T09:00:00Z' },
        timezone: 'Europe/Madrid',
        access: { startDateTime: '2026-07-20T15:04:14Z', endDateTime: '2026-09-15T10:00:00Z' },
      },
    })
    mockedFetchEvents.mockResolvedValue(searchResponse({ _embedded: { events: [ineligible] } }))

    const result = await ticketmasterProvider.searchEvents(searchParams())

    expect(result.events).toHaveLength(0)
  })

  it('excludes events the mapper cannot convert (mapper returns null)', async () => {
    const unmappable = rawEvent({ _embedded: { venues: [] } }) // eligible, but no usable venue
    mockedFetchEvents.mockResolvedValue(searchResponse({ _embedded: { events: [unmappable] } }))

    const result = await ticketmasterProvider.searchEvents(searchParams())

    expect(result.events).toHaveLength(0)
  })
})

describe('ticketmasterProvider.searchEvents — errors', () => {
  it('propagates client/API errors rather than returning empty results', async () => {
    mockedFetchEvents.mockRejectedValue(new TicketmasterRequestError('boom', 500))

    await expect(ticketmasterProvider.searchEvents(searchParams())).rejects.toBeInstanceOf(TicketmasterRequestError)
  })
})

describe('ticketmasterProvider.getEventById', () => {
  it('fetches by external id and maps an eligible event', async () => {
    mockedFetchEventById.mockResolvedValue(rawEvent())

    const result = await ticketmasterProvider.getEventById('tm-1')

    expect(mockedFetchEventById).toHaveBeenCalledWith('tm-1')
    expect(result?.name).toBe('Test Event')
  })

  it('returns null for an ineligible event', async () => {
    mockedFetchEventById.mockResolvedValue(
      rawEvent({
        dates: {
          start: { dateTime: '2026-09-18T09:00:00Z' },
          timezone: 'Europe/Madrid',
          access: { startDateTime: '2026-07-20T15:04:14Z' },
        },
      }),
    )

    const result = await ticketmasterProvider.getEventById('tm-1')

    expect(result).toBeNull()
  })

  it('returns null when the event is not found (404)', async () => {
    mockedFetchEventById.mockRejectedValue(new TicketmasterRequestError('Not Found', 404))

    const result = await ticketmasterProvider.getEventById('missing')

    expect(result).toBeNull()
  })

  it('propagates non-404 client/API errors', async () => {
    mockedFetchEventById.mockRejectedValue(new TicketmasterRequestError('boom', 500))

    await expect(ticketmasterProvider.getEventById('tm-1')).rejects.toBeInstanceOf(TicketmasterRequestError)
  })
})
