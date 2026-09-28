import { QueryClient } from '@tanstack/react-query'

/**
 * Five minutes, rather than TanStack Query's default of 0.
 *
 * With the default, results are stale the moment they arrive, so simply
 * tabbing away and back refetches the whole search — and a search is now
 * every page each provider holds, not just the first. Event listings do not
 * change minute to minute, and the reference instant is captured per search
 * anyway, so a few minutes of reuse costs nothing the user would notice.
 */
const STALE_TIME_MS = 5 * 60 * 1000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: STALE_TIME_MS },
  },
})
