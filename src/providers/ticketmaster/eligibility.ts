import type { TicketmasterEvent } from './types'

/**
 * `dates.access` has no discriminator field of its own — it's just a time
 * window (start/end + approximate flags). During the API spike we compared
 * real timed-entry attraction listings against real concerts/festivals and
 * found `dates.access` present on every timed-entry instance and absent on
 * every normal event, so presence of the key itself is the reliable signal,
 * not any particular value inside it. That comparison covered one attraction
 * (two listing instances) in one city — worth re-confirming against a wider
 * sample before leaning on this further, but it's the best evidence we have.
 */
export function isEligibleTicketmasterEvent(raw: TicketmasterEvent): boolean {
  const start = raw.dates?.start
  if (!start) return false
  if (!start.dateTime) return false
  if (start.dateTBA) return false
  if (start.dateTBD) return false
  if (start.timeTBA) return false
  if (start.noSpecificTime) return false

  if (raw.dates?.access !== undefined) return false

  return true
}
