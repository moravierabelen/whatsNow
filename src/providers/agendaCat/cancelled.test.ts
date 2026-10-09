import { describe, expect, it } from 'vitest'
import { isCancelledByName } from './cancelled'

/** Every string here is a real `denominaci` value from the dataset. */
describe('isCancelledByName', () => {
  describe('an editor announcing a cancellation', () => {
    it.each([
      'ACTIVITAT CANCEL·LADA Concert solidari de The Tutsies a favor de Mans Unides',
      'ACTIVITAT CANCEL·LADA: Com construïen els ibers?',
      'Activitat cancel·lada: XVII Pista de Gel de Girona',
      'Concert cancel·lat: Grigory Sokolov (piano)',
      'ESPECTACLE CANCEL·LAT* Yo soy el que soy',
    ])('%s', (name) => {
      expect(isCancelledByName(name)).toBe(true)
    })
  })

  describe('the other words the dataset uses for it', () => {
    it.each([
      'Activitat suspesa: Els Pastorets de Banyoles',
      'Concert suspès: Alba Careta Group',
      "SUSPESA L'EDICIÓ 2021-22 (vegeu Observacions) Pessebre Vivent de Corbera de Llobregat",
      'Activitat anul·lada: Nuptialis',
      "ANUL·LADA Fira de Santa Teresa d'Esterri d'Àneu",
      'Docs del Mes: Revellion Projecció presencial ANUL·LADA',
    ])('%s', (name) => {
      expect(isCancelledByName(name)).toBe(true)
    })
  })

  describe('a postponement, since the listed date no longer holds either', () => {
    it.each([
      "ACTIVITAT AJORNADA Presentació del llibre Declaració d'intencions",
      'AJORNAT SENSE NOVA DATA - Presentació llibre Darrere del misteri',
      'ATENCIÓ: ACTIVITAT AJORNADA Passeja dels Munts a Tamarit',
      'Acte ajornat: La Princesa sou vós',
      'CONCERT AJORNAT Philippe Jaroussky & Jérôme Ducros',
    ])('%s', (name) => {
      expect(isCancelledByName(name)).toBe(true)
    })
  })

  describe('the same words inside a real title', () => {
    it.each([
      'Instal·lació "Aquel reloj de pared, Institut del Temps Suspès (ITS)"',
      'Exposició de pintura Sempre amb les veles suspeses',
      'Exposició "Suspendre el Cel"',
      'Suspended Animation',
      'Suspensión. Y tú, ¿sabes cuidar?',
    ])('%s', (name) => {
      expect(isCancelledByName(name)).toBe(false)
    })
  })

  it('leaves an ordinary name alone', () => {
    expect(isCancelledByName('Hombres G')).toBe(false)
  })
})
