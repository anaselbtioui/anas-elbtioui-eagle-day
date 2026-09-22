import { cn } from '@/lib/utils'
import type { CarPart } from '@/domain/evidence'

const LAYOUT: { id: CarPart; className: string }[] = [
  { id: 'front', className: 'col-start-2 row-start-1' },
  { id: 'frontLeft', className: 'col-start-1 row-start-2' },
  { id: 'hood', className: 'col-start-2 row-start-2' },
  { id: 'frontRight', className: 'col-start-3 row-start-2' },
  { id: 'left', className: 'col-start-1 row-start-3' },
  { id: 'roof', className: 'col-start-2 row-start-3' },
  { id: 'right', className: 'col-start-3 row-start-3' },
  { id: 'rearLeft', className: 'col-start-1 row-start-4' },
  { id: 'trunk', className: 'col-start-2 row-start-4' },
  { id: 'rearRight', className: 'col-start-3 row-start-4' },
  { id: 'rear', className: 'col-start-2 row-start-5' },
]

export function CarDamageMap({
  selected,
  onToggle,
  labels,
}: {
  selected: CarPart[]
  onToggle: (part: CarPart) => void
  labels: Record<CarPart, string>
}) {
  return (
    <div className="mx-auto grid max-w-xs grid-cols-3 grid-rows-5 gap-2">
      {LAYOUT.map((cell) => {
        const active = selected.includes(cell.id)
        return (
          <button
            key={cell.id}
            type="button"
            onClick={() => onToggle(cell.id)}
            className={cn(
              cell.className,
              'flex min-h-14 flex-col items-center justify-center rounded-[var(--radius-labas)] border-2 px-1 text-center text-xs font-semibold',
              active
                ? 'border-ink bg-ink text-sand'
                : 'border-border bg-surface text-ink hover:border-ink',
            )}
            aria-pressed={active}
          >
            <span className="text-lg leading-none">{active ? '✓' : '+'}</span>
            <span className="mt-1 leading-tight">{labels[cell.id]}</span>
          </button>
        )
      })}
    </div>
  )
}
