import type { ReactNode } from 'react'

interface NavItemProps {
  active: boolean
  onClick: () => void
  children: ReactNode
  /** CategoryNav's items are tabs; TimeNav's aren't part of a tablist and
   * gets `aria-current` instead — set per caller rather than assumed here. */
  role?: 'tab'
}

/** Shared nav item for both TimeNav and CategoryNav: same size/weight in
 * both, active state is a pink tick under the label sized to the label's
 * own width, not a fixed-width dash. */
export function NavItem({ active, onClick, children, role }: NavItemProps) {
  return (
    <button
      type="button"
      role={role}
      aria-selected={role === 'tab' ? active : undefined}
      aria-current={role === 'tab' ? undefined : active}
      onClick={onClick}
      className={`flex shrink-0 cursor-pointer flex-col items-center text-sm transition-colors ${
        active ? 'font-semibold text-ink' : 'font-medium text-ink-muted hover:text-ink'
      }`}
    >
      <span className="flex flex-col items-stretch gap-1.5">
        <span className="flex items-center gap-1.5 whitespace-nowrap">{children}</span>
        <span className={`h-[3px] rounded-full bg-accent transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0'}`} />
      </span>
    </button>
  )
}
