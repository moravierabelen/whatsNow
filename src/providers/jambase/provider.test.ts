import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EventLocation, EventSearchParams } from '../../domain/events/provider'
import { JamBaseRequestError, fetchJamBaseEventById, fetchJamBaseEvents } from './client'
import { jamBaseProvider } from './provider'
import type { JamBaseEvent, JamBaseEventSearchResponse } from './types'

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>()
  return {
    ...actual,
    fetchJamBaseEvents: vi.fn(),
    fetchJamBaseEventById: vi.fn(),
  }
})

const mockedFetchEvents = vi.mocked(fetchJamBaseEvents)
const mockedFetchEventById = vi.mocked(fetchJamBaseEventById)

const BARCELONA: EventLocation = { type: 'city', citySlug: 'barcelona' }
const REFERENCE_TIME = '2026-09-15T10:00:00Z' // Tuesday, Europe/Madrid

function searchResponse(overrides: Partial<JamBaseEventSearchResponse> = {}): JamBaseEventSearchResponse {
  return {
    success: true,
    pagination: { page: 1, perPage: 20, totalItems: 0, totalPages: 0, nextPage: null, previousPage: null },
    events: [],
    ...overrides,
  }
}

function rawEvent(overrides: Partial<JamBaseEvent> = {}): JamBaseEvent {
  return {
    identifier: 'jambase:16309935',
    name: 'Fritz Kalkbrenner at SEASEACLUB',
    url: 'https://www.jambase.com/show/fritz-kalkbrenner-go-beach-club-barcelona-20260919',
    startDate: '2026-09-19T16:30:00',
    endDate: '2026-09-19',
    location: {
      name: 'SEASEACLUB',
      address: { streetAddress: '14P Carrer del Port Esportiu', addressLocality: 'Barcelona', 'x-timezone': 'Europe/Madrid' },
      geo: { latitude: 41.4138, longitude: 2.2293 },
    },
    offers: [{ url: 'https://link.dice.fm/xe95d6dc4cdf', category: 'ticketingLinkPrimary', priceSpecification: {} }],
    performer: [{ genre: ['edm'] }],
    ...overrides,
  }
}

