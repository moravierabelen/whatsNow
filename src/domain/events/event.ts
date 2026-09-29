export type EventProviderId = 'ticketmaster' | 'jambase'

export interface EventSource {
  provider: EventProviderId
  externalId: string
}

export interface EventStart {
  utc: string
  timeZone: string
  /**
   * False when only the calendar date is known. `utc` is then local midnight of
   * that date — usable for window checks, never as a real time.
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
   * Last calendar date the event runs through (`YYYY-MM-DD`), when there is no
   * reliable end *time*. Only meaningful while `start.timeKnown` is false: a
   * known start time decides the event's day on its own.
   */
  endDate?: string
  venue: Venue
  /** Absent for sources that list real events with no page of their own. */
  url?: string
  image?: EventImage
  priceRange?: PriceRange
}
