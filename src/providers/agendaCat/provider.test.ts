import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EventLocation, EventSearchParams } from '../../domain/events/provider'
import { fetchAgendaCatEventByRowId, fetchAgendaCatEvents } from './client'
import { agendaCatProvider } from './provider'
import type { AgendaCatEvent } from './types'

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>()
  return { ...actual, fetchAgendaCatEvents: vi.fn(), fetchAgendaCatEventByRowId: vi.fn() }
})

const mockedFetch = vi.mocked(fetchAgendaCatEvents)
const mockedFetchById = vi.mocked(fetchAgendaCatEventByRowId)

const BARCELONA: EventLocation = { type: 'city', citySlug: 'barcelona' }
const REFERENCE_TIME = '2026-09-15T10:00:00Z' // Tuesday, 12:00 in Europe/Madrid

function row(overrides: Partial<AgendaCatEvent> = {}): AgendaCatEvent {
  return {
    ':id': 'row-1',
    denominaci: 'Concert',
    data_inici: '2026-09-15T00:00:00.000',
    data_fi: '2026-09-15T00:00:00.000',
    espai: 'Sala Apolo',
    latitud: '41.3745',
    longitud: '2.1686',
    tags_categor_es: 'agenda:categories/concerts',
    ...overrides,
  }
}

function searchParams(overrides: Partial<EventSearchParams> = {}): EventSearchParams {
  return { timeMode: 'today', referenceTime: REFERENCE_TIME, location: BARCELONA, ...overrides }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('agendaCatProvider.searchEvents — location', () => {
  it('translates the city into the dataset own municipi vocabulary', async () => {
    mockedFetch.mockResolvedValue([])

    await agendaCatProvider.searchEvents(searchParams())

    expect(mockedFetch.mock.calls[0][0].$where).toContain(
      "municipi='agenda:ubicacions/barcelona/barcelones/barcelona'",
    )
  })

  it('throws for a city this dataset does not cover', async () => {
    await expect(
      agendaCatProvider.searchEvents(searchParams({ location: { type: 'city', citySlug: 'madrid' } })),
    ).rejects.toThrow('Unsupported city: madrid')
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it('throws for coordinate-based search, which is not supported yet', async () => {
    await expect(
      agendaCatProvider.searchEvents(
        searchParams({ location: { type: 'coordinates', coordinates: { latitude: 41, longitude: 2 }, radiusKm: 5 } }),
      ),
    ).rejects.toThrow('Coordinate-based search is not yet supported')
  })
})

describe('agendaCatProvider.searchEvents — temporal window', () => {
  it('asks for runs that overlap the window, not ones that start inside it', async () => {
    mockedFetch.mockResolvedValue([])

    await agendaCatProvider.searchEvents(searchParams({ timeMode: 'today' }))

    const { $where } = mockedFetch.mock.calls[0][0]
    expect($where).toContain("data_inici<='2026-09-15T23:59:59'")
    expect($where).toContain("data_fi>='2026-09-15T00:00:00'")
  })

  it('does not let a midnight window boundary pull in the next day', async () => {
    mockedFetch.mockResolvedValue([])

    await agendaCatProvider.searchEvents(searchParams({ timeMode: 'tomorrow' }))

    const { $where } = mockedFetch.mock.calls[0][0]
    expect($where).toContain("data_inici<='2026-09-16T23:59:59'")
    expect($where).toContain("data_fi>='2026-09-16T00:00:00'")
  })

  it('covers both calendar days that Tonight spans', async () => {
    mockedFetch.mockResolvedValue([])

    // Saturday 15:00 local -> Tonight is Sat 18:00 to Sun 06:00.
    await agendaCatProvider.searchEvents(searchParams({ timeMode: 'tonight', referenceTime: '2026-09-19T13:00:00Z' }))

    const { $where } = mockedFetch.mock.calls[0][0]
    expect($where).toContain("data_fi>='2026-09-19T00:00:00'")
    expect($where).toContain("data_inici<='2026-09-20T23:59:59'")
  })
})

describe('agendaCatProvider.searchEvents — pagination', () => {
  function page(size: number, idPrefix: string): AgendaCatEvent[] {
    return Array.from({ length: size }, (_, i) => row({ ':id': `${idPrefix}-${i}` }))
  }

  it('orders the query, since offset paging without it can skip or repeat rows', async () => {
    mockedFetch.mockResolvedValue([])

    await agendaCatProvider.searchEvents(searchParams())

    expect(mockedFetch.mock.calls[0][0].$order).toBe(':id')
  })

  it('makes a single request when the first page is short', async () => {
    mockedFetch.mockResolvedValue([row()])

    const result = await agendaCatProvider.searchEvents(searchParams())

    expect(mockedFetch).toHaveBeenCalledTimes(1)
    expect(result.events).toHaveLength(1)
    expect(result.truncated).toBe(false)
  })

  it('keeps paging while pages come back full, advancing the offset', async () => {
    mockedFetch.mockResolvedValueOnce(page(1000, 'a')).mockResolvedValueOnce(page(2, 'b'))

    const result = await agendaCatProvider.searchEvents(searchParams())

    expect(mockedFetch).toHaveBeenCalledTimes(2)
    expect(mockedFetch.mock.calls.map((call) => call[0].$offset)).toEqual(['0', '1000'])
    expect(result.events).toHaveLength(1002)
    expect(result.truncated).toBe(false)
  })

  it('stops at the safety limit and reports the result as truncated', async () => {
    mockedFetch.mockResolvedValue(page(1000, 'x'))

    const result = await agendaCatProvider.searchEvents(searchParams())

    expect(mockedFetch).toHaveBeenCalledTimes(5)
    expect(result.truncated).toBe(true)
  })
})

describe('agendaCatProvider.searchEvents — errors', () => {
  it('propagates client errors rather than returning empty results', async () => {
    mockedFetch.mockRejectedValue(new Error('boom'))

    await expect(agendaCatProvider.searchEvents(searchParams())).rejects.toThrow('boom')
  })
})

describe('agendaCatProvider.getEventById', () => {
  it('maps the matching row', async () => {
    mockedFetchById.mockResolvedValue([row({ ':id': 'row-42' })])

    const result = await agendaCatProvider.getEventById('row-42')

    expect(result?.source.externalId).toBe('row-42')
  })

  it('returns null for an unknown id, which the dataset answers with no rows', async () => {
    mockedFetchById.mockResolvedValue([])

    expect(await agendaCatProvider.getEventById('row-nope')).toBeNull()
  })
})
