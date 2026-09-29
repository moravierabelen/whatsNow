import { TZDate } from '@date-fns/tz'
import { getCityConfig } from '../../domain/cities'
import { eventOverlapsWindow, resolveTimeWindow } from '../../domain/events/temporal'
import type { Event } from '../../domain/events/event'
import type { EventLocation, EventProvider, EventSearchParams, EventSearchResult } from '../../domain/events/provider'
import { JamBaseRequestError, fetchJamBaseEventById, fetchJamBaseEvents } from './client'
import { mapJamBaseEvent } from './mapper'
import type { JamBaseEventDetailResponse, JamBaseEventSearchResponse } from './types'

/** JamBase rejects `perPage` above 100. */
const PAGE_SIZE = 100

/** Safety stop: JamBase has no paging depth limit of its own. */
const MAX_PAGES = 20

/** JamBase queries by coordinates + radius; it has no working city-name parameter. */
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
 * Half-open window -> the inclusive dates JamBase expects. `end - 1ms` keeps a
 * midnight boundary from pulling in an extra day, and the Developer tier
 * rejects an `eventDateFrom` before today, so Tonight's early-morning tail is
 * clamped (costing JamBase recall for that slice, never correctness).
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

/** JamBase filters by date only, so the exact window is re-applied here. */
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
 * Bounds come from the *first* response only: a page past the end returns
 * `{totalPages: 0}` instead of erroring, which would corrupt the loop.
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
