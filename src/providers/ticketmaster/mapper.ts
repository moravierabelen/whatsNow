import { encodeEventId } from '../../domain/events/eventId'
import type { Event, EventCategory, EventImage, PriceRange, Venue } from '../../domain/events/event'
import type { TicketmasterEvent, TicketmasterImage, TicketmasterPriceRange, TicketmasterVenue } from './types'

const SEGMENT_TO_CATEGORY: Record<string, EventCategory> = {
  Music: 'music',
  Sports: 'sports',
  'Arts & Theatre': 'arts-and-theatre',
  Film: 'film',
}

function mapCategory(classifications: TicketmasterEvent['classifications']): EventCategory {
  const primary = classifications?.[0]
  const segment = primary?.segment?.name
  const genre = primary?.genre?.name

  if (segment === 'Miscellaneous' && genre === 'Family') return 'family'
  return SEGMENT_TO_CATEGORY[segment ?? ''] ?? 'other'
}

function parseCoordinate(value: string | undefined, min: number, max: number): number | null {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  if (parsed < min || parsed > max) return null

  return parsed
}

function mapVenue(raw: TicketmasterVenue | undefined): Venue | null {
  if (!raw?.name) return null

  const latitude = parseCoordinate(raw.location?.latitude, -90, 90)
  const longitude = parseCoordinate(raw.location?.longitude, -180, 180)
  if (latitude === null || longitude === null) return null

  return {
    name: raw.name,
    coordinates: { latitude, longitude },
    address: raw.address?.line1,
    city: raw.city?.name,
  }
}

function mapImage(images: TicketmasterImage[] | undefined): EventImage | undefined {
  if (!images?.length) return undefined

  const landscape = images.filter((image) => image.ratio === '16_9')
  const pool = landscape.length ? landscape : images
  const sorted = [...pool].sort((a, b) => a.width - b.width)
  const chosen = sorted.find((image) => image.width >= 640) ?? sorted[sorted.length - 1]

  return { url: chosen.url, width: chosen.width, height: chosen.height }
}

function mapPriceRange(priceRanges: TicketmasterPriceRange[] | undefined): PriceRange | undefined {
  if (!priceRanges?.length) return undefined

  const currency = priceRanges.find((range) => range.currency)?.currency
  if (!currency) return undefined

  const isFiniteNumber = (value: number | undefined): value is number =>
    typeof value === 'number' && Number.isFinite(value)

  const mins = priceRanges.map((range) => range.min).filter(isFiniteNumber)
  const maxes = priceRanges.map((range) => range.max).filter(isFiniteNumber)
  if (mins.length === 0 && maxes.length === 0) return undefined

  return {
    currency,
    ...(mins.length ? { min: Math.min(...mins) } : {}),
    ...(maxes.length ? { max: Math.max(...maxes) } : {}),
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

export function mapTicketmasterEvent(raw: TicketmasterEvent): Event | null {
  try {
    const timeZone = raw.dates?.timezone ?? raw._embedded?.venues?.[0]?.timezone
    const startUtc = raw.dates?.start?.dateTime
    if (!timeZone || !startUtc) return null

    const venue = mapVenue(raw._embedded?.venues?.[0])
    if (!venue) return null

    const endUtc = raw.dates?.end?.dateTime

    return {
      id: encodeEventId({ provider: 'ticketmaster', externalId: raw.id }),
      source: { provider: 'ticketmaster', externalId: raw.id },
      name: raw.name,
      category: mapCategory(raw.classifications),
      // Eligibility already screened out date-only/TBA events.
      start: { utc: startUtc, timeZone, timeKnown: true },
      end: endUtc ? { utc: endUtc, timeZone } : undefined,
      venue,
      url: isUsableUrl(raw.url) ? raw.url : undefined,
      image: mapImage(raw.images),
      priceRange: mapPriceRange(raw.priceRanges),
    }
  } catch {
    return null
  }
}
