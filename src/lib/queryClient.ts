import { QueryClient } from '@tanstack/react-query'

/** Without this, tabbing away and back refetches every page of every provider. */
const STALE_TIME_MS = 5 * 60 * 1000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: STALE_TIME_MS },
  },
})
