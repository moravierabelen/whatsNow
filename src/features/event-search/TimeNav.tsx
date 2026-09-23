import type { TimeMode } from '../../domain/events/provider'
import { NavItem } from './NavItem'

const MODES: TimeMode[] = ['now', 'tonight', 'today', 'tomorrow', 'weekend']

const MODE_LABEL: Record<TimeMode, string> = {
  now: 'Now',
  tonight: 'Tonight',
  today: 'Today',
  tomorrow: 'Tomorrow',
  weekend: 'Weekend',
}

interface TimeNavProps {
  mode: TimeMode
  onChange: (mode: TimeMode) => void
}

export function TimeNav({ mode, onChange }: TimeNavProps) {
  return (
    <nav className="flex items-center gap-6 overflow-x-auto" aria-label="Time range">
      {MODES.map((m) => (
        <NavItem key={m} active={mode === m} onClick={() => onChange(m)}>
          {MODE_LABEL[m]}
        </NavItem>
      ))}
    </nav>
  )
}
