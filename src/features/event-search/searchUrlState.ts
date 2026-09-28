import type { EventCategory } from '../../domain/events/event'
import type { TimeMode } from '../../domain/events/provider'

/**
 * Canonical, shareable URL state for event search — deliberately separate
 * from `EventSearchParams`. It's missing `referenceTime` (resolved from the
 * current instant when building `EventSearchParams`, not something a URL
 * should freeze) and represents location only as an opaque `citySlug`
 * (coordinates/geolocation are out of scope).
 */
export interface SearchUrlState {
  timeMode: TimeMode
  categories?: EventCategory[]
  citySlug?: string
}

const DEFAULT_TIME_MODE: TimeMode = 'now'

const VALID_TIME_MODES: readonly TimeMode[] = ['now', 'tonight', 'today', 'tomorrow', 'weekend']

/**
 * Canonical ordering for the `category` URL param — declaration order of
 * `EventCategory`, so serialization is deterministic regardless of the
 * order categories were selected/passed in.
 */
const CATEGORY_ORDER: readonly EventCategory[] = ['music', 'sports', 'arts-and-theatre', 'film', 'family', 'other']

function isValidTimeMode(value: string): value is TimeMode {
  return (VALID_TIME_MODES as readonly string[]).includes(value)
}

function isValidCategory(value: string): value is EventCategory {
  return (CATEGORY_ORDER as readonly string[]).includes(value)
}

/** Dedupes and sorts into canonical order; empty result becomes `undefined` (no filter). */
function normalizeCategories(categories: EventCategory[]): EventCategory[] | undefined {
  const unique = new Set(categories)
  const canonical = CATEGORY_ORDER.filter((category) => unique.has(category))
  return canonical.length > 0 ? canonical : undefined
}

export function parseSearchUrlState(params: URLSearchParams): SearchUrlState {
  const rawMode = params.get('mode')
  const timeMode = rawMode !== null && isValidTimeMode(rawMode) ? rawMode : DEFAULT_TIME_MODE

  const rawCategory = params.get('category')
  const categories = rawCategory
    ? normalizeCategories(
        rawCategory
          .split(',')
          .map((value) => value.trim())
          .filter(isValidCategory),
      )
    : undefined

  const rawCity = params.get('city')
  const citySlug = rawCity && rawCity.length > 0 ? rawCity : undefined

  return { timeMode, categories, citySlug }
}

export function serializeSearchUrlState(state: SearchUrlState): URLSearchParams {
  const params = new URLSearchParams()

  if (state.timeMode !== DEFAULT_TIME_MODE) {
    params.set('mode', state.timeMode)
  }

  const categories = state.categories ? normalizeCategories(state.categories) : undefined
  if (categories) {
    params.set('category', categories.join(','))
  }

  if (state.citySlug) {
    params.set('city', state.citySlug)
  }

  return params
}
