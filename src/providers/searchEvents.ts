import type { EventProviderId } from '../domain/events/event'
import type { EventSearchParams, EventSearchResult } from '../domain/events/provider'
import { deduplicateEvents } from './deduplicateEvents'
import { jamBaseProvider } from './jambase/provider'
import { ticketmasterProvider } from './ticketmaster/provider'

export interface AggregatedSearchResult extends EventSearchResult {
  /**
   * Sources that failed outright, empty when every one answered. A search
   * survives losing a provider — the events from the others are still real
   * and worth showing — but the caller has to be able to say so, rather
   * than passing a short list off as the whole picture.
   */
  failedProviders: EventProviderId[]
}

/**
 * Combines Ticketmaster and JamBase results for the same search into a
 * single result. Deliberately minimal for the MVP — not a registry, not a
 * repository, just two explicit provider calls merged:
 *
 * - both providers are queried in parallel with the exact same params;
 * - one provider failing does not fail the search: the others' events are
 *   still returned, and the failure is reported in `failedProviders`. Only
 *   *every* source failing throws, because "no events" and "nothing
 *   answered" must not look the same to the user;
 * - events are concatenated Ticketmaster-first, then JamBase, each
 *   preserving its own provider's internal order, then passed through
 *   `deduplicateEvents` — a conservative, explainable heuristic (same
 *   known start time + nearby venue + matching non-venue name vocabulary),
 *   not a guarantee every cross-provider duplicate is caught;
 * - each provider exhausts its own pagination internally, so both results
 *   are already complete sets rather than page N of anything;
 * - `truncated` is true if *either* provider had to stop short of its own
 *   full result set (see `EventSearchResult.truncated`), since the combined
 *   result is then incomplete regardless of which source cut off.
 */
export async function searchEvents(params: EventSearchParams): Promise<AggregatedSearchResult> {
  const [ticketmaster, jamBase] = await Promise.allSettled([
    ticketmasterProvider.searchEvents(params),
    jamBaseProvider.searchEvents(params),
  ])

  if (ticketmaster.status === 'rejected' && jamBase.status === 'rejected') {
    throw ticketmaster.reason
  }

  const failedProviders: EventProviderId[] = []
  if (ticketmaster.status === 'rejected') failedProviders.push(ticketmasterProvider.id)
  if (jamBase.status === 'rejected') failedProviders.push(jamBaseProvider.id)

  return {
    events: deduplicateEvents([
      ...(ticketmaster.status === 'fulfilled' ? ticketmaster.value.events : []),
      ...(jamBase.status === 'fulfilled' ? jamBase.value.events : []),
    ]),
    truncated:
      (ticketmaster.status === 'fulfilled' && ticketmaster.value.truncated) ||
      (jamBase.status === 'fulfilled' && jamBase.value.truncated),
    failedProviders,
  }
}
