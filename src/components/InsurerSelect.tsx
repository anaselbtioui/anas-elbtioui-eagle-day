import { MOROCCAN_INSURERS, isMoroccanInsurer } from '@/domain/moroccan-insurers.ts'
import { cn } from '@/lib/utils'

const selectClass =
  'flex min-h-12 w-full rounded-[var(--radius-labas)] border-2 border-border bg-surface px-4 py-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:border-ink disabled:cursor-not-allowed disabled:opacity-50'

type InsurerSelectProps = {
  id?: string
  value: string
  onChange: (insurer: string) => void
  placeholder?: string
  className?: string
  'data-testid'?: string
}

/** Fixed list of Moroccan insurers — no free text. */
export function InsurerSelect({
  id,
  value,
  onChange,
  placeholder = 'Choisir…',
  className,
  'data-testid': testId,
}: InsurerSelectProps) {
  const trimmed = value.trim()
  const known = isMoroccanInsurer(trimmed)

  return (
    <select
      id={id}
      value={trimmed}
      onChange={(e) => onChange(e.target.value)}
      className={cn(selectClass, className)}
      data-testid={testId ?? 'insurer-select'}
    >
      <option value="">{placeholder}</option>
      {!known && trimmed ? <option value={trimmed}>{trimmed}</option> : null}
      {MOROCCAN_INSURERS.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  )
}
