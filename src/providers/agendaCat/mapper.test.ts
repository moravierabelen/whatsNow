import { describe, expect, it } from 'vitest'
import { encodeEventId } from '../../domain/events/eventId'
import { mapAgendaCatEvent } from './mapper'
import type { AgendaCatEvent } from './types'

const MADRID = 'Europe/Madrid'

function baseEvent(overrides: Partial<AgendaCatEvent> = {}): AgendaCatEvent {
  return {
    ':id': 'row-g22r~zyvk~dtba',
    codi: '2026091800017',
    denominaci: 'Exposició "Una força del passat"',
    data_inici: '2026-10-22T00:00:00.000',
    data_fi: '2026-10-22T00:00:00.000',
    espai: 'CaixaForum Barcelona',
    adre_a: 'Av. de Francesc Ferrer i Guàrdia, 6-8',
    localitat: 'Barcelona',
    municipi: 'agenda:ubicacions/barcelona/barcelones/barcelona',
    latitud: '41.3712',
    longitud: '2.1497',
    url: 'https://agenda.cultura.gencat.cat/una-forca-del-passat',
    imatges: '/content/dam/agenda/ca/activitats/2026/09/16/000/03/annexos/les-ungles-1.jpg',
    tags_categor_es: 'agenda:categories/exposicions',
    gratuita: 'No',
    ...overrides,
  }
}

