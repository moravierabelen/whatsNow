export function LiveDot({ className = '' }: { className?: string }) {
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-accent animate-live-pulse ${className}`} />
}
