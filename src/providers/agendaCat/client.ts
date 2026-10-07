import type { AgendaCatErrorResponse } from './types'

const RESOURCE_URL = 'https://analisi.transparenciacatalunya.cat/resource/rhpv-yr4f.json'

/** Socrata omits system fields such as `:id` unless they are selected explicitly. */
const SELECT_WITH_ROW_ID = ':*,*'

export class AgendaCatRequestError extends Error {
  status?: number
  /** Socrata's own code, e.g. "query.soql.no-such-column". */
  errorCode?: string

  constructor(message: string, status?: number, errorCode?: string) {
    super(message)
    this.name = 'AgendaCatRequestError'
    this.status = status
    this.errorCode = errorCode
  }
}

async function extractErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as AgendaCatErrorResponse
    return body.errorCode
  } catch {
    return undefined
  }
}

/** Open data: no credentials, unlike the ticketing providers. */
async function fetchRows(params: Record<string, string>): Promise<unknown> {
  const url = new URL(RESOURCE_URL)
  url.searchParams.set('$select', SELECT_WITH_ROW_ID)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url)
  if (!response.ok) {
    const errorCode = await extractErrorCode(response)
    throw new AgendaCatRequestError(
      `Agenda cultural request failed with status ${response.status}`,
      response.status,
      errorCode,
    )
  }

  return response.json()
}

export async function fetchAgendaCatEvents(params: Record<string, string>): Promise<unknown> {
  return fetchRows(params)
}

/** Socrata row ids are exactly this shape, e.g. `row-g22r~zyvk~dtba`. */
const ROW_ID_PATTERN = /^row-[a-z0-9]{4}[-~._][a-z0-9]{4}[-~._][a-z0-9]{4}$/i

/**
 * Filters on Socrata's row id. Anything not shaped like one is treated as not
 * found rather than sent: `:id` is not a text column, so a free-form value
 * answers 400 instead of an empty result, and the id reaches us from a URL.
 */
export async function fetchAgendaCatEventByRowId(rowId: string): Promise<unknown> {
  if (!ROW_ID_PATTERN.test(rowId)) return []
  return fetchRows({ $where: `:id='${rowId}'`, $limit: '1' })
}
