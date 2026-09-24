import { useMemo, useRef, useState } from 'react'
import { Geolocation } from '@capacitor/geolocation'
import { useTranslation } from 'react-i18next'
import {
  MOROCCAN_CITIES,
  findNearestCity,
  isMoroccanCity,
} from '@/domain/moroccan-cities.ts'
import { LabasIcon } from '@/components/LabasIcon'
import { SearchablePickPanel, type SearchablePickOption } from '@/components/SearchablePickPanel'
import { cn } from '@/lib/utils'

type CitySelectProps = {
  id?: string
  value: string
  onChange: (city: string) => void
  className?: string
  /** Wallet gap resume — paint alert border on the trigger. */
  highlight?: boolean
  'data-testid'?: string
  /** Show “Ma position” control. Default true. */
  allowGeolocate?: boolean
}

/**
 * Curated Moroccan city pick — button trigger + portaled search (same pattern
 * as insurer). Avoids a free-text city input so Chrome address autofill cannot
 * overlay / misalign / spill into nearby name fields.
 */
export function CitySelect({
  id,
  value,
  onChange,
  className,
  highlight = false,
  'data-testid': testId,
  allowGeolocate = true,
}: CitySelectProps) {
  const { t } = useTranslation()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoHint, setGeoHint] = useState<string | null>(null)

  const trimmed = value.trim()
  const valid = !trimmed || isMoroccanCity(trimmed)
  const label = trimmed || t('fields.citySearch')

  const options: SearchablePickOption[] = useMemo(
    () => MOROCCAN_CITIES.map((city) => ({ value: city.name, label: city.name })),
    [],
  )

  function pick(name: string) {
    onChange(name)
    setOpen(false)
    setGeoHint(null)
  }

  async function useMyLocation() {
    setGeoBusy(true)
    setGeoHint(null)
    try {
      const posGeo = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 12_000,
      })
      const nearest = findNearestCity(posGeo.coords.latitude, posGeo.coords.longitude)
      pick(nearest.name)
    } catch {
      setGeoHint(t('fields.cityGeoDenied'))
    } finally {
      setGeoBusy(false)
    }
  }

  return (
    <div className={cn('relative space-y-2', className)} data-testid={testId ?? 'city-select'}>
      <div className="flex gap-2">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          aria-label={t('onboarding.city')}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'flex min-h-12 min-w-0 flex-1 items-center rounded-[var(--radius-labas)] border-2 bg-surface py-3 pl-4 pr-10 text-left text-base',
            "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23102860'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:1.1rem] bg-[right_0.875rem_center] bg-no-repeat",
            'transition-[border-color,box-shadow] duration-150 ease-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:border-ink',
            !valid || highlight ? 'border-alert' : 'border-border',
            highlight && 'ring-2 ring-alert/35',
            trimmed ? 'text-ink' : 'text-ink-muted',
          )}
          data-testid="city-select-input"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
          }}
        >
          <span className="min-w-0 truncate">{label}</span>
        </button>
        {allowGeolocate ? (
          <button
            type="button"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-labas)] border-2 border-border bg-sand-deep text-ink transition-[transform,background-color] duration-150 ease-out hover:bg-border active:scale-[0.96] disabled:opacity-50"
            disabled={geoBusy}
            onClick={() => void useMyLocation()}
            aria-label={t('fields.cityUseLocation')}
            title={t('fields.cityUseLocation')}
            data-testid="city-geolocate"
          >
            {geoBusy ? (
              <span className="text-sm font-semibold" aria-hidden>
                …
              </span>
            ) : (
              <LabasIcon name="location" className="h-5 w-5" tone="onSand" aria-hidden />
            )}
          </button>
        ) : null}
      </div>

      <SearchablePickPanel
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        options={options}
        value={trimmed}
        onPick={pick}
        searchPlaceholder={t('fields.citySearch')}
        emptyLabel={t('fields.cityEmpty')}
        listTestId="city-select-list"
        searchTestId="city-select-search"
        optionTestId={(v) => `city-option-${v}`}
      />

      {geoHint ? (
        <p className="text-sm text-ink-muted" data-testid="city-geo-hint">
          {geoHint}
        </p>
      ) : null}
    </div>
  )
}
