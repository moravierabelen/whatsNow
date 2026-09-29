import type { ReactNode } from 'react'

interface MaybeLinkProps {
  /** Absent when the event has nowhere to link to, see `Event.url`. */
  href?: string
  className: string
  children: ReactNode
}

export function MaybeLink({ href, className, children }: MaybeLinkProps) {
  if (!href) return <div className={className}>{children}</div>

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  )
}
