import type { EventProviderId } from '../domain/events/event'
import type { EventProvider, EventSearchParams, EventSearchResult } from '../domain/events/provider'
import { agendaCatProvider } from './agendaCat/provider'
import { deduplicateEvents } from './deduplicateEvents'
import { jamBaseProvider } from './jambase/provider'
import { ticketmasterProvider } from './ticketmaster/provider'

export interface AggregatedSearchResult extends EventSearchResult {
  /** Sources that failed outright, so callers can say the result is partial. */
  failedProviders: EventProviderId[]
}

/** Order decides the merged order, and breaks ties when deduplicating. */
const PROVIDERS: EventProvider[] = [ticketmasterProvider, jamBaseProvider, agendaCatProvider]

/**
 * Queries every provider in parallel and merges them. Losing one does not fail
 * the search; losing all of them does, so "no events" and "nothing answered"
 * never look the same to the user.
 */
export async function searchEvents(params: EventSearchParams): Promise<AggregatedSearchResult> {
  const settled = await Promise.allSettled(PROVIDERS.map((provider) => provider.searchEvents(params)))

  const failedProviders = PROVIDERS.filter((_, index) => settled[index].status === 'rejected').map(
    (provider) => provider.id,
  )
  if (failedProviders.length === PROVIDERS.length) {
    throw (settled[0] as PromiseRejectedResult).reason
  }

  const succeeded = settled.filter(
    (outcome): outcome is PromiseFulfilledResult<EventSearchResult> => outcome.status === 'fulfilled',
  )

  return {
    events: deduplicateEvents(succeeded.flatMap((outcome) => outcome.value.events)),
    truncated: succeeded.some((outcome) => outcome.value.truncated),
    failedProviders,
  }
}
