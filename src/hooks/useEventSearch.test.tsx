import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EventPage, EventLocation, EventSearchParams } from '../domain/events/provider'
import { searchEvents } from '../providers/searchEvents'
import { eventSearchQueryKey, useEventSearch } from './useEventSearch'

vi.mock('../providers/searchEvents', () => ({
  searchEvents: vi.fn(),
}))

const mockedSearchEvents = vi.mocked(searchEvents)

// A fresh QueryClient per render keeps tests isolated from each other's
// cache. `retry: false` here is test-harness only (keeps the error-state
// test from waiting through real retries/backoff) — it does not change
// src/lib/queryClient.ts or the hook's own (default) behavior.
function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const BARCELONA: EventLocation = { type: 'city', citySlug: 'barcelona' }

function params(overrides: Partial<EventSearchParams> = {}): EventSearchParams {
  return { timeMode: 'today', referenceTime: '2026-09-19T13:00:00Z', location: BARCELONA, ...overrides }
}

const emptyPage: EventPage = { events: [], hasNextPage: false }

afterEach(() => {
  vi.clearAllMocks()
})

describe('eventSearchQueryKey', () => {
  it('builds a stable key from all relevant params', () => {
    const key = eventSearchQueryKey(params({ categories: ['music'], page: 2 }))

    expect(key).toEqual([
      'events',
      {
        timeMode: 'today',
        referenceTime: '2026-09-19T13:00:00Z',
        location: BARCELONA,
        categories: ['music'],
        page: 2,
      },
    ])
  })

  it('produces the same key when categories are given in a different order', () => {
    const keyA = eventSearchQueryKey(params({ categories: ['music', 'sports'] }))
    const keyB = eventSearchQueryKey(params({ categories: ['sports', 'music'] }))

    expect(keyA).toEqual(keyB)
  })

  it('changes when timeMode changes', () => {
    const keyA = eventSearchQueryKey(params({ timeMode: 'today' }))
    const keyB = eventSearchQueryKey(params({ timeMode: 'weekend' }))

    expect(keyA).not.toEqual(keyB)
  })

  it('changes when referenceTime changes', () => {
    const keyA = eventSearchQueryKey(params({ referenceTime: '2026-09-19T13:00:00Z' }))
    const keyB = eventSearchQueryKey(params({ referenceTime: '2026-09-20T13:00:00Z' }))

    expect(keyA).not.toEqual(keyB)
  })

  it('changes when location changes', () => {
    const keyA = eventSearchQueryKey(params({ location: BARCELONA }))
    const keyB = eventSearchQueryKey(
      params({ location: { type: 'coordinates', coordinates: { latitude: 41.38, longitude: 2.17 }, radiusKm: 5 } }),
    )

    expect(keyA).not.toEqual(keyB)
  })

  it('changes when the set of categories changes', () => {
    const keyA = eventSearchQueryKey(params({ categories: ['music'] }))
    const keyB = eventSearchQueryKey(params({ categories: ['music', 'sports'] }))

    expect(keyA).not.toEqual(keyB)
  })

  it('changes when page changes', () => {
    const keyA = eventSearchQueryKey(params({ page: 1 }))
    const keyB = eventSearchQueryKey(params({ page: 2 }))

    expect(keyA).not.toEqual(keyB)
  })
})

describe('useEventSearch', () => {
  it('calls searchEvents with the exact same params', async () => {
    mockedSearchEvents.mockResolvedValue(emptyPage)
    const searchParams = params({ categories: ['music'], page: 2 })

    renderHook(() => useEventSearch(searchParams), { wrapper: createWrapper() })

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledWith(searchParams))
  })

  it('exposes a pending state before the query resolves', () => {
    mockedSearchEvents.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useEventSearch(params()), { wrapper: createWrapper() })

    expect(result.current.isPending).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('exposes data from TanStack Query once the search resolves', async () => {
    const page: EventPage = { events: [], hasNextPage: true }
    mockedSearchEvents.mockResolvedValue(page)

    const { result } = renderHook(() => useEventSearch(params()), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(page)
  })

  it('exposes an error state when searchEvents rejects', async () => {
    mockedSearchEvents.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useEventSearch(params()), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('does not call searchEvents when params is null', () => {
    const { result } = renderHook(() => useEventSearch(null), { wrapper: createWrapper() })

    expect(mockedSearchEvents).not.toHaveBeenCalled()
    expect(result.current.isPending).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
  })
})
