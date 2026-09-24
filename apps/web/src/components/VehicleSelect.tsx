import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { SearchablePickPanel, type SearchablePickOption } from '@/components/SearchablePickPanel'
import {
  formatVehicleLabel,
  parseVehicleLabel,
  vehicleMakes,
  vehicleModels,
  vehicleYears,
} from '@/domain/moroccan-vehicles.ts'
import { vehicleMakeLogoUrl } from '@/lib/vehicle-make-logos'
import { cn } from '@/lib/utils'

const OTHER = '__other__'

const selectClass =
  "min-h-12 w-full appearance-none rounded-[var(--radius-labas)] border-2 border-border bg-surface bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23102860'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:1.1rem] bg-[right_0.875rem_center] bg-no-repeat py-3 pl-4 pr-10 text-base text-ink focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-not-allowed disabled:opacity-50"

type Draft = {
  make: string
  model: string
  year: string
  otherText: string
}

function draftFromValue(value: string): Draft {
  const parsed = parseVehicleLabel(value)
  if (parsed) return { ...parsed, otherText: '' }
  if (value.trim()) return { make: OTHER, model: '', year: '', otherText: value }
  return { make: '', model: '', year: '', otherText: '' }
}

function committedLabel(draft: Draft): string {
  if (draft.make === OTHER) return draft.otherText
  if (draft.make && draft.model && draft.year) {
    return formatVehicleLabel(draft.make, draft.model, draft.year)
  }
  return ''
}

function MakeLogo({ make, className }: { make: string; className?: string }) {
  const url = vehicleMakeLogoUrl(make)
  const [failed, setFailed] = useState(false)
  if (!url || failed) return null
  return (
    <img
      src={url}
      alt=""
      width={28}
      height={28}
      className={cn('h-7 w-7 shrink-0 object-contain', className)}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}

type VehicleSelectProps = {
  id?: string
  value: string
  onChange: (vehicle: string) => void
  className?: string
  /** Wallet gap resume — alert border on incomplete selects. */
  highlight?: boolean
}

/** Marque, modèle, année from a local Moroccan parc list. Autre keeps free text. */
export function VehicleSelect({ id, value, onChange, className, highlight = false }: VehicleSelectProps) {
  const { t } = useTranslation()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [draft, setDraft] = useState(() => draftFromValue(value))
  const [makeOpen, setMakeOpen] = useState(false)
  const years = vehicleYears()
  const models = vehicleModels(draft.make)
  const other = draft.make === OTHER
  const gapMake = highlight && !draft.make
  const gapModel = highlight && Boolean(draft.make) && draft.make !== OTHER && !draft.model
  const gapYear = highlight && Boolean(draft.model) && !draft.year
  const gapOther = highlight && other && !draft.otherText.trim()
  const gapStyle = 'border-alert ring-2 ring-alert/35'

  const makeOptions: SearchablePickOption[] = useMemo(() => {
    const brands = vehicleMakes().map((make) => ({
      value: make,
      label: make,
      leading: <MakeLogo make={make} />,
    }))
    return [
      ...brands,
      {
        value: OTHER,
        label: t('onboarding.vehicleOther'),
        leading: <span className="h-7 w-7 shrink-0" aria-hidden />,
      },
    ]
  }, [t])

  useEffect(() => {
    setDraft((current) => {
      if (value === committedLabel(current)) return current
      if (!value.trim() && current.make && current.make !== OTHER && !current.year) return current
      return draftFromValue(value)
    })
  }, [value])

  function publish(next: Draft) {
    setDraft(next)
    const label = committedLabel(next)
    if (label !== value) onChange(label)
  }

  function pickMake(make: string) {
    publish({
      make,
      model: '',
      year: '',
      otherText: make === OTHER ? draft.otherText : '',
    })
    setMakeOpen(false)
  }

  const makeLabel =
    draft.make === OTHER
      ? t('onboarding.vehicleOther')
      : draft.make
        ? draft.make
        : t('onboarding.vehicleMake')

  return (
    <div className={cn('grid gap-2', className)} data-testid="vehicle-select">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-label={t('onboarding.vehicleMake')}
        aria-haspopup="listbox"
        aria-expanded={makeOpen}
        className={cn(
          'flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-labas)] border-2 border-border bg-surface py-3 pl-4 pr-10 text-left text-base text-ink',
          "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23102860'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:1.1rem] bg-[right_0.875rem_center] bg-no-repeat",
          'focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink',
          !draft.make && 'text-ink-muted',
          gapMake && gapStyle,
        )}
        data-testid="vehicle-make"
        data-wallet-gap={gapMake || undefined}
        onClick={() => setMakeOpen((open) => !open)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setMakeOpen(false)
        }}
      >
        {draft.make && draft.make !== OTHER ? <MakeLogo make={draft.make} /> : null}
        <span className="min-w-0 truncate">{makeLabel}</span>
      </button>

      <SearchablePickPanel
        open={makeOpen}
        onClose={() => setMakeOpen(false)}
        anchorRef={triggerRef}
        options={makeOptions}
        value={draft.make}
        onPick={pickMake}
        searchPlaceholder={t('onboarding.vehicleMakeSearch')}
        emptyLabel={t('onboarding.vehicleMakeEmpty')}
        listTestId="vehicle-make-list"
        searchTestId="vehicle-make-search"
        optionTestId={(v) =>
          v === OTHER ? 'vehicle-make-option-other' : `vehicle-make-option-${v}`
        }
      />

      {other ? (
        <Input
          aria-label={t('onboarding.vehicle')}
          value={draft.otherText}
          placeholder={t('onboarding.vehicleOtherPh')}
          data-testid="vehicle-other"
          data-wallet-gap={gapOther || undefined}
          className={cn(gapOther && gapStyle)}
          onChange={(e) => publish({ ...draft, otherText: e.target.value })}
        />
      ) : (
        <>
          <select
            aria-label={t('onboarding.vehicleModel')}
            value={draft.model}
            disabled={!draft.make}
            className={cn(selectClass, gapModel && gapStyle)}
            data-testid="vehicle-model"
            data-wallet-gap={gapModel || undefined}
            onChange={(e) => publish({ ...draft, model: e.target.value, year: '' })}
          >
            <option value="">{t('onboarding.vehicleModel')}</option>
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          <select
            aria-label={t('onboarding.vehicleYear')}
            value={draft.year}
            disabled={!draft.model}
            className={cn(selectClass, gapYear && gapStyle)}
            data-testid="vehicle-year"
            data-wallet-gap={gapYear || undefined}
            onChange={(e) => publish({ ...draft, year: e.target.value })}
          >
            <option value="">{t('onboarding.vehicleYear')}</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  )
}
