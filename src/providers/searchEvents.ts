import type { EventPage, EventSearchParams } from '../domain/events/provider'
import { jamBaseProvider } from './jambase/provider'
import { ticketmasterProvider } from './ticketmaster/provider'

/**
 * Combines Ticketmaster and JamBase results for the same search into a
 * single EventPage. Deliberately minimal for the MVP — not a registry, not
 * a repository, just two explicit provider calls merged:
 *
 * - both providers are queried in parallel with the exact same params;
 * - if either provider throws, the whole search fails — no partial
 *   results, no silent fallback, no retry;
 * - events are concatenated Ticketmaster-first, then JamBase, each
 *   preserving its own provider's internal order; no cross-provider
 *   deduplication is attempted (`Event.id` already encodes source identity,
 *   so equivalent listings from both providers may coexist for now);
 * - `page` is requested identically from both providers — this is "ask
 *   both for their own page N", not a true merged/balanced pagination
 *   cursor across sources;
 * - `hasNextPage` is true if *either* provider still has more results,
 *   since there is no single combined cursor to report against.
 */
export async function searchEvents(params: EventSearchParams): Promise<EventPage> {
  const [ticketmasterPage, jamBasePage] = await Promise.all([
    ticketmasterProvider.searchEvents(params),
    jamBaseProvider.searchEvents(params),
  ])

  return {
    events: [...ticketmasterPage.events, ...jamBasePage.events],
    hasNextPage: ticketmasterPage.hasNextPage || jamBasePage.hasNextPage,
  }
}
