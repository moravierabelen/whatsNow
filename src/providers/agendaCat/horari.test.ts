import { describe, expect, it } from 'vitest'
import { parseHorari } from './horari'

const SUN = 0
const MON = 1
const TUE = 2
const WED = 3
const THU = 4
const FRI = 5
const SAT = 6

const at = (hours: number, minutes = 0) => hours * 60 + minutes

/** Every input below is a real `horari` value from the dataset. */
describe('parseHorari', () => {
  describe('a plain showtime, which is how single-day events carry their time', () => {
    it('reads a bare hour', () => {
      expect(parseHorari('20 h')?.week[WED]).toEqual([{ start: at(20) }])
    })

    it('reads a bare hour with minutes', () => {
      expect(parseHorari('22.30 h')?.week[MON]).toEqual([{ start: at(22, 30) }])
    })

    it('applies to every weekday, since no weekday is named', () => {
      const week = parseHorari('19 h')?.week
      expect(Object.keys(week ?? {})).toHaveLength(7)
    })

    it('leaves no end time, so the card can tell arriving from dropping in', () => {
      expect(parseHorari('20 h')?.week[WED]).toEqual([{ start: at(20) }])
    })
  })

  describe('duration, which gives a real end time instead of a guess', () => {
    it('reads plain minutes', () => {
      expect(parseHorari('22 h Durada aproximada: 90 minuts')?.durationMinutes).toBe(90)
    })

    it('reads hours and minutes together', () => {
      expect(parseHorari('19.30 h Durada aproximada: 1 hora i 30 minuts')?.durationMinutes).toBe(90)
    })

    it('ignores a trailing parenthetical', () => {
      expect(parseHorari('21.30 h Durada aproximada: 75 minuts (sense pausa)')?.durationMinutes).toBe(75)
    })

    it('does not mistake the duration for a showtime', () => {
      expect(parseHorari('22 h Durada aproximada: 90 minuts')?.week[WED]).toEqual([{ start: at(22) }])
    })

    it('is absent when the text does not state one', () => {
      expect(parseHorari('20 h')?.durationMinutes).toBeUndefined()
    })
  })

  describe('weekly opening hours', () => {
    it('expands a day range', () => {
      const week = parseHorari("De dimarts a diumenges: d'11 a 20 h")?.week
      expect(week?.[TUE]).toEqual([{ start: at(11), end: at(20) }])
      expect(week?.[SUN]).toEqual([{ start: at(11), end: at(20) }])
      expect(week?.[MON]).toBeUndefined()
    })

    it('expands a day range written without the leading "de"', () => {
      const week = parseHorari('Dimarts a dissabtes: de 10 a 18 h')?.week
      expect(week?.[TUE]).toEqual([{ start: at(10), end: at(18) }])
      expect(week?.[FRI]).toEqual([{ start: at(10), end: at(18) }])
      expect(week?.[SAT]).toEqual([{ start: at(10), end: at(18) }])
    })

    it('keeps each clause of a per-day grid separate', () => {
      const week = parseHorari(
        "Dimarts: de 16 a 20 h De dimecres a dissabtes: d'11 a 20.30 h Diumenges: d'11 a 18 h",
      )?.week
      expect(week?.[TUE]).toEqual([{ start: at(16), end: at(20) }])
      expect(week?.[WED]).toEqual([{ start: at(11), end: at(20, 30) }])
      expect(week?.[SUN]).toEqual([{ start: at(11), end: at(18) }])
      expect(week?.[MON]).toBeUndefined()
    })

    it('reads a comma-and-"i" day list', () => {
      const week = parseHorari("Dilluns, dimecres, dijous i divendres: d'11 a 19.30 h")?.week
      expect(week?.[MON]).toEqual([{ start: at(11), end: at(19, 30) }])
      expect(week?.[THU]).toEqual([{ start: at(11), end: at(19, 30) }])
      expect(week?.[TUE]).toBeUndefined()
    })

    it('reads two shifts in one day', () => {
      expect(parseHorari('De dilluns a divendres: de 10 a 13 h i de 16 a 20 h')?.week[MON]).toEqual([
        { start: at(10), end: at(13) },
        { start: at(16), end: at(20) },
      ])
    })

    it('reads an en-dash range', () => {
      expect(parseHorari('Dijous: 10–21 h')?.week[THU]).toEqual([{ start: at(10), end: at(21) }])
    })

    it('treats "i festius" as a note on the weekday, not another day', () => {
      expect(parseHorari('Diumenges i festius: de 10 a 14.30 h')?.week[SUN]).toEqual([
        { start: at(10), end: at(14, 30) },
      ])
    })

    it('opens every day when the text says so', () => {
      const week = parseHorari("Obert tots els dies de l'any De 8.30 h a 22.30 h")?.week
      expect(week?.[MON]).toEqual([{ start: at(8, 30), end: at(22, 30) }])
      expect(week?.[SUN]).toEqual([{ start: at(8, 30), end: at(22, 30) }])
    })

    it('ignores a last-entry note', () => {
      expect(parseHorari('De dimarts a diumenges: de 10 h a 20 h (darrera entrada a les 19 h)')?.week[TUE]).toEqual(
        [{ start: at(10), end: at(20) }],
      )
    })
  })

  describe('closed days, which is why a Monday listing can be wrong', () => {
    it('reads "Dimarts: tancat"', () => {
      expect(parseHorari("De dimecres a dilluns: d'11 a 20 h Dimarts: tancat")?.week[TUE]).toBe('closed')
    })

    it('reads a trailing "Tancat els dilluns"', () => {
      expect(parseHorari('De dilluns a diumenges: de 9.30 a 18 h Tancat els dilluns')?.week[MON]).toBe('closed')
    })

    it('reads "Tancat:" followed by the day', () => {
      const week = parseHorari(
        'Dimarts a dissabtes: de 10 a 18 h Tancat: dilluns no festius, 1 de gener, 25 de desembre',
      )?.week
      expect(week?.[MON]).toBe('closed')
      expect(week?.[SAT]).toEqual([{ start: at(10), end: at(18) }])
    })

    it('reads "Dilluns no festius: Tancat"', () => {
      expect(parseHorari('De dimarts a diumenges: de 10 a 20 h Dilluns no festius: Tancat')?.week[MON]).toBe(
        'closed',
      )
    })

    it('distinguishes closed from unknown', () => {
      const week = parseHorari('Dimecres, de 16.30 a 19.30 h')?.week
      expect(week?.[MON]).toBeUndefined()
      expect(week?.[WED]).toEqual([{ start: at(16, 30), end: at(19, 30) }])
    })
  })

  describe('refuses to guess', () => {
    it('rejects winter/summer regimes rather than merging them', () => {
      expect(
        parseHorari(
          "Horari d'hivern (de l'1 de novembre al 31 de març): De dimarts a diumenges: de 10 a 19 h Horari d'estiu (de l'1 d'abril al 31 d'octubre): De dimarts a diumenges: de 10 a 20 h",
        ),
      ).toBeNull()
    })

    it('rejects a month-to-month regime header', () => {
      expect(
        parseHorari("D'octubre a febrer: De dimarts a dissabtes: de 10 a 19 h De març a setembre: De dimarts a diumenges: de 10 a 20 h"),
      ).toBeNull()
    })

    it('rejects two dated ranges with their own hours, which are seasonal regimes inline', () => {
      expect(
        parseHorari(
          "Dilluns, dimecres, dijous i divendres: d'11 a 19.30 h (del 25 de setembre al 24 de juny) i de 10 a 20 h (del 25 de juny al 24 de setembre)",
        ),
      ).toBeNull()
    })

    it('still accepts a single dated range, which only bounds the run', () => {
      expect(parseHorari('De dimarts a diumenges: de 10 a 20 h (del 2 de juny al 8 de setembre)')?.week[TUE]).toEqual(
        [{ start: at(10), end: at(20) }],
      )
    })

    it('still accepts a holiday exception list', () => {
      expect(
        parseHorari('De dilluns a dissabtes: de 10 a 19 h Diumenges: de 10 a 14 h (excepte 1 de gener i 25 de desembre)')
          ?.week[SUN],
      ).toEqual([{ start: at(10), end: at(14) }])
    })

    it('rejects individually dated sessions', () => {
      expect(
        parseHorari(
          'Dijous, 12 de març a les 18 h: Enric Casasses Dijous, 9 d’abril a les 18 h: Carles Congost',
        ),
      ).toBeNull()
    })

    it('rejects access on request', () => {
      expect(parseHorari('Inauguracions: 6 i 12 de setembre de 17 a 20 h La resta de dies amb cita prèvia.')).toBeNull()
    })

    it('rejects an alternating schedule', () => {
      expect(parseHorari('En dimecres alterns 18 h')).toBeNull()
    })

    it('rejects a run with no time at all', () => {
      expect(parseHorari('De dimecres a diumenge Durada aproximada: 1 hora i 30 minuts')).toBeNull()
    })

    it('rejects an impossible clock time', () => {
      expect(parseHorari('99 h')).toBeNull()
    })

    it('rejects absent and blank input', () => {
      expect(parseHorari(undefined)).toBeNull()
      expect(parseHorari('   ')).toBeNull()
    })
  })
})
