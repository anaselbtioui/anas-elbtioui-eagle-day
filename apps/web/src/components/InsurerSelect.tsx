import { MOROCCAN_INSURERS, isMoroccanInsurer } from '@/domain/moroccan-insurers.ts'
import { cn } from '@/lib/utils'

const selectClass =
  "min-h-12 w-full appearance-none rounded-[var(--radius-labas)] border-2 border-border bg-surface bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23102860'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:1.1rem] bg-[right_0.875rem_center] bg-no-repeat py-3 pl-4 pr-10 text-base text-ink focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-not-allowed disabled:opacity-50"

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
  // Provision used to seed "Assureur" — never show it as a real pick.
  const shown = trimmed === 'Assureur' ? '' : trimmed
  const known = isMoroccanInsurer(shown)

  return (
    <select
      id={id}
      value={shown}
      onChange={(e) => onChange(e.target.value)}
      className={cn(selectClass, className)}
      data-testid={testId ?? 'insurer-select'}
    >
      <option value="">{placeholder}</option>
      {!known && shown ? <option value={shown}>{shown}</option> : null}
      {MOROCCAN_INSURERS.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  )
}
