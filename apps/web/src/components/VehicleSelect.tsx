import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import {
  formatVehicleLabel,
  parseVehicleLabel,
  vehicleMakes,
  vehicleModels,
  vehicleYears,
} from '@/domain/moroccan-vehicles.ts'
import { cn } from '@/lib/utils'

const OTHER = '__other__'

const selectClass =
  'flex min-h-12 w-full rounded-[var(--radius-labas)] border-2 border-border bg-surface px-4 py-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:border-ink disabled:cursor-not-allowed disabled:opacity-50'

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

type VehicleSelectProps = {
  id?: string
  value: string
  onChange: (vehicle: string) => void
  className?: string
}

/** Marque, modèle, année from a local Moroccan parc list. Autre keeps free text. */
export function VehicleSelect({ id, value, onChange, className }: VehicleSelectProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(() => draftFromValue(value))
  const years = vehicleYears()
  const models = vehicleModels(draft.make)
  const other = draft.make === OTHER

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

  return (
    <div className="grid gap-2" data-testid="vehicle-select">
      <select
        id={id}
        aria-label={t('onboarding.vehicleMake')}
        value={draft.make}
        className={cn(selectClass, className)}
        data-testid="vehicle-make"
        onChange={(e) => {
          const make = e.target.value
          publish({
            make,
            model: '',
            year: '',
            otherText: make === OTHER ? draft.otherText : '',
          })
        }}
      >
        <option value="">{t('onboarding.vehicleMake')}</option>
        {vehicleMakes().map((make) => (
          <option key={make} value={make}>
            {make}
          </option>
        ))}
        <option value={OTHER}>{t('onboarding.vehicleOther')}</option>
      </select>

      {other ? (
        <Input
          aria-label={t('onboarding.vehicle')}
          value={draft.otherText}
          placeholder={t('onboarding.vehicleOtherPh')}
          data-testid="vehicle-other"
          onChange={(e) => publish({ ...draft, otherText: e.target.value })}
        />
      ) : (
        <>
          <select
            aria-label={t('onboarding.vehicleModel')}
            value={draft.model}
            disabled={!draft.make}
            className={cn(selectClass, className)}
            data-testid="vehicle-model"
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
            className={cn(selectClass, className)}
            data-testid="vehicle-year"
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
