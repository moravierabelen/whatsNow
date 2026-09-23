function displayCityName(citySlug: string): string {
  return citySlug.charAt(0).toUpperCase() + citySlug.slice(1)
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
 * The temperature isn't wired to a real weather source yet — that's a
 * separate task (researching an API/library). The slot exists so
 * integrating it later is a placeholder swap, not new structure; until
 * then it shows a neutral placeholder, never an invented value.
 */
export function BrandHeader({ citySlug }: { citySlug: string }) {
  return (
    <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-6 px-6 py-5 lg:px-8">
      <span className="brand-mark font-display font-bold tracking-tight text-ink">
        whats<span className="text-accent">now</span>
      </span>
      <span className="hidden items-center gap-1.5 font-mono text-xs tracking-tight text-ink-muted md:flex">
        {displayCityName(citySlug)}
        <span aria-hidden="true">·</span>
        <WeatherIcon className="h-3.5 w-3.5 shrink-0" />
        <span aria-hidden="true">--°</span>
      </span>
    </div>
  )
}
