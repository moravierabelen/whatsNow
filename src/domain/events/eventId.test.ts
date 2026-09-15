import { describe, expect, it } from 'vitest'
import type { EventSource } from './event'
import { decodeEventId, encodeEventId } from './eventId'

describe('encodeEventId / decodeEventId', () => {
  it('round-trips an EventSource through encode and decode', () => {
    const source: EventSource = { provider: 'ticketmaster', externalId: 'abc123' }

    expect(decodeEventId(encodeEventId(source))).toEqual(source)
  })

  it('produces the same id for the same source every time', () => {
    const source: EventSource = { provider: 'ticketmaster', externalId: 'abc123' }

    expect(encodeEventId(source)).toBe(encodeEventId(source))
  })

  it('produces a URL-safe id', () => {
    const source: EventSource = { provider: 'ticketmaster', externalId: 'abc/123+456==' }

    expect(encodeEventId(source)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('does not expose provider:externalId directly in the id', () => {
    const source: EventSource = { provider: 'ticketmaster', externalId: 'abc123' }

    expect(encodeEventId(source)).not.toContain('ticketmaster')
    expect(encodeEventId(source)).not.toContain('abc123')
  })

  it('round-trips an externalId containing delimiter-like characters', () => {
    const source: EventSource = { provider: 'ticketmaster', externalId: 'ticketmaster:abc:123' }

    expect(decodeEventId(encodeEventId(source))).toEqual(source)
  })

  it('throws on malformed input instead of returning an invalid EventSource', () => {
    expect(() => decodeEventId('not-a-valid-id')).toThrow()
    expect(() => decodeEventId('')).toThrow()
  })

  it('throws when the decoded payload is not a two-element string array', () => {
    const notASourceArray = btoa(JSON.stringify({ provider: 'ticketmaster', externalId: 'abc' }))

    expect(() => decodeEventId(notASourceArray)).toThrow()
  })
})
