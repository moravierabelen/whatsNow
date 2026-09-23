import type { EventCategory } from '../../domain/events/event'
import { CATEGORY_LABEL, CATEGORY_ORDER } from './categoryPresentation'
import { NavItem } from './NavItem'

interface CategoryNavProps {
  category: EventCategory | 'all'
  onChange: (category: EventCategory | 'all') => void
}

/** Single-select category filter — maps onto `SearchUrlState.categories`
 * as either `undefined` ('all') or a single-element array. */
export function CategoryNav({ category, onChange }: CategoryNavProps) {
  const items: Array<{ key: EventCategory | 'all'; label: string }> = [
    { key: 'all', label: 'All' },
    ...CATEGORY_ORDER.map((c) => ({ key: c, label: CATEGORY_LABEL[c] })),
  ]
  return (
    <div className="rail -mx-6 flex items-center gap-6 overflow-x-auto px-6 sm:mx-0 sm:px-0" role="tablist" aria-label="Category">
      {items.map((item) => (
        <NavItem key={item.key} role="tab" active={category === item.key} onClick={() => onChange(item.key)}>
          {item.label}
        </NavItem>
      ))}
    </div>
  )
}
