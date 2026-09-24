import { useWeather } from '../../hooks/useWeather'
import { DAY_CONDITION_ICON, NIGHT_CONDITION_ICON, formatSunset, isDaytime, shouldShowSunset } from './weatherPresentation'

/** City-code style abbreviations — presentation only, not derivable from
 * the name itself (e.g. "BCN" is Barcelona's IATA code, not a prefix), so
 * this has to be a manual lookup, same pattern as `categoryPresentation.ts`.
 * Falls back to the capitalized slug for any city without one mapped.
 * Mobile-only (see the `lg:hidden`/`hidden lg:inline` split below) — desktop
 * always shows the full name. */
const CITY_ABBREVIATION: Record<string, string> = {
  barcelona: 'BCN',
}

function displayCityName(citySlug: string): string {
  return citySlug.charAt(0).toUpperCase() + citySlug.slice(1)
}

function displayCityAbbreviation(citySlug: string): string {
  return CITY_ABBREVIATION[citySlug] ?? displayCityName(citySlug)
}

/** A small, subtle, monochrome sun mark — just enough to give the
 * temperature slot a meaning at a glance. */
function WeatherIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1.6v1.3M8 13.1v1.3M14.4 8h-1.3M2.9 8H1.6M12.4 3.6l-0.9 0.9M4.5 11.5l-0.9 0.9M12.4 12.4l-0.9-0.9M4.5 4.5l-0.9-0.9" />
    </svg>
  )
}

/**
 * The temperature and condition icon are wired to `useWeather` (Open-Meteo).
 * The icon accounts for day/night (see `isDaytime`/`DAY_CONDITION_ICON`/
 * `NIGHT_CONDITION_ICON`), and a "Sunset HH:mm" segment appears only in the
 * 3-hour window before sunset —
 * see `shouldShowSunset`. Loading, error, and "unsupported city" all fall
 * back to the same neutral placeholder icon + `--°`, with no sunset segment
 * — never an invented temperature, condition, or sunset time.
 */
export function BrandHeader({ citySlug }: { citySlug: string }) {
  const { data: weather } = useWeather(citySlug)
  const referenceTime = new Date().toISOString()
  // A plain table lookup (not a function call) so the icon used as a JSX
  // tag below is always one of a fixed set of stable, module-level Phosphor
  // components — never something computed/created at render time.
  const ConditionIcon = weather
    ? (isDaytime(weather, referenceTime) ? DAY_CONDITION_ICON : NIGHT_CONDITION_ICON)[weather.condition]
    : null
  const showSunset = weather ? shouldShowSunset(weather, referenceTime) : false

  return (
    <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-6 px-6 py-5 lg:px-8">
      <span className="brand-mark font-display font-bold tracking-tight text-ink">
        whats<span className="text-accent">now</span>
      </span>
      <span className="flex items-center gap-1.5 font-mono text-xs tracking-tight text-ink-muted">
        <span className="lg:hidden">{displayCityAbbreviation(citySlug)}</span>
        <span className="hidden lg:inline">{displayCityName(citySlug)}</span>
        <span aria-hidden="true">·</span>
        {ConditionIcon ? (
          <ConditionIcon className="h-3.5 w-3.5 shrink-0" weight="bold" aria-hidden="true" />
        ) : (
          <WeatherIcon className="h-3.5 w-3.5 shrink-0" />
        )}
        <span aria-hidden="true">{weather ? `${Math.round(weather.temperatureC)}°` : '--°'}</span>
        {weather && showSunset && (
          <>
            <span aria-hidden="true">·</span>
            <span>{formatSunset(weather)}</span>
          </>
        )}
      </span>
    </div>
  )
}
