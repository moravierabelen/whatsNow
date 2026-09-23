/**
 * Loading state: a pin "scanning" the city with expanding pulse rings —
 * only uses the accent pink already in the design system, no dependency on
 * the still-undecided category icon/color system (see categoryPresentation.ts).
 */
export function LoadingRadar() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-14">
      <div className="relative grid h-24 w-24 place-items-center" role="img" aria-label="Loading">
        <span className="radar-ring" />
        <span className="radar-ring" />
        <span className="radar-ring" />
        <span className="radar-pin" />
      </div>
      <p className="text-sm text-ink-muted">Finding your next plan…</p>
    </div>
  )
}
