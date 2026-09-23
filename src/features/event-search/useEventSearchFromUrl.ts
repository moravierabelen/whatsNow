import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { DEFAULT_CITY_SLUG } from '../../domain/cities'
import { useEventSearch } from '../../hooks/useEventSearch'
import type { SearchUrlState } from './searchUrlState'
import { parseSearchUrlState } from './searchUrlState'
import { toEventSearchParams } from './toEventSearchParams'

/** `SearchUrlState` with `citySlug` guaranteed resolved (never undefined) —
 * what `useEventSearchFromUrl` actually hands back, since it always applies
 * the `DEFAULT_CITY_SLUG` fallback before returning. */
export type ResolvedSearchUrlState = SearchUrlState & { citySlug: string }

/**
 * Wires the URL — the source of truth for search state — through to live
 * results: parses `location.search`, resolves the current instant as
 * `referenceTime` (never stored in the URL or in React state), converts to
 * `EventSearchParams`, and hands that to `useEventSearch`.
 *
 * A missing `citySlug` falls back to `DEFAULT_CITY_SLUG` here — the one
 * place this product-level default is applied, so `/` is a working search
 * without writing `city=barcelona` into the URL. An explicitly unknown
 * `citySlug` is left as-is: `toEventSearchParams` still reports that as
 * "not searchable" (`null`) rather than this hook inventing a location.
 *
 * `useSearchParams()`'s returned `URLSearchParams` is itself memoized on
 * `location.search`, so keying off it keeps `referenceTime` (and the params
 * built from it) stable across renders that don't change the URL, and fresh
 * whenever the URL actually changes.
 *
 * Also returns `urlState` (with `citySlug` already defaulted) so callers
 * driving nav UI (TimeNav/CategoryNav/city display) can read it directly
 * instead of re-parsing `location.search` themselves.
 */
export function useEventSearchFromUrl() {
  const [urlSearchParams] = useSearchParams()

  const { eventSearchParams, urlState } = useMemo(() => {
    const state = parseSearchUrlState(urlSearchParams)
    const resolvedState: ResolvedSearchUrlState = { ...state, citySlug: state.citySlug ?? DEFAULT_CITY_SLUG }
    const referenceTime = new Date().toISOString()
    return {
      urlState: resolvedState,
      eventSearchParams: toEventSearchParams(resolvedState, referenceTime),
    }
  }, [urlSearchParams])

  return { ...useEventSearch(eventSearchParams), urlState }
}
