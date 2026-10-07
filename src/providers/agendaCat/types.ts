/**
 * One row of the Generalitat's "Agenda cultural de Catalunya (per
 * localitzacions)" dataset. Rows are (event, venue) pairs: a run across
 * several venues repeats `codi` once per venue, each with its own location.
 *
 * Socrata returns every value as a string, including coordinates.
 */
export interface AgendaCatEvent {
  /** Socrata's per-row id, unique where `codi` is not. Only returned when `$select` asks for it. */
  ':id': string
  /** The event's own id, shared by every venue it runs at. */
  codi?: string
  denominaci?: string
  subt_tol?: string
  descripcio?: string
  /** Local date, always at 00:00:00 — the dataset never carries a real time. */
  data_inici?: string
  data_fi?: string
  /** Free text, e.g. "20.30 h" or "de 10 a 20 h". Absent about a third of the time. */
  horari?: string
  /** "Sí" / "No". */
  gratuita?: string
  /** Free-text ticket/price detail. */
  entrades?: string
  /** Venue name. */
  espai?: string
  adre_a?: string
  localitat?: string
  /** Slug, e.g. "agenda:ubicacions/barcelona/barcelones/barcelona". */
  municipi?: string
  latitud?: string
  longitud?: string
  url?: string
  /** Path relative to the agenda's own host, not an absolute URL. */
  imatges?: string
  /** Comma-separated slugs, e.g. "agenda:categories/concerts". */
  tags_categor_es?: string
}

/** Socrata's 4xx body. */
export interface AgendaCatErrorResponse {
  message?: string
  errorCode?: string
}
