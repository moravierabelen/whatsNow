import { getCityConfig } from '../domain/cities'
import type { Event, EventProviderId } from '../domain/events/event'
import type {
  EventLocation,
  EventProvider,
  EventSearchParams,
  EventSearchResult,
} from '../domain/events/provider'
import { distanceMeters } from '../domain/geo'
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
 * Sources tag an event with the organizer's city, so a Barcelona listing can
 * carry a venue 90km away. Coordinates are the only location we can verify.
 */
function isInRequestedCity(location: EventLocation): (event: Event) => boolean {
  const city = location.type === 'city' ? getCityConfig(location.citySlug) : undefined
  if (!city) return () => true

  const centre = { latitude: city.latitude, longitude: city.longitude }
  const radiusMeters = city.radiusKm * 1000
  return (event) => distanceMeters(event.venue.coordinates, centre) <= radiusMeters
}

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

  const events = succeeded.flatMap((outcome) => outcome.value.events).filter(isInRequestedCity(params.location))

  return {
    events: deduplicateEvents(events),
    truncated: succeeded.some((outcome) => outcome.value.truncated),
    failedProviders,
  }
}
