/** A per-weekday grid ("Dimecres: 20 h Divendres: 19 h") has no single start time. */
const WEEKDAY_SCHEDULE = /\b(dilluns|dimarts|dimecres|dijous|divendres|dissabte|diumenge)/i

/** Opening hours ("de 10 a 20 h") describe a window, not a start. */
const TIME_RANGE = /\bde\s+\d{1,2}[.:h]?\d{0,2}\s*h?\s+a\s+/i

const LEADING_TIME = /^\s*(?:a\s+les\s+)?(\d{1,2})(?:[.:](\d{2}))?\s*h\b/i

/**
 * Recovers the start time the dataset drops from `data_inici`, which is always
 * midnight. Only a plain leading time counts ("20.30 h", "18 h Durada…");
 * opening ranges and weekday grids stay unparsed and the event keeps its
 * date-only treatment.
 */
export function parseHorariStartTime(horari: string | undefined): string | null {
  if (!horari) return null
  if (WEEKDAY_SCHEDULE.test(horari) || TIME_RANGE.test(horari)) return null

  const match = LEADING_TIME.exec(horari)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2] ?? 0)
  if (hours > 23 || minutes > 59) return null

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
