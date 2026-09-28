import type {
  Coordinates,
  Event,
  EventCategory,
  EventProviderId,
} from './event'

export type TimeMode = 'now' | 'tonight' | 'today' | 'tomorrow' | 'weekend'

export type EventLocation =
  | {
      type: 'city'
      citySlug: string
    }
  | {
      type: 'coordinates'
      coordinates: Coordinates
      radiusKm: number
    }

export interface EventSearchParams {
  timeMode: TimeMode
  /**
   * ISO instant used as the reference point for resolving the requested
   * time mode. The provider must not read the current clock itself.
   */
  referenceTime: string
  location: EventLocation
  categories?: EventCategory[]
}

export interface EventSearchResult {
  events: Event[]
  /**
   * True when the provider holds more matching events than this search
   * could reach, so `events` is knowingly incomplete.
   *
   * This is not "there is a next page" — pagination is entirely a provider
   * implementation detail and `searchEvents` already exhausts it. It only
   * reports a ceiling the provider itself imposes: Ticketmaster refuses to
   * page beyond roughly the first 1,000 matches of any search, and each
   * provider also caps its own fetch loop as a safety limit. Callers can
   * surface this honestly instead of presenting a partial result as the
   * full picture.
   */
  truncated: boolean
}

export interface EventProvider {
  readonly id: EventProviderId
  /**
   * The complete set of events this provider can reach for `params` —
   * every page, already fetched and normalized. Providers own their own
   * pagination; callers never request or receive a single page.
   */
  searchEvents(params: EventSearchParams): Promise<EventSearchResult>
  getEventById(externalId: string): Promise<Event | null>
}
