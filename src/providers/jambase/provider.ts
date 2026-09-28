import { TZDate } from '@date-fns/tz'
import { getCityConfig } from '../../domain/cities'
import { eventOverlapsWindow, resolveTimeWindow } from '../../domain/events/temporal'
import type { Event } from '../../domain/events/event'
import type { EventLocation, EventProvider, EventSearchParams, EventSearchResult } from '../../domain/events/provider'
import { JamBaseRequestError, fetchJamBaseEventById, fetchJamBaseEvents } from './client'
import { mapJamBaseEvent } from './mapper'
import type { JamBaseEventDetailResponse, JamBaseEventSearchResponse } from './types'

/**
 * JamBase's documented maximum: `perPage` above 100 is rejected with
 * "The perPage value `200` is not valid. Please use a number between 1 and
 * 100." Verified against the real API.
 */
const PAGE_SIZE = 100

/**
 * Hard stop for the fetch loop, so an unexpected `totalPages` can never
 * turn it into an unbounded request loop. JamBase publishes no paging depth
 * limit of its own, and this is deliberately far above real demand: the
 * widest time mode is a weekend (~2.5 days), where even a dense city sits
 * in the low hundreds of events. Reaching this cap means the result is
 * knowingly incomplete, so it reports `truncated`.
 */
const MAX_PAGES = 20

/**
 * JamBase's query vocabulary is coordinates + radius (there is no working
 * city-name parameter), so the shared `domain/cities` config already has
 * everything this provider needs — nothing provider-specific to add here.
 */
function resolveLocationParams(location: EventLocation): { params: Record<string, string>; timeZone: string } {
  if (location.type === 'city') {
    const config = getCityConfig(location.citySlug)
    if (!config) {
      throw new Error(`Unsupported city: ${location.citySlug}`)
    }
    return {
      params: {
        geoLatitude: String(config.latitude),
        geoLongitude: String(config.longitude),
        geoRadiusAmount: String(config.radiusKm),
        geoRadiusUnits: 'km',
      },
      timeZone: config.timeZone,
    }
  }

  throw new Error('Coordinate-based search is not yet supported')
}

function localDateString(instantIso: string, timeZone: string): string {
  const date = new TZDate(instantIso, timeZone)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Translates the domain's half-open [start, end) window into the inclusive
 * eventDateFrom/eventDateTo dates JamBase's search expects, taking the local
 * date of `end - 1ms` so an exact-midnight boundary (Today, Weekend) doesn't
 * pull in an extra day.
 *
 * JamBase's Developer tier rejects `eventDateFrom` before its own current
 * date (confirmed: HTTP 400 "eventDateFrom must be on or after ..." — fixing
 * this requires `expandPastEvents=true`, a Pro+-only feature). Tonight's
 * window can start "yesterday" during the early-morning tail of the night
 * (e.g. querying at 02:00 for a window that began at 18:00 the previous
 * evening) — in that case `eventDateFrom` is clamped to today rather than
 * sent as-is. This does not change Tonight's semantics or invent any
 * candidate: it means JamBase specifically cannot contribute candidates
 * dated the previous evening during that window, a known limitation of the
 * free tier. `eventOverlapsWindow` is still re-applied against the exact
 * domain window below, so nothing incorrect is included — only JamBase's
 * own recall is reduced for that slice of time.
 */
function resolveDateRange(
  window: { start: string; end: string },
  referenceTime: string,
  timeZone: string,
): { eventDateFrom: string; eventDateTo: string } {
  const today = localDateString(referenceTime, timeZone)
  const windowStartDate = localDateString(window.start, timeZone)
  const windowEndDate = localDateString(new Date(new Date(window.end).getTime() - 1).toISOString(), timeZone)

  const eventDateFrom = windowStartDate < today ? today : windowStartDate
  return { eventDateFrom, eventDateTo: windowEndDate }
}

/**
 * JamBase only filters by date, not time, so the exact domain window must be
 * re-applied to the mapped candidates — this is what actually narrows e.g.
 * Tonight down from "the two calendar days involved" to "18:00 -> 06:00".
 * It runs per page, which means a page of 100 raw events can legitimately
 * yield far fewer domain events.
 */
function mapEventsInWindow(
  response: JamBaseEventSearchResponse,
  window: { start: string; end: string },
): Event[] {
  return (response.events ?? [])
    .map(mapJamBaseEvent)
    .filter((event): event is Event => event !== null)
    .filter((event) => eventOverlapsWindow(event, window))
}

/**
 * Fetches every page JamBase will serve for this search, not just the first
 * — the page size and page bookkeeping are provider details that stay in
 * here, and callers get one complete result set.
 *
 * The loop is driven by the `totalPages` of the *first* response, never by
 * the `pagination` echoed back on later pages: asking JamBase for a page
 * past the end does not error, it returns `{page: 0, totalItems: 0,
 * totalPages: 0}` (verified against the real API), so trusting that would
 * corrupt the loop's own bounds mid-flight.
 */
async function searchEvents(params: EventSearchParams): Promise<EventSearchResult> {
  if (params.categories && !params.categories.includes('music')) {
    return { events: [], truncated: false }
  }

  const { params: locationParams, timeZone } = resolveLocationParams(params.location)
  const window = resolveTimeWindow(params.timeMode, params.referenceTime, timeZone)
  const { eventDateFrom, eventDateTo } = resolveDateRange(window, params.referenceTime, timeZone)

  const query: Record<string, string> = {
    ...locationParams,
    eventDateFrom,
    eventDateTo,
    perPage: String(PAGE_SIZE),
  }

  const firstPage = (await fetchJamBaseEvents({ ...query, page: '1' })) as JamBaseEventSearchResponse
  const events = mapEventsInWindow(firstPage, window)

  const totalPages = firstPage.pagination.totalPages
  const reachablePages = Math.min(totalPages, MAX_PAGES)

  // JamBase pages are 1-based, so the first response already covered page 1.
  for (let page = 2; page <= reachablePages; page++) {
    const response = (await fetchJamBaseEvents({ ...query, page: String(page) })) as JamBaseEventSearchResponse
    events.push(...mapEventsInWindow(response, window))
  }

  return { events, truncated: totalPages > MAX_PAGES }
}

async function getEventById(externalId: string): Promise<Event | null> {
  let raw: unknown
  try {
    raw = await fetchJamBaseEventById(externalId)
  } catch (error) {
    if (error instanceof JamBaseRequestError && error.code === 'identifier_invalid') return null
    throw error
  }

  const response = raw as JamBaseEventDetailResponse
  return mapJamBaseEvent(response.event)
}

export const jamBaseProvider: EventProvider = {
  id: 'jambase',
  searchEvents,
  getEventById,
}
