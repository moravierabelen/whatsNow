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
   * True when the provider holds more than this search could reach — a ceiling
   * the provider imposes, not "there is a next page".
   */
  truncated: boolean
}

export interface EventProvider {
  readonly id: EventProviderId
  /** Every page this provider can reach, already fetched and normalized. */
  searchEvents(params: EventSearchParams): Promise<EventSearchResult>
  getEventById(externalId: string): Promise<Event | null>
}