function searchParams(overrides: Partial<EventSearchParams> = {}): EventSearchParams {
  return {
    timeMode: 'today',
    referenceTime: REFERENCE_TIME,
    location: BARCELONA,
    ...overrides,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('jamBaseProvider.searchEvents — location', () => {
  it('translates the Barcelona city location into coordinates + radius', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    await jamBaseProvider.searchEvents(searchParams({ location: BARCELONA }))
    const query = mockedFetchEvents.mock.calls[0][0]

    expect(query.geoLatitude).toBe('41.3851')
    expect(query.geoLongitude).toBe('2.1734')
    expect(query.geoRadiusAmount).toBe('15')
    expect(query.geoRadiusUnits).toBe('km')
  })

  it('throws for an unsupported city', async () => {
    await expect(
      jamBaseProvider.searchEvents(searchParams({ location: { type: 'city', citySlug: 'madrid' } })),
    ).rejects.toThrow('Unsupported city: madrid')
    expect(mockedFetchEvents).not.toHaveBeenCalled()
  })

  it('throws an explicit error for coordinate-based search, which is not yet supported', async () => {
    await expect(
      jamBaseProvider.searchEvents(
        searchParams({ location: { type: 'coordinates', coordinates: { latitude: 41.38, longitude: 2.17 }, radiusKm: 5 } }),
      ),
    ).rejects.toThrow('Coordinate-based search is not yet supported')
    expect(mockedFetchEvents).not.toHaveBeenCalled()
  })
})

describe('jamBaseProvider.searchEvents — temporal window', () => {
  it('uses the same date range for now and today', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    await jamBaseProvider.searchEvents(searchParams({ timeMode: 'now' }))
    const nowQuery = mockedFetchEvents.mock.calls[0][0]
    await jamBaseProvider.searchEvents(searchParams({ timeMode: 'today' }))
    const todayQuery = mockedFetchEvents.mock.calls[1][0]

    expect(nowQuery.eventDateFrom).toBe('2026-09-15')
    expect(nowQuery.eventDateTo).toBe('2026-09-15')
    expect(nowQuery).toEqual(todayQuery)
  })

  it('resolves Today to a single inclusive date, not the next day', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    await jamBaseProvider.searchEvents(searchParams({ timeMode: 'today' }))

    expect(mockedFetchEvents.mock.calls[0][0]).toMatchObject({ eventDateFrom: '2026-09-15', eventDateTo: '2026-09-15' })
  })

  it('resolves Tomorrow to a single inclusive date', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    await jamBaseProvider.searchEvents(searchParams({ timeMode: 'tomorrow' }))

    expect(mockedFetchEvents.mock.calls[0][0]).toMatchObject({ eventDateFrom: '2026-09-16', eventDateTo: '2026-09-16' })
  })

  it('resolves Weekend to the Friday-through-Sunday inclusive date range', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    await jamBaseProvider.searchEvents(searchParams({ timeMode: 'weekend' }))

    expect(mockedFetchEvents.mock.calls[0][0]).toMatchObject({ eventDateFrom: '2026-09-18', eventDateTo: '2026-09-20' })
  })

  it('resolves Tonight to the two calendar dates it spans, queried in the afternoon', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    // Saturday 15:00 local -> Tonight = Sat 18:00 -> Sun 06:00, no clamping needed.
    await jamBaseProvider.searchEvents(searchParams({ timeMode: 'tonight', referenceTime: '2026-09-19T13:00:00Z' }))

    expect(mockedFetchEvents.mock.calls[0][0]).toMatchObject({ eventDateFrom: '2026-09-19', eventDateTo: '2026-09-20' })
  })

  it('clamps eventDateFrom to today when Tonight is still inside its early-morning tail', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    // Sunday 01:00 local -> still Sat18:00->Sun06:00 window, but Saturday is
    // now in the past relative to JamBase's own "today" (Sunday). The
    // Developer tier rejects a past eventDateFrom, so it must be clamped.
    await jamBaseProvider.searchEvents(searchParams({ timeMode: 'tonight', referenceTime: '2026-09-19T23:00:00Z' }))

    expect(mockedFetchEvents.mock.calls[0][0]).toMatchObject({ eventDateFrom: '2026-09-20', eventDateTo: '2026-09-20' })
  })

  it('rolls Tonight forward to the next night once queried after it has closed', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    // Sunday 10:00 local -> Tonight becomes Sun 18:00 -> Mon 06:00.
    await jamBaseProvider.searchEvents(searchParams({ timeMode: 'tonight', referenceTime: '2026-09-20T08:00:00Z' }))

    expect(mockedFetchEvents.mock.calls[0][0]).toMatchObject({ eventDateFrom: '2026-09-20', eventDateTo: '2026-09-21' })
  })
})

describe('jamBaseProvider.searchEvents — pagination', () => {
  it('passes the domain page directly, without translating it', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    await jamBaseProvider.searchEvents(searchParams({ page: 3 }))

    expect(mockedFetchEvents.mock.calls[0][0].page).toBe('3')
  })

  it('defaults to page 1 when page is omitted', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    await jamBaseProvider.searchEvents(searchParams({ page: undefined }))

    expect(mockedFetchEvents.mock.calls[0][0].page).toBe('1')
  })

  it('computes hasNextPage from JamBase pagination metadata', async () => {
    mockedFetchEvents.mockResolvedValue(
      searchResponse({ pagination: { page: 1, perPage: 20, totalItems: 41, totalPages: 3, nextPage: 'x', previousPage: null } }),
    )

    const result = await jamBaseProvider.searchEvents(searchParams())

    expect(result.hasNextPage).toBe(true)
  })

  it('reports hasNextPage as false on the last page', async () => {
    mockedFetchEvents.mockResolvedValue(
      searchResponse({ pagination: { page: 3, perPage: 20, totalItems: 41, totalPages: 3, nextPage: null, previousPage: 'x' } }),
    )

    const result = await jamBaseProvider.searchEvents(searchParams())

    expect(result.hasNextPage).toBe(false)
  })
})

describe('jamBaseProvider.searchEvents — categories', () => {
  it('skips the request entirely when categories are given and none is music', async () => {
    const result = await jamBaseProvider.searchEvents(searchParams({ categories: ['sports', 'film'] }))

    expect(result).toEqual({ events: [], hasNextPage: false })
    expect(mockedFetchEvents).not.toHaveBeenCalled()
  })

  it('queries normally when categories include music', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    await jamBaseProvider.searchEvents(searchParams({ categories: ['music', 'sports'] }))

    expect(mockedFetchEvents).toHaveBeenCalled()
  })

  it('queries normally when no categories filter is given', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse())

    await jamBaseProvider.searchEvents(searchParams({ categories: undefined }))

    expect(mockedFetchEvents).toHaveBeenCalled()
  })
})

