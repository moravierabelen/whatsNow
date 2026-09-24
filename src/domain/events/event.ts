export type EventProviderId = 'ticketmaster' | 'jambase'

export interface EventSource {
  provider: EventProviderId
  externalId: string
}

export interface EventStart {
  utc: string
  timeZone: string
  /**
   * False when only the calendar date is known, not the actual clock time
   * (e.g. a JamBase festival listing with `startDate: "2026-09-25"`, no
   * time component). `utc` still holds an instant in that case — local
   * midnight of the known date — so date/window-membership checks keep
   * working, but it must never be presented as a real start time, and the
   * event must never be classified as "happening now"/"starting soon" or
   * selected as the featured event.
   */
  timeKnown: boolean
}

export interface EventEnd {
  utc: string
  timeZone: string
}

export interface Coordinates {
  latitude: number
  longitude: number
}

export interface Venue {
  name: string
  coordinates: Coordinates
  address?: string
  city?: string
}

export interface PriceRange {
  min?: number
  max?: number
  currency: string
}

export type EventCategory =
  | 'music'
  | 'sports'
  | 'arts-and-theatre'
  | 'film'
  | 'family'
  | 'other'

export interface EventImage {
  url: string
  /** Not every provider gives us dimensions (e.g. JamBase's performer photo
   * is a bare URL) — optional rather than fabricated. No current renderer
   * relies on these; they're informational only. */
  width?: number
  height?: number
}

export interface Event {
  /** Deterministic, reversible, URL-safe encoding of `source` (see `encodeEventId`/`decodeEventId` in `./eventId`). Opaque for URL readability only, not a security boundary — callers should not hand-parse it. */
  id: string
  source: EventSource
  name: string
  category: EventCategory
  start: EventStart
  end?: EventEnd
  /**
   * The last calendar date (in the venue's own timezone, `YYYY-MM-DD`) the
   * provider confirms the event runs through, when there's no reliable end
   * *time* to build a real `EventEnd` from (e.g. a JamBase festival:
   * startDate "2026-09-25", endDate "2026-09-26", no time on either) — set
   * only when that date is genuinely different from `start`'s own local
   * date. Never set together with `end`; a provider either gives a real
   * end instant or a bare end date, never both.
   *
   * Only meaningful when `start.timeKnown` is false: a known start time
   * always determines the event's presentational day by itself — a show
   * starting 23:00 and running past midnight is still "that day", not a
   * range — so consumers must ignore `endDate` whenever `start.timeKnown`
   * is true (see `formatEventTime`/`formatWeekdayTime`, which already do).
   */
  endDate?: string
  venue: Venue
  url: string
  image?: EventImage
  priceRange?: PriceRange
}