describe('mapAgendaCatEvent', () => {
  it('maps a complete row', () => {
    const result = mapAgendaCatEvent(baseEvent(), MADRID)

    expect(result).toEqual({
      id: encodeEventId({ provider: 'agenda-cat', externalId: 'row-g22r~zyvk~dtba' }),
      source: { provider: 'agenda-cat', externalId: 'row-g22r~zyvk~dtba' },
      name: 'Exposició "Una força del passat"',
      category: 'arts-and-theatre',
      // 00:00 local in Europe/Madrid (CEST) -> 22:00 UTC the day before.
      start: { utc: '2026-10-21T22:00:00.000Z', timeZone: MADRID, timeKnown: false },
      end: undefined,
      endDate: undefined,
      venue: {
        name: 'CaixaForum Barcelona',
        coordinates: { latitude: 41.3712, longitude: 2.1497 },
        address: 'Av. de Francesc Ferrer i Guàrdia, 6-8',
        city: 'Barcelona',
      },
      url: 'https://agenda.cultura.gencat.cat/una-forca-del-passat',
      image: {
        url: 'https://agenda.cultura.gencat.cat/content/dam/agenda/ca/activitats/2026/09/16/000/03/annexos/les-ungles-1.jpg',
      },
      priceRange: undefined,
    })
  })

  it('uses the row id, not codi, since a run across venues repeats codi', () => {
    const result = mapAgendaCatEvent(baseEvent({ ':id': 'row-abc', codi: 'shared' }), MADRID)

    expect(result?.source.externalId).toBe('row-abc')
  })

  // `data_inici` is 2026-10-22, a Thursday, still on CEST (+02:00).
  describe('start and end time', () => {
    it('recovers a showtime from the schedule text', () => {
      const result = mapAgendaCatEvent(baseEvent({ horari: '20.30 h' }), MADRID)

      expect(result?.start.timeKnown).toBe(true)
      expect(result?.start.utc).toBe('2026-10-22T18:30:00.000Z')
      expect(result?.end).toBeUndefined()
    })

    it('takes both ends of an opening range', () => {
      const result = mapAgendaCatEvent(baseEvent({ horari: 'de 10 a 20 h' }), MADRID)

      expect(result?.start.utc).toBe('2026-10-22T08:00:00.000Z')
      expect(result?.end?.utc).toBe('2026-10-22T18:00:00.000Z')
    })

    it('derives an end from the stated duration', () => {
      const result = mapAgendaCatEvent(baseEvent({ horari: '20 h Durada aproximada: 90 minuts' }), MADRID)

      expect(result?.start.utc).toBe('2026-10-22T18:00:00.000Z')
      expect(result?.end?.utc).toBe('2026-10-22T19:30:00.000Z')
    })

    it('carries a show past midnight into the next day', () => {
      const result = mapAgendaCatEvent(baseEvent({ horari: '23 h Durada aproximada: 90 minuts' }), MADRID)

      expect(result?.start.utc).toBe('2026-10-22T21:00:00.000Z')
      expect(result?.end?.utc).toBe('2026-10-22T22:30:00.000Z')
    })

    it('reads the weekday the event actually falls on', () => {
      const result = mapAgendaCatEvent(baseEvent({ horari: 'Dijous: 18 h Divendres: 21 h' }), MADRID)

      expect(result?.start.utc).toBe('2026-10-22T16:00:00.000Z')
    })

    it('handles a midnight showtime without mangling the date', () => {
      const result = mapAgendaCatEvent(baseEvent({ horari: '0 h' }), MADRID)

      expect(result?.start.timeKnown).toBe(true)
      expect(result?.start.utc).toBe('2026-10-21T22:00:00.000Z')
    })

    it('stays date-only when the row has no schedule at all', () => {
      const result = mapAgendaCatEvent(baseEvent({ horari: undefined }), MADRID)

      expect(result?.start.timeKnown).toBe(false)
      expect(result?.start.utc).toBe('2026-10-21T22:00:00.000Z')
    })

    it('stays date-only when the schedule text cannot be trusted', () => {
      const result = mapAgendaCatEvent(baseEvent({ horari: 'En dimecres alterns 18 h' }), MADRID)

      expect(result?.start.timeKnown).toBe(false)
    })

    it('stays date-only when the venue is closed that weekday', () => {
      const result = mapAgendaCatEvent(baseEvent({ horari: 'De divendres a diumenges: 18 h Dijous: tancat' }), MADRID)

      expect(result?.start.timeKnown).toBe(false)
    })

    it('stays date-only for a multi-day run, whose week a single time cannot describe', () => {
      const result = mapAgendaCatEvent(
        baseEvent({ horari: 'de 10 a 20 h', data_fi: '2026-11-01T00:00:00.000' }),
        MADRID,
      )

      expect(result?.start.timeKnown).toBe(false)
      expect(result?.end).toBeUndefined()
    })
  })

  describe('multi-day runs', () => {
    it('carries endDate when the run spans several days', () => {
      const result = mapAgendaCatEvent(
        baseEvent({ data_inici: '2026-10-22T00:00:00.000', data_fi: '2026-11-01T00:00:00.000' }),
        MADRID,
      )

      expect(result?.endDate).toBe('2026-11-01')
    })

    it('leaves endDate undefined for a single-day run', () => {
      expect(mapAgendaCatEvent(baseEvent(), MADRID)?.endDate).toBeUndefined()
    })

    it('carries the weekly opening hours, which a run needs and a single day does not', () => {
      const result = mapAgendaCatEvent(
        baseEvent({
          data_fi: '2026-11-01T00:00:00.000',
          horari: "De dimarts a diumenges: d'11 a 20 h Dilluns: tancat",
        }),
        MADRID,
      )

      expect(result?.start.timeKnown).toBe(false)
      expect(result?.openingHours).toEqual({
        1: 'closed',
        2: [{ start: 11 * 60, end: 20 * 60 }],
        3: [{ start: 11 * 60, end: 20 * 60 }],
        4: [{ start: 11 * 60, end: 20 * 60 }],
        5: [{ start: 11 * 60, end: 20 * 60 }],
        6: [{ start: 11 * 60, end: 20 * 60 }],
        0: [{ start: 11 * 60, end: 20 * 60 }],
      })
    })

    it('leaves opening hours off a single-day run, already described by start and end', () => {
      expect(mapAgendaCatEvent(baseEvent({ horari: 'de 10 a 20 h' }), MADRID)?.openingHours).toBeUndefined()
    })

    it('leaves opening hours off a run whose schedule text cannot be trusted', () => {
      const result = mapAgendaCatEvent(
        baseEvent({ data_fi: '2026-11-01T00:00:00.000', horari: 'En dimecres alterns 18 h' }),
        MADRID,
      )

      expect(result?.openingHours).toBeUndefined()
    })
  })

  describe('implausible dates', () => {
    it('rejects a typo-ed start year', () => {
      // Real rows: a 2020 Christmas show filed as 0020.
      expect(mapAgendaCatEvent(baseEvent({ data_inici: '0020-12-25T00:00:00.000' }), MADRID)).toBeNull()
    })

    it('rejects a placeholder end year, which would otherwise match every window forever', () => {
      expect(
        mapAgendaCatEvent(baseEvent({ data_fi: '2222-02-02T00:00:00.000' }), MADRID),
      ).toBeNull()
    })

    it('rejects a missing start date', () => {
      expect(mapAgendaCatEvent(baseEvent({ data_inici: undefined }), MADRID)).toBeNull()
    })
  })

  describe('categories', () => {
    it.each([
      ['agenda:categories/concerts', 'music'],
      ['agenda:categories/teatre', 'arts-and-theatre'],
      ['agenda:categories/dansa', 'arts-and-theatre'],
      ['agenda:categories/circ', 'arts-and-theatre'],
      ['agenda:categories/infantil', 'family'],
      ['agenda:categories/conferencies', 'other'],
      ['agenda:categories/rutes-i-visites', 'other'],
      ['', 'other'],
    ])('maps %s to %s', (tags, expected) => {
      expect(mapAgendaCatEvent(baseEvent({ tags_categor_es: tags }), MADRID)?.category).toBe(expected)
    })

    it('prefers the audience tag when a row carries several', () => {
      const result = mapAgendaCatEvent(
        baseEvent({ tags_categor_es: 'agenda:categories/teatre,agenda:categories/infantil' }),
        MADRID,
      )

      expect(result?.category).toBe('family')
    })
  })

  describe('venue', () => {
    it('rejects a row with no venue name', () => {
      expect(mapAgendaCatEvent(baseEvent({ espai: undefined }), MADRID)).toBeNull()
    })

    it('rejects out-of-range coordinates instead of defaulting to 0', () => {
      expect(mapAgendaCatEvent(baseEvent({ latitud: '200' }), MADRID)).toBeNull()
    })

    it('rejects missing coordinates', () => {
      expect(mapAgendaCatEvent(baseEvent({ longitud: '' }), MADRID)).toBeNull()
    })
  })

  describe('image', () => {
    it('resolves the relative path against the agenda host', () => {
      const result = mapAgendaCatEvent(baseEvent({ imatges: '/content/dam/a.jpg' }), MADRID)

      expect(result?.image?.url).toBe('https://agenda.cultura.gencat.cat/content/dam/a.jpg')
    })

    it('takes only the first path when the field lists several', () => {
      const result = mapAgendaCatEvent(baseEvent({ imatges: '/content/a.jpg,/content/b.jpg' }), MADRID)

      expect(result?.image?.url).toBe('https://agenda.cultura.gencat.cat/content/a.jpg')
    })

    it('encodes a path containing spaces', () => {
      const result = mapAgendaCatEvent(baseEvent({ imatges: '/content/aem curs moble.jpg' }), MADRID)

      expect(result?.image?.url).toBe('https://agenda.cultura.gencat.cat/content/aem%20curs%20moble.jpg')
    })

    it('leaves image undefined when the row has none', () => {
      expect(mapAgendaCatEvent(baseEvent({ imatges: undefined }), MADRID)?.image).toBeUndefined()
    })
  })

  describe('price', () => {
    it('maps a free event to a zero price range, which renders as "Free"', () => {
      expect(mapAgendaCatEvent(baseEvent({ gratuita: 'Sí' }), MADRID)?.priceRange).toEqual({
        min: 0,
        max: 0,
        currency: 'EUR',
      })
    })

    it('leaves priceRange undefined for a paid event, whose price is free text', () => {
      expect(mapAgendaCatEvent(baseEvent({ gratuita: 'No' }), MADRID)?.priceRange).toBeUndefined()
    })
  })

  it('keeps a row with no url, which the dataset omits about a fifth of the time', () => {
    const result = mapAgendaCatEvent(baseEvent({ url: undefined }), MADRID)

    expect(result).not.toBeNull()
    expect(result?.url).toBeUndefined()
  })
})
