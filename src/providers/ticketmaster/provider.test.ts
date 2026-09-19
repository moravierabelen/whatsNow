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
  it('translates domain page 1 to Ticketmaster page 0 when page is omitted', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    await ticketmasterProvider.searchEvents(searchParams({ page: undefined }))

    expect(mockedFetchEvents.mock.calls[0][0].page).toBe('0')
  })

  it('translates subsequent domain pages correctly', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    await ticketmasterProvider.searchEvents(searchParams({ page: 3 }))

    expect(mockedFetchEvents.mock.calls[0][0].page).toBe('2')
  })

  it('computes hasNextPage from Ticketmaster pagination metadata', async () => {
    mockedFetchEvents.mockResolvedValue(
      searchResponse({ page: { size: 20, totalElements: 60, totalPages: 3, number: 0 } }),
    )

    const result = await ticketmasterProvider.searchEvents(searchParams())

    expect(result.hasNextPage).toBe(true)
  })

  it('reports hasNextPage as false on the last page', async () => {
    mockedFetchEvents.mockResolvedValue(
      searchResponse({ page: { size: 20, totalElements: 60, totalPages: 3, number: 2 } }),
    )

    const result = await ticketmasterProvider.searchEvents(searchParams())

    expect(result.hasNextPage).toBe(false)
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
