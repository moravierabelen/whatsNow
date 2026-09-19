import { resolveTimeWindow } from '../../domain/events/temporal'
import type { Event, EventCategory } from '../../domain/events/event'
import type { EventLocation, EventPage, EventProvider, EventSearchParams } from '../../domain/events/provider'
import { TicketmasterRequestError, fetchTicketmasterEventById, fetchTicketmasterEvents } from './client'
import { isEligibleTicketmasterEvent } from './eligibility'
import { mapTicketmasterEvent } from './mapper'
import type { TicketmasterEvent, TicketmasterEventSearchResponse } from './types'

/**
 * The domain contract only carries a `citySlug` — Ticketmaster's own city
 * query vocabulary and the IANA timezone needed for window math are
 * provider-specific facts, so they live here rather than in the domain.
 */
const SUPPORTED_CITIES: Record<string, { city: string; countryCode: string; timeZone: string }> = {
  barcelona: { city: 'Barcelona', countryCode: 'ES', timeZone: 'Europe/Madrid' },
}

/**
 * Verified against the real API during the spike as individual values
 * (classificationName=Music, =Sports, etc.). Combining multiple values in
 * one request was never tested, so a multi-category request omits this
 * filter entirely rather than guessing a combination syntax — the query
 * simply becomes broader, which is safe (over-fetching candidates is fine;
 * inventing an untested filter syntax is not).
 */
const CATEGORY_TO_CLASSIFICATION_NAME: Partial<Record<EventCategory, string>> = {
  music: 'Music',
  sports: 'Sports',
  'arts-and-theatre': 'Arts & Theatre',
  film: 'Film',
}

function resolveLocationParams(location: EventLocation): { params: Record<string, string>; timeZone: string } {
  if (location.type === 'city') {
    const config = SUPPORTED_CITIES[location.citySlug]
    if (!config) {
      throw new Error(`Unsupported city: ${location.citySlug}`)
    }
    return {
      params: { city: config.city, countryCode: config.countryCode },
      timeZone: config.timeZone,
    }
  }

  throw new Error('Coordinate-based search is not yet supported')
}

function resolveClassificationName(categories: EventCategory[] | undefined): string | undefined {
  if (!categories || categories.length !== 1) return undefined
  return CATEGORY_TO_CLASSIFICATION_NAME[categories[0]]
}

function toTicketmasterDateTime(isoInstant: string): string {
  return new Date(isoInstant).toISOString().split('.')[0] + 'Z'
}

async function searchEvents(params: EventSearchParams): Promise<EventPage> {
  const { params: locationParams, timeZone } = resolveLocationParams(params.location)
  const window = resolveTimeWindow(params.timeMode, params.referenceTime, timeZone)

  const query: Record<string, string> = {
    ...locationParams,
    startDateTime: toTicketmasterDateTime(window.start),
    endDateTime: toTicketmasterDateTime(window.end),
    page: String((params.page ?? 1) - 1),
    sort: 'date,asc',
  }

  const classificationName = resolveClassificationName(params.categories)
  if (classificationName) {
    query.classificationName = classificationName
  }

  const response = (await fetchTicketmasterEvents(query)) as TicketmasterEventSearchResponse

  const rawEvents = response._embedded?.events ?? []
  const events = rawEvents
    .filter(isEligibleTicketmasterEvent)
    .map(mapTicketmasterEvent)
    .filter((event): event is Event => event !== null)

  const hasNextPage = response.page.number + 1 < response.page.totalPages

  return { events, hasNextPage }
}

async function getEventById(externalId: string): Promise<Event | null> {
  let raw: unknown
  try {
    raw = await fetchTicketmasterEventById(externalId)
  } catch (error) {
    if (error instanceof TicketmasterRequestError && error.status === 404) return null
    throw error
  }

  const event = raw as TicketmasterEvent
  if (!isEligibleTicketmasterEvent(event)) return null

  return mapTicketmasterEvent(event)
}

export const ticketmasterProvider: EventProvider = {
  id: 'ticketmaster',
  searchEvents,
  getEventById,
}
