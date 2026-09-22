import { getCityConfig } from '../../domain/cities'
import type { EventSearchParams } from '../../domain/events/provider'
import type { SearchUrlState } from './searchUrlState'

/**
 * Converts URL-level search state into the provider contract, given an
 * explicit reference instant (never read from the system clock here, so
 * this stays deterministic and testable).
 *
 * Returns `null` — same idiom as `mapTicketmasterEvent`/`mapJamBaseEvent` —
 * when `state` cannot legitimately be represented as `EventSearchParams`,
 * rather than fabricating something incorrect: `EventSearchParams.location`
 * is required and has no "unspecified" variant, and a `citySlug` with no
 * entry in the shared city config (`domain/cities`) is not a city this
 * product can search. This function does not know or care *why* a slug is
 * unsupported (typo vs. a real city just not added yet) and does not fall
 * back to any particular city — that would mean inventing a default-city
 * policy this function has no business owning.
 */
export function toEventSearchParams(state: SearchUrlState, referenceTime: string): EventSearchParams | null {
  const { timeMode, citySlug, categories, page } = state

  if (!citySlug || !getCityConfig(citySlug)) {
    return null
  }

  return {
    timeMode,
    referenceTime,
    location: { type: 'city', citySlug },
    categories,
    page,
  }
}
