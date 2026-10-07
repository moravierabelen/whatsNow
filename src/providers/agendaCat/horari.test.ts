import { describe, expect, it } from 'vitest'
import { parseHorariStartTime } from './horari'

// Every string below is a real value from the dataset.
describe('parseHorariStartTime', () => {
  it('reads a bare hour', () => {
    expect(parseHorariStartTime('19 h')).toBe('19:00')
  })

  it('reads an hour with minutes, which the source separates with a dot', () => {
    expect(parseHorariStartTime('20.30 h')).toBe('20:30')
  })

  it('ignores whatever follows the time', () => {
    expect(parseHorariStartTime('12 h Durada aproximada: 75 minuts')).toBe('12:00')
    expect(parseHorariStartTime('20 h Durada aproximada: 1 hora i 15 minuts')).toBe('20:00')
  })

  it('accepts the "a les" prefix', () => {
    expect(parseHorariStartTime('a les 21 h')).toBe('21:00')
  })

  it('returns null for opening hours, which are a window rather than a start', () => {
    expect(parseHorariStartTime('de 9 a 21 h')).toBeNull()
    expect(parseHorariStartTime("Obert tots els dies de l'any De 8.30 h a 22.30 h")).toBeNull()
    expect(parseHorariStartTime('Cada dia: de 10 a 19 h Durada aproximada: 40 minuts')).toBeNull()
  })

  it('returns null for a per-weekday grid, which has no single start', () => {
    expect(
      parseHorariStartTime('Dimecres i dijous: 20 h Divendres: 19 h Dissabtes: 17 h i 19.30 h Diumenges: 17 h'),
    ).toBeNull()
  })

  it('returns null for an open-ended start, which is not a showtime', () => {
    expect(parseHorariStartTime('a partir de les 10 h')).toBeNull()
  })

  it('returns null when there is no schedule at all', () => {
    expect(parseHorariStartTime(undefined)).toBeNull()
    expect(parseHorariStartTime('')).toBeNull()
    expect(parseHorariStartTime('Consulteu el web')).toBeNull()
  })

  it('returns null for a time that is not a real clock time', () => {
    expect(parseHorariStartTime('25 h')).toBeNull()
    expect(parseHorariStartTime('20.75 h')).toBeNull()
  })

  it('does not read a number that is not an hour', () => {
    expect(parseHorariStartTime('75 minuts')).toBeNull()
  })
})
