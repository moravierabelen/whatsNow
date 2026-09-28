import { getCityConfig } from '../../domain/cities'
import { resolveTimeWindow } from '../../domain/events/temporal'
import type { Event, EventCategory } from '../../domain/events/event'
import type { EventLocation, EventProvider, EventSearchParams, EventSearchResult } from '../../domain/events/provider'
import { TicketmasterRequestError, fetchTicketmasterEventById, fetchTicketmasterEvents } from './client'
import { isEligibleTicketmasterEvent } from './eligibility'
import { mapTicketmasterEvent } from './mapper'
import type { TicketmasterEvent, TicketmasterEventSearchResponse } from './types'

/**
 * Ticketmaster's own city-name query vocabulary — a provider-specific fact
 * on top of the shared city/timezone/coordinates config in `domain/cities`.
 */
const TICKETMASTER_CITY_PARAMS: Record<string, { city: string; countryCode: string }> = {
  barcelona: { city: 'Barcelona', countryCode: 'ES' },
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

/**
 * The largest page Ticketmaster accepts: `size` of 200 or more is rejected
 * with `DIS1036: Query param "size" must be less than 200`. Verified
 * against the real API.
 */
const PAGE_SIZE = 199

/**
 * Ticketmaster refuses to page deeper than this, with
 * `DIS1035: API Limits Exceeded: Max paging depth exceeded. (page * size)
 * must be less than 1,000` — also verified against the real API. It is a
 * property of the search, not of our key or plan: roughly the first 1,000
 * matches are the only ones reachable at all, and a broader search has to
 * be narrowed rather than paged through.
 */
const MAX_PAGING_DEPTH = 1000

/**
 * Page indices `0 .. MAX_PAGES - 1` are the ones `MAX_PAGING_DEPTH` allows,
 * which doubles as the hard stop for the fetch loop below — an unexpected
 * `totalPages` can never turn it into an unbounded request loop.
 */
const MAX_PAGES = Math.ceil(MAX_PAGING_DEPTH / PAGE_SIZE)

function mapEligibleEvents(response: TicketmasterEventSearchResponse): Event[] {
  return (response._embedded?.events ?? [])
    .filter(isEligibleTicketmasterEvent)
    .map(mapTicketmasterEvent)
    .filter((event): event is Event => event !== null)
}

/**
 * Fetches every page Ticketmaster will serve for this search, not just the
 * first — the page size and the paging depth ceiling are provider details
 * that stay in here, and callers get one complete result set.
 *
 * Pages are requested one after another rather than in parallel: the common
 * case is a single page, the ceiling is `MAX_PAGES` (6), and Ticketmaster's
 * free tier also limits requests per second, so a burst buys very little
 * and risks being throttled.
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

  // Ticketmaster reports the total up front, so the page count is known
  // after the first request — no need to probe for an empty page.
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
