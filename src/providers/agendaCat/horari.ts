import type { OpeningHours, OpeningInterval, Weekday } from '../../domain/events/openingHours'

export interface Horari {
  week: OpeningHours
  /** From "Durada aproximada: 1 hora i 30 minuts". */
  durationMinutes?: number
}

const WEEK_ORDER = ['dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte', 'diumenge'] as const
const WEEKDAY_BY_NAME: Record<string, Weekday> = {
  diumenge: 0,
  dilluns: 1,
  dimarts: 2,
  dimecres: 3,
  dijous: 4,
  divendres: 5,
  dissabte: 6,
}

const DAY = '(?:dilluns|dimarts|dimecres|dijous|divendres|dissabtes?|diumenges?)'
const TIME = '(?:\\d{1,2}(?:[.:]\\d{2})?)'
const MONTH =
  '(?:gener|febrer|març|abril|maig|juny|juliol|agost|setembre|octubre|novembre|desembre)'

const EVERY_DAY = "(?:cada dia|tots els dies(?: de l'any)?|diàriament)"
const DAY_RANGE = `(?:de\\s+)?${DAY}\\s+a\\s+${DAY}`
const DAY_LIST = `${DAY}(?:\\s*(?:,|i)\\s*${DAY})*`
const DAY_SPEC = `(?:${DAY_RANGE}|${EVERY_DAY}|${DAY_LIST})`

const SHIFT = `(?:de\\s+|d')?(?:les\\s+)?${TIME}\\s*h?\\s*a\\s*(?:les\\s+)?${TIME}\\s*h`
const SHIFTS = `${SHIFT}(?:\\s*(?:i|,)\\s*${SHIFT})*`
const SHOWS = `${TIME}\\s*h(?:\\s*(?:i|,)\\s*${TIME}\\s*h)*`
const TIME_SPEC = `(?:tancat|${SHIFTS}|${SHOWS})`

/** Winter/summer regimes; one weekly schedule could only misrepresent them. */
const SEASONAL = new RegExp(`horari d'(?:hivern|estiu)|(?:d'|de\\s+)${MONTH}\\s+a\\s+${MONTH}\\s*:`, 'i')

/** Two dated ranges, each with its own hours, are seasonal regimes too. A single
 * range is just the run, and a holiday list ("excepte 1 de gener") is not one. */
const DATE_RANGE = /\b(?:del|de\s+l')\s*\d{1,2}[^()]{0,25}?\bal\s+(?:l')?\s*\d{1,2}/gi
/** Individually dated sessions, where each is really its own event. */
const DATED_SESSIONS = new RegExp(
  `${DAY},?\\s+\\d{1,2}\\s*(?:de\\s+)?${MONTH}|${MONTH}\\s+${DAY}\\s+\\d{1,2}\\s*:`,
  'i',
)
/** Access on request, not an opening schedule. */
const CONDITIONAL = /cita prèvia|\balterns?\b/i

