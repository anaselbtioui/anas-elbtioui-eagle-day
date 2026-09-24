import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SearchablePickPanel, type SearchablePickOption } from '@/components/SearchablePickPanel'
import { MOROCCAN_INSURERS, isMoroccanInsurer } from '@/domain/moroccan-insurers.ts'
import { cn } from '@/lib/utils'

type InsurerSelectProps = {
  id?: string
  value: string
  onChange: (insurer: string) => void
  placeholder?: string
  className?: string
  'data-testid'?: string
}

/** Fixed list of Moroccan insurers — searchable pick, no free text. */
export function InsurerSelect({
  id,
  value,
  onChange,
  placeholder,
  className,
  'data-testid': testId,
}: InsurerSelectProps) {
  const { t } = useTranslation()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const trimmed = value.trim()
  // Provision used to seed "Assureur" — never show it as a real pick.
  const shown = trimmed === 'Assureur' ? '' : trimmed
  const known = isMoroccanInsurer(shown)
  const label = shown || placeholder || t('onboarding.insurerPick')

  const options: SearchablePickOption[] = useMemo(() => {
    const list = MOROCCAN_INSURERS.map((name) => ({ value: name, label: name }))
    if (shown && !known) {
      return [{ value: shown, label: shown }, ...list]
    }
    return list
  }, [shown, known])

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-label={placeholder || t('onboarding.insurer')}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex min-h-12 w-full items-center rounded-[var(--radius-labas)] border-2 border-border bg-surface py-3 pl-4 pr-10 text-left text-base text-ink',
          "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23102860'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:1.1rem] bg-[right_0.875rem_center] bg-no-repeat",
          'focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink',
          !shown && 'text-ink-muted',
        )}
        data-testid={testId ?? 'insurer-select'}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
        }}
      >
        <span className="min-w-0 truncate">{label}</span>
      </button>

      <SearchablePickPanel
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        options={options}
        value={shown}
        onPick={(next) => {
          onChange(next)
          setOpen(false)
        }}
        searchPlaceholder={t('onboarding.insurerSearch')}
        emptyLabel={t('onboarding.insurerEmpty')}
        listTestId="insurer-select-list"
        searchTestId="insurer-select-search"
        optionTestId={(v) => `insurer-option-${v}`}
      />
    </div>
  )
}
