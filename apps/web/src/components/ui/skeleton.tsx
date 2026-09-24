import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SkeletonProps = {
  className?: string
}

/** Decorative bone — keep out of the accessibility tree. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'block rounded-[var(--radius-labas)] bg-sand-deep animate-pulse motion-reduce:animate-none',
        className,
      )}
    />
  )
}

type SkeletonStatusProps = {
  label: string
  className?: string
  children: ReactNode
}

/**
 * One live region for a skeleton group. Bones stay aria-hidden;
 * screen readers hear `label` once via the status wrapper.
 */
export function SkeletonStatus({ label, className, children }: SkeletonStatusProps) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}
