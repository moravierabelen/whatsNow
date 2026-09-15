export type EventProviderId = 'ticketmaster'

export interface EventSource {
  provider: EventProviderId
  externalId: string
}

export interface EventStart {
  utc: string
  timeZone: string
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
  width: number
  height: number
}

export interface Event {
  /** Deterministic, reversible, URL-safe encoding of `source` (see `encodeEventId`/`decodeEventId` in `./eventId`). Opaque for URL readability only, not a security boundary — callers should not hand-parse it. */
  id: string
  source: EventSource
  name: string
  category: EventCategory
  start: EventStart
  end?: EventEnd
  spansMultipleDays: boolean
  venue: Venue
  url: string
  image?: EventImage
  priceRange?: PriceRange
}
