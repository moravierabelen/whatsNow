import type { Event } from '../../domain/events/event'
import { CATEGORY_COLOR, CATEGORY_TINT } from './categoryPresentation'

interface EventThumbnailProps {
  event: Event
  /** `hero` is the one "featured" image (stronger color, no muting filter);
   * `thumb` is every smaller listing/rail thumbnail. */
  variant: 'hero' | 'thumb'
  className?: string
}

/** Shared image treatment: a color grade + faint grain so placeholder art
 * reads closer to editorial photography than flat UI graphics, plus a
 * designed fallback for events with no image — never a gray box. */
export function EventThumbnail({ event, variant, className = '' }: EventThumbnailProps) {
  const vivid = variant === 'hero'

  if (event.image) {
    return (
      <div className={`card-image grain relative overflow-hidden bg-surface-sunken ${className}`}>
        <img
          src={event.image.url}
          alt=""
          className="h-full w-full object-cover"
          style={vivid ? { filter: 'contrast(1.08) saturate(1.05)' } : { filter: 'saturate(0.82) contrast(1.12) brightness(0.96)' }}
          loading="lazy"
        />
      </div>
    )
  }

  return (
    <div className={`card-image relative flex items-center justify-center ${className}`} style={{ backgroundColor: CATEGORY_TINT[event.category] }}>
      <span className={`font-display font-semibold ${vivid ? 'text-5xl' : 'text-lg'}`} style={{ color: CATEGORY_COLOR[event.category] }}>
        {event.name.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}
