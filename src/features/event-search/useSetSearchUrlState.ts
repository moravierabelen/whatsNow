import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { serializeSearchUrlState } from './searchUrlState'
import type { SearchUrlState } from './searchUrlState'

/**
 * The write side of the URL-as-source-of-truth contract: future UI controls
 * call the returned `setSearchUrlState` with a full `SearchUrlState`, which
 * is serialized to its canonical form (default values omitted, categories
 * in canonical order) and pushed via React Router's own search params
 * setter — never `window.history` directly, and no local state is kept.
 */
export function useSetSearchUrlState() {
  const [, setUrlSearchParams] = useSearchParams()

  return useCallback(
    (nextState: SearchUrlState) => {
      setUrlSearchParams(serializeSearchUrlState(nextState))
    },
    [setUrlSearchParams],
  )
}
