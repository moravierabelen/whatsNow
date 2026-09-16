import { env } from '../../lib/env'

const EVENTS_URL = 'https://app.ticketmaster.com/discovery/v2/events.json'

export class TicketmasterRequestError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'TicketmasterRequestError'
    this.status = status
  }
}

export async function fetchTicketmasterEvents(params: Record<string, string>): Promise<unknown> {
  if (!env.TICKETMASTER_API_KEY) {
    throw new TicketmasterRequestError('VITE_TICKETMASTER_API_KEY is not configured')
  }

  const url = new URL(EVENTS_URL)
  url.searchParams.set('apikey', env.TICKETMASTER_API_KEY)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new TicketmasterRequestError(`Ticketmaster request failed with status ${response.status}`, response.status)
  }

  return response.json()
}
