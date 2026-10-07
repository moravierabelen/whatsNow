import { TZDate } from '@date-fns/tz'
import { encodeEventId } from '../../domain/events/eventId'
import type { Event, EventCategory, EventImage, Venue } from '../../domain/events/event'
import { parseHorariStartTime } from './horari'
import type { AgendaCatEvent } from './types'

/** `imatges` holds a path relative to the agenda's own site, not a URL. */
const IMAGE_BASE_URL = 'https://agenda.cultura.gencat.cat'

const TAG_PREFIX = 'agenda:categories/'

/**
 * First match wins, and 37% of rows carry more than one tag. Audience comes
 * before form: a children's show is more useful under Family than Theatre.
 */
const CATEGORY_BY_TAG: [string, EventCategory][] = [
  ['infantil', 'family'],
  ['concerts', 'music'],
  ['opera', 'arts-and-theatre'],
  ['teatre', 'arts-and-theatre'],
  ['dansa', 'arts-and-theatre'],
  ['circ', 'arts-and-theatre'],
  ['magia', 'arts-and-theatre'],
  ['sardanes', 'arts-and-theatre'],
  ['exposicions', 'arts-and-theatre'],
]

/** Hand-entered years stray as far as 0020 and 2222; neither is a real event. */
const MIN_YEAR = 2000
const MAX_YEAR = 2100

function mapCategory(rawTags: string | undefined): EventCategory {
  const tags = (rawTags ?? '').split(',').map((tag) => tag.trim().replace(TAG_PREFIX, ''))
  for (const [tag, category] of CATEGORY_BY_TAG) {
    if (tags.includes(tag)) return category
  }
  return 'other'
}

/** Returns the `YYYY-MM-DD` part, or null when the year is not believable. */
function parseLocalDate(raw: string | undefined): string | null {
  if (!raw) return null
  const date = raw.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const year = Number(date.slice(0, 4))
  return year >= MIN_YEAR && year <= MAX_YEAR ? date : null
}

function toUtcInstant(localNaive: string, timeZone: string): string | null {
  const time = new TZDate(localNaive, timeZone).getTime()
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

function parseCoordinate(raw: string | undefined, min: number, max: number): number | null {
  if (!raw?.trim()) return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value < min || value > max) return null
  return value
}

function mapVenue(raw: AgendaCatEvent): Venue | null {
  if (!raw.espai) return null
  const latitude = parseCoordinate(raw.latitud, -90, 90)
  const longitude = parseCoordinate(raw.longitud, -180, 180)
  if (latitude === null || longitude === null) return null

  return {
    name: raw.espai,
    coordinates: { latitude, longitude },
    address: raw.adre_a,
    city: raw.localitat,
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

/** The field can list several paths; only the first is used. */
function mapImage(raw: string | undefined): EventImage | undefined {
  const path = raw?.split(',')[0]?.trim()
  if (!path) return undefined
  const url = `${IMAGE_BASE_URL}${path.startsWith('/') ? '' : '/'}${encodeURI(path)}`
  return isUsableUrl(url) ? { url } : undefined
}

export function mapAgendaCatEvent(raw: AgendaCatEvent, timeZone: string): Event | null {
  try {
    const externalId = raw[':id']
    if (!externalId || !raw.denominaci) return null

    const startDate = parseLocalDate(raw.data_inici)
    if (!startDate) return null

    // `data_fi` is only dropped when absent — a bogus one means the run is
    // unknown, not single-day, so the whole row goes.
    const endDate = raw.data_fi ? parseLocalDate(raw.data_fi) : undefined
    if (raw.data_fi && !endDate) return null

    const venue = mapVenue(raw)
    if (!venue) return null

    const startTime = parseHorariStartTime(raw.horari)
    const utc = toUtcInstant(`${startDate}T${startTime ?? '00:00'}:00`, timeZone)
    if (!utc) return null

    return {
      id: encodeEventId({ provider: 'agenda-cat', externalId }),
      source: { provider: 'agenda-cat', externalId },
      name: raw.denominaci,
      category: mapCategory(raw.tags_categor_es),
      start: { utc, timeZone, timeKnown: startTime !== null },
      end: undefined,
      endDate: endDate && endDate !== startDate ? endDate : undefined,
      venue,
      url: isUsableUrl(raw.url) ? raw.url : undefined,
      image: mapImage(raw.imatges),
      priceRange: raw.gratuita === 'Sí' ? { min: 0, max: 0, currency: 'EUR' } : undefined,
    }
  } catch {
    return null
  }
}
