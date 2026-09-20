import { TZDate } from '@date-fns/tz'
import { encodeEventId } from '../../domain/events/eventId'
import type { Event, EventCategory, PriceRange, Venue } from '../../domain/events/event'
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

/**
 * Informational only — not used by any temporal logic. Best-effort
 * comparison of startDate's date portion against endDate; JamBase's
 * endDate is date-only, so this can never produce an `Event.end`.
 */
function computeSpansMultipleDays(startDate: string | undefined, endDate: string | undefined): boolean {
  if (!startDate || !endDate) return false
  return startDate.slice(0, 10) !== endDate
}

export function mapJamBaseEvent(raw: JamBaseEvent): Event | null {
  try {
    const externalId = extractExternalId(raw.identifier)
    if (!externalId) return null

    const timeZone = raw.location?.address?.['x-timezone']
    if (!raw.startDate || !timeZone) return null

    const startUtc = toUtcInstant(raw.startDate, timeZone)
    if (!startUtc) return null

    const venue = mapVenue(raw.location)
    if (!venue) return null

    const offer = selectTicketingOffer(raw.offers)
    const url = offer?.url ?? raw.url
    if (!isUsableUrl(url)) return null

    return {
      id: encodeEventId({ provider: 'jambase', externalId }),
      source: { provider: 'jambase', externalId },
      name: raw.name,
      category: mapCategory(),
      start: { utc: startUtc, timeZone },
      end: undefined,
      spansMultipleDays: computeSpansMultipleDays(raw.startDate, raw.endDate),
      venue,
      url,
      image: undefined,
      priceRange: offer ? mapPriceRange(offer.priceSpecification) : undefined,
    }
  } catch {
    return null
  }
}
