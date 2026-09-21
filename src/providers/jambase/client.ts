import { env } from '../../lib/env'
import type { JamBaseErrorResponse } from './types'

const EVENTS_URL = 'https://api.data.jambase.com/v3/events'
const eventDetailUrl = (eventDataSource: string, eventId: string) =>
  `https://api.data.jambase.com/v3/events/id/${eventDataSource}:${eventId}`

export class JamBaseRequestError extends Error {
  status?: number
  /** The first error's code from JamBase's error body, e.g. "identifier_invalid". */
  code?: string

  constructor(message: string, status?: number, code?: string) {
    super(message)
    this.name = 'JamBaseRequestError'
    this.status = status
    this.code = code
  }
}

async function extractErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as Partial<JamBaseErrorResponse>
    return body.errors?.[0]?.code
  } catch {
    return undefined
  }
}

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${env.JAMBASE_API_KEY}` }
}

export async function fetchJamBaseEvents(params: Record<string, string>): Promise<unknown> {
  if (!env.JAMBASE_API_KEY) {
    throw new JamBaseRequestError('VITE_JAMBASE_API_KEY is not configured')
  }

  const url = new URL(EVENTS_URL)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url, { headers: authHeaders() })
  if (!response.ok) {
    const code = await extractErrorCode(response)
    throw new JamBaseRequestError(`JamBase request failed with status ${response.status}`, response.status, code)
  }

  return response.json()
}

export async function fetchJamBaseEventById(externalId: string): Promise<unknown> {
  if (!env.JAMBASE_API_KEY) {
    throw new JamBaseRequestError('VITE_JAMBASE_API_KEY is not configured')
  }

  const url = new URL(eventDetailUrl('jambase', externalId))

  const response = await fetch(url, { headers: authHeaders() })
  if (!response.ok) {
    const code = await extractErrorCode(response)
    throw new JamBaseRequestError(`JamBase request failed with status ${response.status}`, response.status, code)
  }

  return response.json()
}