describe('jamBaseProvider.searchEvents — mapping pipeline', () => {
  it('maps and returns mappable events', async () => {
    mockedFetchEvents.mockResolvedValue(searchResponse({ events: [rawEvent()] }))

    const result = await jamBaseProvider.searchEvents(searchParams({ timeMode: 'tonight', referenceTime: '2026-09-19T13:00:00Z' }))

    expect(result.events).toHaveLength(1)
    expect(result.events[0].name).toBe('Fritz Kalkbrenner at SEASEACLUB')
  })

  it('excludes events the mapper cannot convert', async () => {
    const unmappable = rawEvent({ location: undefined })
    mockedFetchEvents.mockResolvedValue(searchResponse({ events: [unmappable] }))

    const result = await jamBaseProvider.searchEvents(searchParams({ timeMode: 'tonight', referenceTime: '2026-09-19T13:00:00Z' }))

    expect(result.events).toHaveLength(0)
  })

  it('re-applies the exact domain window, excluding a candidate that starts after it closes', async () => {
    // JamBase's date-only filter for Tonight (Sat 19th -> Sun 20th) would
    // include this 07:00 event; the exact domain window (18:00 -> 06:00) must
    // not, since its start is already past the window's end.
    //
    // Note: because mapJamBaseEvent never populates `end` (JamBase doesn't
    // provide one), eventOverlapsWindow can only exclude a JamBase candidate
    // this way — by a start at/after the window's end. A same-day daytime
    // event with no known end is NOT excludable this way (unknown end never
    // proves an event is over), so it would still pass through; that's the
    // existing, already-approved asymmetric rule, not new to this provider.
    const afterHoursEvent = rawEvent({ startDate: '2026-09-20T07:00:00' })
    mockedFetchEvents.mockResolvedValue(searchResponse({ events: [afterHoursEvent] }))

    const result = await jamBaseProvider.searchEvents(searchParams({ timeMode: 'tonight', referenceTime: '2026-09-19T13:00:00Z' }))

    expect(result.events).toHaveLength(0)
  })

  it('includes a candidate that genuinely falls within the exact domain window', async () => {
    const lateNightEvent = rawEvent({ startDate: '2026-09-19T23:59:00' })
    mockedFetchEvents.mockResolvedValue(searchResponse({ events: [lateNightEvent] }))

    const result = await jamBaseProvider.searchEvents(searchParams({ timeMode: 'tonight', referenceTime: '2026-09-19T13:00:00Z' }))

    expect(result.events).toHaveLength(1)
  })
})

describe('jamBaseProvider.searchEvents — errors', () => {
  it('propagates client/API errors rather than returning empty results', async () => {
    mockedFetchEvents.mockRejectedValue(new JamBaseRequestError('boom', 500))

    await expect(jamBaseProvider.searchEvents(searchParams())).rejects.toBeInstanceOf(JamBaseRequestError)
  })
})

describe('jamBaseProvider.getEventById', () => {
  it('re-adds the jambase: prefix and maps the returned event', async () => {
    mockedFetchEventById.mockResolvedValue({ success: true, event: rawEvent() })

    const result = await jamBaseProvider.getEventById('16309935')

    expect(mockedFetchEventById).toHaveBeenCalledWith('16309935')
    expect(result?.name).toBe('Fritz Kalkbrenner at SEASEACLUB')
  })

  it('returns null when the event cannot be mapped', async () => {
    mockedFetchEventById.mockResolvedValue({ success: true, event: rawEvent({ location: undefined }) })

    const result = await jamBaseProvider.getEventById('16309935')

    expect(result).toBeNull()
  })

  it('returns null for identifier_invalid (not found)', async () => {
    mockedFetchEventById.mockRejectedValue(new JamBaseRequestError('not found', 400, 'identifier_invalid'))

    const result = await jamBaseProvider.getEventById('9999999999999')

    expect(result).toBeNull()
  })

  it('propagates a 400 with a different error code rather than treating it as not-found', async () => {
    mockedFetchEventById.mockRejectedValue(new JamBaseRequestError('bad request', 400, 'invalid_parameter'))

    await expect(jamBaseProvider.getEventById('16309935')).rejects.toBeInstanceOf(JamBaseRequestError)
  })

  it('propagates non-400 errors', async () => {
    mockedFetchEventById.mockRejectedValue(new JamBaseRequestError('boom', 500))

    await expect(jamBaseProvider.getEventById('16309935')).rejects.toBeInstanceOf(JamBaseRequestError)
  })
})
