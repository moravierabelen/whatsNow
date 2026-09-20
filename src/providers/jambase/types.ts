export interface JamBaseGeoCoordinates {
  latitude?: number
  longitude?: number
}

export interface JamBaseAddress {
  streetAddress?: string
  addressLocality?: string
  /** IANA timezone for the venue, e.g. "Europe/Madrid". */
  'x-timezone'?: string
}

export interface JamBaseVenue {
  name?: string
  address?: JamBaseAddress
  geo?: JamBaseGeoCoordinates
}

export interface JamBasePriceSpecification {
  minPrice?: number
  maxPrice?: number
  /** The singular price when it's not a range; same as minPrice/maxPrice otherwise. */
  price?: number
  priceCurrency?: string
}

export interface JamBaseOffer {
  url?: string
  /** e.g. "ticketingLinkPrimary" | "ticketingLinkSecondary". */
  category?: string
  /** Frequently an empty object — price is often not populated. */
  priceSpecification?: JamBasePriceSpecification
}

export interface JamBasePerformer {
  /** Music sub-genres (e.g. "edm", "rock") — not a domain-level category. */
  genre?: string[]
}

export interface JamBaseEvent {
  /** Comes prefixed as "jambase:<id>". */
  identifier: string
  name: string
  url?: string
  image?: string
  /** Local time at the venue, without a UTC offset. */
  startDate?: string
  /** Date only ("YYYY-MM-DD"), never a time. */
  endDate?: string
  location?: JamBaseVenue
  offers?: JamBaseOffer[]
  performer?: JamBasePerformer[]
}
