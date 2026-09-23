import type { ReactNode } from 'react'

export function SectionLabel({ children, count }: { children: ReactNode; count: number }) {
  return (
    <div className="mb-2 flex items-center gap-2.5">
      <span className="h-3 w-[3px] bg-accent" />
      <h3 className="text-[15px] font-semibold text-ink">{children}</h3>
      <span className="font-mono text-xs text-ink-faint">{count}</span>
    </div>
  )
}
