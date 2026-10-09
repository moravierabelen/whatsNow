import { TZDate } from '@date-fns/tz'
import { eventOverlapsWindow, resolveTimeWindow } from '../../domain/events/temporal'
import type { Event } from '../../domain/events/event'
import type { EventLocation, EventProvider, EventSearchParams, EventSearchResult } from '../../domain/events/provider'
import { fetchAgendaCatEventByRowId, fetchAgendaCatEvents } from './client'
import { mapAgendaCatEvent } from './mapper'
import type { AgendaCatEvent } from './types'

/** The dataset covers Catalonia only, so its events share one timezone. */
const DATASET_TIME_ZONE = 'Europe/Madrid'

/** The dataset's own location vocabulary, unrelated to our city slugs. */
const MUNICIPI_BY_CITY: Record<string, string> = {
  barcelona: 'agenda:ubicacions/barcelona/barcelones/barcelona',
}

const PAGE_SIZE = 1000

/** Safety stop: Socrata reports no total, so the end is a short page. */
const MAX_PAGES = 5

function resolveMunicipi(location: EventLocation): string {
  if (location.type !== 'city') {
    throw new Error('Coordinate-based search is not yet supported')
  }
  const municipi = MUNICIPI_BY_CITY[location.citySlug]
  if (!municipi) {
    throw new Error(`Unsupported city: ${location.citySlug}`)
  }
  return municipi
}

function localDateString(instantIso: string): string {
  const date = new TZDate(instantIso, DATASET_TIME_ZONE)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** A row overlaps the window when its run starts before the window ends and ends after it starts. */
function buildWhere(municipi: string, window: { start: string; end: string }): string {
  const from = localDateString(window.start)
  // `end - 1ms`, so a window ending at midnight does not pull in the next day.
  const to = localDateString(new Date(new Date(window.end).getTime() - 1).toISOString())
  return `municipi='${municipi}' AND data_inici<='${to}T23:59:59' AND data_fi>='${from}T00:00:00'`
}

async function searchEvents(params: EventSearchParams): Promise<EventSearchResult> {
  const municipi = resolveMunicipi(params.location)
  const window = resolveTimeWindow(params.timeMode, params.referenceTime, DATASET_TIME_ZONE)
  const $where = buildWhere(municipi, window)

  const events: Event[] = []
  let truncated = true

  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = (await fetchAgendaCatEvents({
      $where,
      $limit: String(PAGE_SIZE),
      $offset: String(page * PAGE_SIZE),
      // Without an explicit order, offset paging can skip or repeat rows.
      $order: ':id',
    })) as AgendaCatEvent[]

    events.push(
      ...rows
        .map((row) => mapAgendaCatEvent(row, DATASET_TIME_ZONE))
        .filter((event): event is Event => event !== null)
        // The query filters by date only, so the exact window is re-applied here.
        .filter((event) => eventOverlapsWindow(event, window)),
    )

    if (rows.length < PAGE_SIZE) {
      truncated = false
      break
    }
  }

  // No category filter here: the dataset's tags have no equivalent for our
  // `other`, and `searchEvents` enforces the category for every provider.
  return { events, truncated }
}

async function getEventById(externalId: string): Promise<Event | null> {
  const rows = (await fetchAgendaCatEventByRowId(externalId)) as AgendaCatEvent[]
  const row = rows[0]
  return row ? mapAgendaCatEvent(row, DATASET_TIME_ZONE) : null
}

export const agendaCatProvider: EventProvider = {
  id: 'agenda-cat',
  searchEvents,
  getEventById,
}