/** A closing-time note would otherwise read as an extra showtime. */
const LAST_ENTRY = /\((?:[^()]*?(?:darrera|última|ultima)\s+entrada[^()]*)\)/gi

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\u2019\u2018`\u00b4]/g, "'")
    .replace(/[\u2013\u2014]/g, ' a ')
    .replace(/\u00a0/g, ' ')
    .replace(LAST_ENTRY, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function canonicalDay(word: string): string {
  if (word.startsWith('dissabte')) return 'dissabte'
  if (word.startsWith('diumenge')) return 'diumenge'
  return word
}

function expandRange(from: string, to: string): Weekday[] {
  const start = WEEK_ORDER.indexOf(canonicalDay(from) as (typeof WEEK_ORDER)[number])
  const end = WEEK_ORDER.indexOf(canonicalDay(to) as (typeof WEEK_ORDER)[number])
  if (start < 0 || end < 0) return []

  const days: Weekday[] = []
  for (let i = start; days.length <= WEEK_ORDER.length; i = (i + 1) % WEEK_ORDER.length) {
    days.push(WEEKDAY_BY_NAME[WEEK_ORDER[i]])
    if (i === end) break
  }
  return days
}

function toMinutes(time: string): number | null {
  const [rawHours, rawMinutes] = time.split(/[.:]/)
  const hours = Number(rawHours)
  const minutes = Number(rawMinutes ?? 0)
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

function parseDays(daySpec: string): Weekday[] {
  const range = new RegExp(`^(?:de\\s+)?(${DAY})\\s+a\\s+(${DAY})$`).exec(daySpec)
  if (range) return expandRange(range[1], range[2])
  if (new RegExp(`^${EVERY_DAY}$`).test(daySpec)) return WEEK_ORDER.map((day) => WEEKDAY_BY_NAME[day])
  return (daySpec.match(new RegExp(DAY, 'g')) ?? []).map((day) => WEEKDAY_BY_NAME[canonicalDay(day)])
}

function parseTimeSpec(timeSpec: string): OpeningInterval[] | 'closed' | null {
  if (timeSpec.startsWith('tancat')) return 'closed'

  const shifts = [
    ...timeSpec.matchAll(
      new RegExp(`(?:de\\s+|d')?(?:les\\s+)?(${TIME})\\s*h?\\s*a\\s*(?:les\\s+)?(${TIME})\\s*h`, 'g'),
    ),
  ]
  if (shifts.length > 0) {
    const intervals: OpeningInterval[] = []
    for (const [, from, to] of shifts) {
      const start = toMinutes(from)
      const end = toMinutes(to)
      if (start === null || end === null) return null
      intervals.push({ start, end })
    }
    return intervals
  }

  const shows = [...timeSpec.matchAll(new RegExp(`(${TIME})\\s*h`, 'g'))]
  if (shows.length === 0) return null

  const showtimes: OpeningInterval[] = []
  for (const [, time] of shows) {
    const start = toMinutes(time)
    if (start === null) return null
    showtimes.push({ start })
  }
  return showtimes
}

/** Split out so its digits cannot later be read as opening times. */
function takeDuration(text: string): { durationMinutes?: number; rest: string } {
  const clause = /durada[^:]{0,20}:?\s*[^.()]{0,40}/.exec(text)
  if (!clause) return { rest: text }

  const rest = text.replace(clause[0], ' ')
  const hours = /(\d{1,2})\s*hor(?:a|es)/.exec(clause[0])
  const minutes = /(\d{1,3})\s*minuts?/.exec(clause[0])

  const total = (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0)
  return total > 0 ? { durationMinutes: total, rest } : { rest }
}

/**
 * Reads the dataset's free-text `horari` into a weekly schedule. Returns null
 * rather than a guess when the text carries more than one regime, dated
 * one-off sessions, or no recognizable time at all.
 */
export function parseHorari(raw: string | undefined): Horari | null {
  if (!raw?.trim()) return null

  const normalized = normalize(raw)
  if (SEASONAL.test(normalized) || DATED_SESSIONS.test(normalized) || CONDITIONAL.test(normalized)) return null
  if ([...normalized.matchAll(DATE_RANGE)].length > 1) return null

  const { durationMinutes, rest: text } = takeDuration(normalized)
  const week: OpeningHours = {}
  let matched = false

  const clause = new RegExp(`(${DAY_SPEC})(?:\\s+(?:i|no)\\s+festius)?\\s*[,:]?\\s*(${TIME_SPEC})`, 'g')
  for (const [, daySpec, timeSpec] of text.matchAll(clause)) {
    const days = parseDays(daySpec)
    const value = parseTimeSpec(timeSpec)
    if (days.length === 0 || value === null) continue

    matched = true
    for (const day of days) week[day] = value
  }

  const closed = new RegExp(
    `tancats?\\s*:?\\s*(?:els?\\s+)?(${DAY}(?:\\s*(?:,|i)\\s*${DAY})*)`,
    'g',
  )
  for (const [, dayList] of text.matchAll(closed)) {
    for (const day of parseDays(dayList)) week[day] = 'closed'
    matched = true
  }

  // A time with no weekday attached describes every day the event runs.
  if (!matched) {
    const everyDay = parseTimeSpec(text)
    if (everyDay !== null && everyDay !== 'closed') {
      for (const day of WEEK_ORDER) week[WEEKDAY_BY_NAME[day]] = everyDay
      matched = true
    }
  }

  return matched ? { week, ...(durationMinutes !== undefined && { durationMinutes }) } : null
}
