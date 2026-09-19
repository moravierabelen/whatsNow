import { describe, expect, it } from 'vitest'
import { isEligibleTicketmasterEvent } from './eligibility'
import type { TicketmasterEvent } from './types'

function event(dates: TicketmasterEvent['dates']): TicketmasterEvent {
  return { id: 'tm-1', name: 'Test Event', dates }
}

describe('isEligibleTicketmasterEvent', () => {
  it('accepts a normal event with a known start dateTime', () => {
    expect(isEligibleTicketmasterEvent(event({ start: { dateTime: '2026-09-18T19:00:00Z' } }))).toBe(true)
  })

  it('rejects an event with no dates at all', () => {
    expect(isEligibleTicketmasterEvent(event(undefined))).toBe(false)
  })

  it('rejects an event with no start', () => {
    expect(isEligibleTicketmasterEvent(event({}))).toBe(false)
  })

  it('rejects an event whose start has no dateTime', () => {
    expect(isEligibleTicketmasterEvent(event({ start: { localDate: '2026-09-18' } }))).toBe(false)
  })

  it('rejects an event with dateTBA', () => {
    expect(
      isEligibleTicketmasterEvent(event({ start: { dateTime: '2026-09-18T19:00:00Z', dateTBA: true } })),
    ).toBe(false)
  })

  it('rejects an event with dateTBD', () => {
    expect(
      isEligibleTicketmasterEvent(event({ start: { dateTime: '2026-09-18T19:00:00Z', dateTBD: true } })),
    ).toBe(false)
  })

  it('rejects an event with timeTBA', () => {
    expect(
      isEligibleTicketmasterEvent(event({ start: { dateTime: '2026-09-18T19:00:00Z', timeTBA: true } })),
    ).toBe(false)
  })

  it('rejects an event with noSpecificTime', () => {
    expect(
      isEligibleTicketmasterEvent(
        event({ start: { dateTime: '2026-09-18T19:00:00Z', noSpecificTime: true } }),
      ),
    ).toBe(false)
  })

  it('accepts an event with a known start but no end', () => {
    expect(isEligibleTicketmasterEvent(event({ start: { dateTime: '2026-09-18T19:00:00Z' } }))).toBe(true)
  })

  it('accepts a multi-day event', () => {
    expect(
      isEligibleTicketmasterEvent(
        event({ start: { dateTime: '2026-09-18T19:00:00Z' }, spanMultipleDays: true }),
      ),
    ).toBe(true)
  })

  it('accepts an event with no priceRanges field at all', () => {
    const raw: TicketmasterEvent = { id: 'tm-2', name: 'No price', dates: { start: { dateTime: '2026-09-18T19:00:00Z' } } }
    expect(isEligibleTicketmasterEvent(raw)).toBe(true)
  })

  it('rejects a representative timed-entry / flexible-admission listing', () => {
    expect(
      isEligibleTicketmasterEvent(
        event({
          start: { dateTime: '2026-09-18T09:00:00Z', localDate: '2026-09-18', localTime: '11:00:00' },
          end: { dateTime: '2026-09-18T10:00:00Z' },
          access: { startDateTime: '2026-07-20T15:04:14Z', endDateTime: '2026-09-15T10:00:00Z' },
        }),
      ),
    ).toBe(false)
  })
})
