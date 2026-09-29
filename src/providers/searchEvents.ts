import type { EventProviderId } from '../domain/events/event'
import type { EventSearchParams, EventSearchResult } from '../domain/events/provider'
import { deduplicateEvents } from './deduplicateEvents'
import { jamBaseProvider } from './jambase/provider'
import { ticketmasterProvider } from './ticketmaster/provider'

export interface AggregatedSearchResult extends EventSearchResult {
  /** Sources that failed outright, so callers can say the result is partial. */
  failedProviders: EventProviderId[]
}

/**
 * Queries both providers in parallel and merges them, Ticketmaster first.
 * Losing one provider does not fail the search; losing all of them does, so
 * "no events" and "nothing answered" never look the same to the user.
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
