import { TZDate } from '@date-fns/tz'
import { encodeEventId } from '../../domain/events/eventId'
import type { Event, EventCategory, EventImage, PriceRange, Venue } from '../../domain/events/event'
import type { JamBaseEvent, JamBaseOffer, JamBasePriceSpecification, JamBaseVenue } from './types'

const EXTERNAL_ID_PREFIX = 'jambase:'

function extractExternalId(identifier: string): string | null {
  if (!identifier.startsWith(EXTERNAL_ID_PREFIX)) return null
  const externalId = identifier.slice(EXTERNAL_ID_PREFIX.length)
  return externalId.length > 0 ? externalId : null
}

/**
 * Every JamBase listing is inherently live music (concerts/festivals) — the
 * platform has no sports/theatre/film content. `performer[].genre` is a
 * sub-genre within music (edm, rock, ...), not a category selector, so it
 * isn't mapped into EventCategory at all.
 */
function mapCategory(): EventCategory {
  return 'music'
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseCoordinate(value: number | undefined, min: number, max: number): number | null {
  if (!isFiniteNumber(value)) return null
  if (value < min || value > max) return null
  return value
}

function mapVenue(location: JamBaseVenue | undefined): Venue | null {
  if (!location?.name) return null

  const latitude = parseCoordinate(location.geo?.latitude, -90, 90)
  const longitude = parseCoordinate(location.geo?.longitude, -180, 180)
  if (latitude === null || longitude === null) return null

  return {
    name: location.name,
    coordinates: { latitude, longitude },
    address: location.address?.streetAddress,
    city: location.address?.addressLocality,
  }
}

/** JamBase gives no dimensions for this image, hence the optional width/height. */
function mapImage(url: string | undefined): EventImage | undefined {
  return isUsableUrl(url) ? { url } : undefined
}

function isUsableUrl(url: string | undefined): url is string {
  if (!url) return false
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

function selectTicketingOffer(offers: JamBaseOffer[] | undefined): JamBaseOffer | undefined {
  const usable = (offers ?? []).filter((offer) => isUsableUrl(offer.url))
  if (usable.length === 0) return undefined
  return usable.find((offer) => offer.category === 'ticketingLinkPrimary') ?? usable[0]
}

function mapPriceRange(spec: JamBasePriceSpecification | undefined): PriceRange | undefined {
  if (!spec?.priceCurrency) return undefined

  const min = isFiniteNumber(spec.minPrice) ? spec.minPrice : spec.price
  const max = isFiniteNumber(spec.maxPrice) ? spec.maxPrice : spec.price
  if (!isFiniteNumber(min) && !isFiniteNumber(max)) return undefined

  return {
    currency: spec.priceCurrency,
    ...(isFiniteNumber(min) ? { min } : {}),
    ...(isFiniteNumber(max) ? { max } : {}),
  }
}

function toUtcInstant(localNaive: string, timeZone: string): string | null {
  const time = new TZDate(localNaive, timeZone).getTime()
  if (!Number.isFinite(time)) return null
  return new Date(time).toISOString()
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * A bare "2026-09-25" must be forced to local midnight: JS parses date-only
 * strings as UTC, which showed a timeless festival as starting at 02:00.
 */
function parseStartDate(rawStartDate: string, timeZone: string): { utc: string; timeKnown: boolean } | null {
  if (DATE_ONLY_PATTERN.test(rawStartDate)) {
    const utc = toUtcInstant(`${rawStartDate}T00:00:00`, timeZone)
    return utc ? { utc, timeKnown: false } : null
  }
  const utc = toUtcInstant(rawStartDate, timeZone)
  return utc ? { utc, timeKnown: true } : null
}

/** Only kept when it differs from the start's own date; a same-day run is not a range. */
function resolveEndDate(startDate: string, endDate: string | undefined): string | undefined {
  if (!endDate || !DATE_ONLY_PATTERN.test(endDate)) return undefined
  return endDate !== startDate.slice(0, 10) ? endDate : undefined
}

export function mapJamBaseEvent(raw: JamBaseEvent): Event | null {
  try {
    const externalId = extractExternalId(raw.identifier)
    if (!externalId) return null

    const timeZone = raw.location?.address?.['x-timezone']
    if (!raw.startDate || !timeZone) return null

    const start = parseStartDate(raw.startDate, timeZone)
    if (!start) return null

    const venue = mapVenue(raw.location)
    if (!venue) return null

    const offer = selectTicketingOffer(raw.offers)
    const url = offer?.url ?? raw.url

    return {
      id: encodeEventId({ provider: 'jambase', externalId }),
      source: { provider: 'jambase', externalId },
      name: raw.name,
      category: mapCategory(),
      start: { utc: start.utc, timeZone, timeKnown: start.timeKnown },
      end: undefined,
      endDate: resolveEndDate(raw.startDate, raw.endDate),
      venue,
      url: isUsableUrl(url) ? url : undefined,
      image: mapImage(raw.image),
      priceRange: offer ? mapPriceRange(offer.priceSpecification) : undefined,
    }
  } catch {
    return null
  }
}
