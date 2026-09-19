export interface TicketmasterDateInfo {
  localDate?: string
  localTime?: string
  dateTime?: string
  dateTBD?: boolean
  dateTBA?: boolean
  timeTBA?: boolean
  noSpecificTime?: boolean
}

export interface TicketmasterDateEndInfo {
  localTime?: string
  dateTime?: string
  approximate?: boolean
  noSpecificTime?: boolean
}

/** Present for flexible-admission/timed-entry listings; used later for eligibility filtering. */
export interface TicketmasterAccessInfo {
  startDateTime?: string
  startApproximate?: boolean
  endDateTime?: string
  endApproximate?: boolean
}

export interface TicketmasterEventDates {
  start?: TicketmasterDateInfo
  /** Absent for most real events. */
  end?: TicketmasterDateEndInfo
  access?: TicketmasterAccessInfo
  status?: {
    code?: string
  }
  spanMultipleDays?: boolean
  timezone?: string
}

export interface TicketmasterClassificationValue {
  id?: string
  /** Can be the literal string "Undefined", not just absent. */
  name?: string
}

export interface TicketmasterClassification {
  primary?: boolean
  segment?: TicketmasterClassificationValue
  genre?: TicketmasterClassificationValue
}

export interface TicketmasterImage {
  url: string
  width: number
  height: number
  ratio?: string
}

/** The whole array is often absent entirely. */
export interface TicketmasterPriceRange {
  type?: string
  currency?: string
  min?: number
  max?: number
}

export interface TicketmasterVenue {
  name?: string
  /** latitude/longitude are strings in the real API response, not numbers. */
  location?: {
    latitude?: string
    longitude?: string
  }
  address?: {
    line1?: string
  }
  city?: {
    name?: string
  }
  /** Fallback for the event's timezone when `dates.timezone` is absent. */
  timezone?: string
}

export interface TicketmasterEvent {
  id: string
  name: string
  url?: string
  test?: boolean
  dates?: TicketmasterEventDates
  classifications?: TicketmasterClassification[]
  images?: TicketmasterImage[]
  priceRanges?: TicketmasterPriceRange[]
  _embedded?: {
    venues?: TicketmasterVenue[]
  }
}

export interface TicketmasterPage {
  size: number
  totalElements: number
  totalPages: number
  number: number
}

/**
 * `_embedded` is absent entirely (not an empty array) when a search has zero
 * results — confirmed against the real API during the spike.
 */
export interface TicketmasterEventSearchResponse {
  _embedded?: {
    events: TicketmasterEvent[]
  }
  page: TicketmasterPage
}
