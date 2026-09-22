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
  /**
   * 1-based page number. Provider-specific page size remains an
   * implementation detail.
   */
  page?: number
}

export interface EventPage {
  events: Event[]
  hasNextPage: boolean
}

export interface EventProvider {
  readonly id: EventProviderId
  searchEvents(params: EventSearchParams): Promise<EventPage>
  getEventById(externalId: string): Promise<Event | null>
}
