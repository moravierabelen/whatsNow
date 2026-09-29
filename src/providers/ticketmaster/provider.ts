import { getCityConfig } from '../../domain/cities'
import { resolveTimeWindow } from '../../domain/events/temporal'
import type { Event, EventCategory } from '../../domain/events/event'
import type { EventLocation, EventProvider, EventSearchParams, EventSearchResult } from '../../domain/events/provider'
import { TicketmasterRequestError, fetchTicketmasterEventById, fetchTicketmasterEvents } from './client'
import { isEligibleTicketmasterEvent } from './eligibility'
import { mapTicketmasterEvent } from './mapper'
import type { TicketmasterEvent, TicketmasterEventSearchResponse } from './types'

/** Ticketmaster's own city vocabulary, on top of the shared `domain/cities` config. */
const TICKETMASTER_CITY_PARAMS: Record<string, { city: string; countryCode: string }> = {
  barcelona: { city: 'Barcelona', countryCode: 'ES' },
}

/**
 * Only single values are verified against the real API, so a multi-category
 * request drops the filter rather than guessing a combination syntax.
 */
const CATEGORY_TO_CLASSIFICATION_NAME: Partial<Record<EventCategory, string>> = {
  music: 'Music',
  sports: 'Sports',
  'arts-and-theatre': 'Arts & Theatre',
  film: 'Film',
}

function resolveLocationParams(location: EventLocation): { params: Record<string, string>; timeZone: string } {
  if (location.type === 'city') {
    const cityConfig = getCityConfig(location.citySlug)
    const tmParams = TICKETMASTER_CITY_PARAMS[location.citySlug]
    if (!cityConfig || !tmParams) {
      throw new Error(`Unsupported city: ${location.citySlug}`)
    }
    return {
      params: { city: tmParams.city, countryCode: tmParams.countryCode },
      timeZone: cityConfig.timeZone,
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

/** Ticketmaster rejects `size` of 200 or more (DIS1036). */
const PAGE_SIZE = 199

/** Ticketmaster rejects `(page * size)` of 1,000 or more (DIS1035). */
const MAX_PAGING_DEPTH = 1000

/** The pages that depth allows, doubling as the loop's hard stop. */
const MAX_PAGES = Math.ceil(MAX_PAGING_DEPTH / PAGE_SIZE)

function mapEligibleEvents(response: TicketmasterEventSearchResponse): Event[] {
  return (response._embedded?.events ?? [])
    .filter(isEligibleTicketmasterEvent)
    .map(mapTicketmasterEvent)
    .filter((event): event is Event => event !== null)
}

/**
 * Sequential rather than parallel: the common case is one page, the ceiling is
 * six, and the free tier limits requests per second.
 */
async function searchEvents(params: EventSearchParams): Promise<EventSearchResult> {
  const { params: locationParams, timeZone } = resolveLocationParams(params.location)
  const window = resolveTimeWindow(params.timeMode, params.referenceTime, timeZone)

  const query: Record<string, string> = {
    ...locationParams,
    startDateTime: toTicketmasterDateTime(window.start),
    endDateTime: toTicketmasterDateTime(window.end),
    size: String(PAGE_SIZE),
    sort: 'date,asc',
  }

  const classificationName = resolveClassificationName(params.categories)
  if (classificationName) {
    query.classificationName = classificationName
  }

  const firstPage = (await fetchTicketmasterEvents({ ...query, page: '0' })) as TicketmasterEventSearchResponse
  const events = mapEligibleEvents(firstPage)

  const totalPages = firstPage.page.totalPages
  const reachablePages = Math.min(totalPages, MAX_PAGES)

  for (let page = 1; page < reachablePages; page++) {
    const response = (await fetchTicketmasterEvents({ ...query, page: String(page) })) as TicketmasterEventSearchResponse
    events.push(...mapEligibleEvents(response))
  }

  return { events, truncated: totalPages > MAX_PAGES }
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
