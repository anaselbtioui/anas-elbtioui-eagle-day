import { cn } from '@/lib/utils'

type TraceSpinnerProps = {
  size?: number
  className?: string
  /** When true, hide from AT (parent already announces loading). */
  decorative?: boolean
  label?: string
}

const VIEW = 20
const SIDE = 17.5
const RADIUS = 4
const INSET = (VIEW - SIDE) / 2
/** Short dash on a pathLength=100 track (loading.dev Trace). */
const DASH = 22
const GAP = 78

/**
 * Rounded-square dash spinner (loading.dev Trace style).
 * Color via `currentColor`.
 */
export function TraceSpinner({
  size = 18,
  className,
  decorative = false,
  label = 'Chargement…',
}: TraceSpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      fill="none"
      className={cn('labas-trace-spinner shrink-0', className)}
      role={decorative ? undefined : 'status'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
    >
      <rect
        x={INSET}
        y={INSET}
        width={SIDE}
        height={SIDE}
        rx={RADIUS}
        ry={RADIUS}
        stroke="currentColor"
        strokeWidth={2.5}
        opacity={0.2}
      />
      <rect
        className="labas-trace-spinner__dash"
        x={INSET}
        y={INSET}
        width={SIDE}
        height={SIDE}
        rx={RADIUS}
        ry={RADIUS}
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        strokeDasharray={`${DASH} ${GAP}`}
      />
    </svg>
  )
}
