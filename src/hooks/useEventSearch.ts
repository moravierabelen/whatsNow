import { skipToken, useQuery } from '@tanstack/react-query'
import type { EventSearchParams } from '../domain/events/provider'
import { searchEvents } from '../providers/searchEvents'

/**
 * Explicit, so the key only reflects the parameters that actually change the
 * result — not `params` directly, which would also work today (its shape
 * happens to match 1:1) but would silently start including anything added
 * to `EventSearchParams` later without a deliberate decision here.
 *
 * `categories` is order-normalized: the same set of categories in a
 * different order must produce the same key, without altering what's
 * actually sent to `searchEvents`.
 */
export function eventSearchQueryKey(params: EventSearchParams) {
  return [
    'events',
    {
      timeMode: params.timeMode,
      referenceTime: params.referenceTime,
      location: params.location,
      categories: params.categories ? [...params.categories].sort() : undefined,
      page: params.page,
    },
  ] as const
}

/**
 * Accepts `null` for callers (e.g. URL-driven search) that may not yet have
 * a valid `EventSearchParams` — `toEventSearchParams` returns `null` for a
 * missing/unsupported city. `skipToken` is TanStack Query's own idiom for
 * "don't run this query yet", so the query is disabled without inventing a
 * fake `EventSearchParams` or reaching for `enabled` + a non-null assertion.
 */
export function useEventSearch(params: EventSearchParams | null) {
  return useQuery({
    queryKey: params ? eventSearchQueryKey(params) : (['events', 'disabled'] as const),
    queryFn: params ? () => searchEvents(params) : skipToken,
  })
}
