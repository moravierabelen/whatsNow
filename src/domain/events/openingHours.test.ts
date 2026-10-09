import { TZDate } from '@date-fns/tz'
import { describe, expect, it } from 'vitest'
import { openingInstantsOn, type OpeningHours } from './openingHours'

const MADRID = 'Europe/Madrid'

const TUE = 2
const WED = 3

/** 2026-09-15 is a Tuesday. */
const tuesday = () => new TZDate('2026-09-15T00:00:00', MADRID)

describe('openingInstantsOn', () => {
  it('turns the weekday intervals into absolute instants', () => {
    const hours: OpeningHours = { [TUE]: [{ start: 11 * 60, end: 20 * 60 + 30 }] }

    // 11:00 and 20:30 CEST are 09:00 and 18:30 UTC.
    expect(openingInstantsOn(hours, tuesday(), MADRID)).toEqual([
      { open: Date.parse('2026-09-15T09:00:00Z'), close: Date.parse('2026-09-15T18:30:00Z') },
    ])
  })

  it('leaves a showtime without a close, so it reads as a moment', () => {
    const hours: OpeningHours = { [TUE]: [{ start: 20 * 60 }] }

    expect(openingInstantsOn(hours, tuesday(), MADRID)).toEqual([
      { open: Date.parse('2026-09-15T18:00:00Z') },
    ])
  })

  it('keeps both halves of a split shift', () => {
    const hours: OpeningHours = {
      [TUE]: [
        { start: 10 * 60, end: 13 * 60 },
        { start: 16 * 60, end: 20 * 60 },
      ],
    }

    expect(openingInstantsOn(hours, tuesday(), MADRID)).toHaveLength(2)
  })

  it('is empty when the source says closed', () => {
    expect(openingInstantsOn({ [TUE]: 'closed' }, tuesday(), MADRID)).toEqual([])
  })

  it('is empty when the source says nothing about that weekday', () => {
    expect(openingInstantsOn({ [WED]: [{ start: 10 * 60 }] }, tuesday(), MADRID)).toEqual([])
  })

  it('resolves the same clock time against the day its own offset, across a DST change', () => {
    const hours: OpeningHours = { [TUE]: [{ start: 10 * 60 }] }
    // Madrid leaves CEST on 2026-10-25, so these two Tuesdays differ by an hour in UTC.
    const beforeChange = openingInstantsOn(hours, new TZDate('2026-10-20T00:00:00', MADRID), MADRID)
    const afterChange = openingInstantsOn(hours, new TZDate('2026-10-27T00:00:00', MADRID), MADRID)

    expect(beforeChange[0].open).toBe(Date.parse('2026-10-20T08:00:00Z'))
    expect(afterChange[0].open).toBe(Date.parse('2026-10-27T09:00:00Z'))
  })
})
