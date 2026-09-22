import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventPage } from '../../domain/events/provider'
import { searchEvents } from '../../providers/searchEvents'
import { serializeSearchUrlState } from './searchUrlState'
import type { SearchUrlState } from './searchUrlState'
import { useEventSearchFromUrl } from './useEventSearchFromUrl'
import { useSetSearchUrlState } from './useSetSearchUrlState'

vi.mock('../../providers/searchEvents', () => ({
  searchEvents: vi.fn(),
}))

const mockedSearchEvents = vi.mocked(searchEvents)
const emptyPage: EventPage = { events: [], hasNextPage: false }

/**
 * Exercises `useEventSearchFromUrl` and `useSetSearchUrlState` together,
 * exactly as a future UI component would use them: reading derived search
 * state/results and writing new URL state through the same router.
 */
function useTestHarness() {
  return {
    query: useEventSearchFromUrl(),
    setSearchUrlState: useSetSearchUrlState(),
    location: useLocation(),
    navigate: useNavigate(),
  }
}

function createWrapper(initialEntries: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }
}

beforeEach(() => {
  mockedSearchEvents.mockResolvedValue(emptyPage)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('useEventSearchFromUrl — reading state', () => {
  it('resolves an empty URL to now + Barcelona + page 1 + no categories', async () => {
    renderHook(() => useTestHarness(), { wrapper: createWrapper(['/']) })

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))
    const params = mockedSearchEvents.mock.calls[0][0]
    expect(params.timeMode).toBe('now')
    expect(params.location).toEqual({ type: 'city', citySlug: 'barcelona' })
    expect(params.page).toBe(1)
    expect(params.categories).toBeUndefined()
  })

  it('produces the same search for an explicit city=barcelona as for no city at all', async () => {
    renderHook(() => useTestHarness(), { wrapper: createWrapper(['/?city=barcelona']) })

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))
    expect(mockedSearchEvents.mock.calls[0][0].location).toEqual({ type: 'city', citySlug: 'barcelona' })
  })

  it('resolves mode=tonight', async () => {
    renderHook(() => useTestHarness(), { wrapper: createWrapper(['/?mode=tonight']) })

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))
    expect(mockedSearchEvents.mock.calls[0][0].timeMode).toBe('tonight')
  })

  it('resolves categories from the URL', async () => {
    renderHook(() => useTestHarness(), { wrapper: createWrapper(['/?category=music,film']) })

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))
    expect(mockedSearchEvents.mock.calls[0][0].categories).toEqual(['music', 'film'])
  })

  it('resolves page from the URL', async () => {
    renderHook(() => useTestHarness(), { wrapper: createWrapper(['/?page=3']) })

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))
    expect(mockedSearchEvents.mock.calls[0][0].page).toBe(3)
  })

  it('resolves several params given together', async () => {
    renderHook(() => useTestHarness(), {
      wrapper: createWrapper(['/?mode=weekend&category=music,film&city=barcelona&page=2']),
    })

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))
    const params = mockedSearchEvents.mock.calls[0][0]
    expect(params.timeMode).toBe('weekend')
    expect(params.categories).toEqual(['music', 'film'])
    expect(params.location).toEqual({ type: 'city', citySlug: 'barcelona' })
    expect(params.page).toBe(2)
  })

  it('falls back to already-established defaults for invalid params', async () => {
    renderHook(() => useTestHarness(), { wrapper: createWrapper(['/?mode=bogus&page=-3&category=nonsense']) })

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))
    const params = mockedSearchEvents.mock.calls[0][0]
    expect(params.timeMode).toBe('now')
    expect(params.page).toBe(1)
    expect(params.categories).toBeUndefined()
  })

  it('generates referenceTime from the current instant and passes it through, without putting it in the URL', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-09-21T12:00:00.000Z'))

    const { result } = renderHook(() => useTestHarness(), { wrapper: createWrapper(['/']) })

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))
    expect(mockedSearchEvents.mock.calls[0][0].referenceTime).toBe('2026-09-21T12:00:00.000Z')
    expect(result.current.location.search).not.toContain('referenceTime')
  })

  it('does not execute a search for an explicitly unknown city, and does not invent one', async () => {
    const { result } = renderHook(() => useTestHarness(), { wrapper: createWrapper(['/?city=atlantis']) })

    await waitFor(() => expect(result.current.query.fetchStatus).toBe('idle'))
    expect(mockedSearchEvents).not.toHaveBeenCalled()
  })
})

describe('useEventSearchFromUrl + useSetSearchUrlState — writing state', () => {
  it('produces a canonical URL for the given state', async () => {
    const { result } = renderHook(() => useTestHarness(), { wrapper: createWrapper(['/']) })
    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))

    const nextState: SearchUrlState = {
      timeMode: 'weekend',
      categories: ['film', 'music'],
      citySlug: 'barcelona',
      page: 3,
    }

    act(() => result.current.setSearchUrlState(nextState))

    await waitFor(() => {
      expect(result.current.location.search).toBe(`?${serializeSearchUrlState(nextState).toString()}`)
    })
  })

  it('changing mode changes the search identity', async () => {
    const { result } = renderHook(() => useTestHarness(), { wrapper: createWrapper(['/']) })
    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))

    act(() => result.current.setSearchUrlState({ timeMode: 'weekend', page: 1 }))

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(2))
    expect(mockedSearchEvents.mock.calls[1][0].timeMode).toBe('weekend')
  })

  it('changing categories changes the search identity', async () => {
    const { result } = renderHook(() => useTestHarness(), { wrapper: createWrapper(['/']) })
    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))

    act(() => result.current.setSearchUrlState({ timeMode: 'now', categories: ['sports'], page: 1 }))

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(2))
    expect(mockedSearchEvents.mock.calls[1][0].categories).toEqual(['sports'])
  })

  it('changing city changes the search identity', async () => {
    const { result } = renderHook(() => useTestHarness(), { wrapper: createWrapper(['/']) })
    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))

    act(() => result.current.setSearchUrlState({ timeMode: 'now', citySlug: 'atlantis', page: 1 }))

    await waitFor(() => expect(result.current.query.fetchStatus).toBe('idle'))
    expect(mockedSearchEvents).toHaveBeenCalledTimes(1)
  })

  it('changing page changes the search identity', async () => {
    const { result } = renderHook(() => useTestHarness(), { wrapper: createWrapper(['/']) })
    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))

    act(() => result.current.setSearchUrlState({ timeMode: 'now', page: 2 }))

    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(2))
    expect(mockedSearchEvents.mock.calls[1][0].page).toBe(2)
  })

  it('returning to a previous URL restores its corresponding search', async () => {
    const { result } = renderHook(() => useTestHarness(), { wrapper: createWrapper(['/?mode=today']) })
    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(1))
    expect(mockedSearchEvents.mock.calls[0][0].timeMode).toBe('today')

    act(() => result.current.setSearchUrlState({ timeMode: 'weekend', page: 1 }))
    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(2))
    expect(mockedSearchEvents.mock.calls[1][0].timeMode).toBe('weekend')

    act(() => result.current.navigate(-1))
    await waitFor(() => expect(mockedSearchEvents).toHaveBeenCalledTimes(3))
    expect(mockedSearchEvents.mock.calls[2][0].timeMode).toBe('today')
  })
})
