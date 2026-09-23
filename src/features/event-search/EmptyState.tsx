interface EmptyStateProps {
  onClearFilters?: () => void
}

export function EmptyState({ onClearFilters }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 border border-border-strong bg-surface px-8 py-14">
      <p className="font-display text-xl font-semibold text-ink">Nothing quite like that, yet</p>
      <p className="max-w-sm text-sm text-ink-muted">
        There's nothing matching that combination right now. Try another category, or check back for a different time.
      </p>
      {onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-1 cursor-pointer rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/90"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
