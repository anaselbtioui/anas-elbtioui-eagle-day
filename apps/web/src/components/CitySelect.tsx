import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Geolocation } from '@capacitor/geolocation'
import { useTranslation } from 'react-i18next'
import {
  canonicalCityName,
  filterCities,
  findNearestCity,
  isMoroccanCity,
} from '@/domain/moroccan-cities.ts'
import { LabasIcon } from '@/components/LabasIcon'
import { cn } from '@/lib/utils'

type CitySelectProps = {
  id?: string
  value: string
  onChange: (city: string) => void
  className?: string
  /** Wallet gap resume — paint alert border on the search input. */
  highlight?: boolean
  'data-testid'?: string
  /** Show “Ma position” control. Default true. */
  allowGeolocate?: boolean
}

const LIST_GAP = 4
const EDGE = 8
/** Matches previous max-h-56 (~14rem). */
const LIST_MAX_PX = 224

function stickyFooterTop(): number {
  const el = document.querySelector('[data-sticky-actions-footer]:not([hidden])')
  if (!(el instanceof HTMLElement)) return window.innerHeight
  const r = el.getBoundingClientRect()
  if (r.height <= 0 || r.top >= window.innerHeight) return window.innerHeight
  return r.top
}

type ListPos = {
  top: number
  left: number
  width: number
  maxHeight: number
}

/**
 * Searchable single city pick from curated Moroccan list.
 * Optional Capacitor geolocation → nearest list city.
 * List portals above sticky footers; height flips/clamps to stay on screen.
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
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoHint, setGeoHint] = useState<string | null>(null)
  const [pos, setPos] = useState<ListPos>({ top: 0, left: 0, width: 0, maxHeight: LIST_MAX_PX })

  useEffect(() => {
    setQuery(value)
  }, [value])

  useLayoutEffect(() => {
    if (!open) return
    function place() {
      const r = inputRef.current?.getBoundingClientRect()
      if (!r) return
      const bottomLimit = stickyFooterTop() - EDGE
      const spaceBelow = Math.max(0, bottomLimit - (r.bottom + LIST_GAP))
      const spaceAbove = Math.max(0, r.top - EDGE - LIST_GAP)
      const preferBelow =
        spaceBelow >= Math.min(LIST_MAX_PX, 140) || spaceBelow >= spaceAbove
      const maxHeight = Math.max(72, Math.min(LIST_MAX_PX, preferBelow ? spaceBelow : spaceAbove))
      setPos({
        top: preferBelow ? r.bottom + LIST_GAP : r.top - LIST_GAP - maxHeight,
        left: r.left,
        width: r.width,
        maxHeight,
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, query])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const options = useMemo(() => filterCities(query, 14), [query])
  const valid = !value.trim() || isMoroccanCity(value)

  function pick(name: string) {
    onChange(name)
    setQuery(name)
    setOpen(false)
    setGeoHint(null)
  }

  function onBlurCommit() {
    const canon = canonicalCityName(query)
    if (canon) {
      pick(canon)
      return
    }
    if (value && isMoroccanCity(value)) {
      setQuery(value)
      return
    }
    setQuery(value)
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

  const list =
    open && options.length > 0
      ? createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            className="pointer-events-auto fixed z-[80] overflow-auto rounded-[var(--radius-labas)] border border-border bg-surface py-1 shadow-[0_12px_40px_-16px_rgba(16,40,96,0.45)]"
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
            }}
            data-testid="city-select-list"
          >
            {options.map((city) => (
              <li key={city.name} role="option" aria-selected={city.name === value}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-sand-deep',
                    city.name === value && 'bg-ink-soft',
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(city.name)}
                >
                  {city.name}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className={cn('relative space-y-2', className)} data-testid={testId ?? 'city-select'}>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          // Curated list only — never invite browser address autofill (it can
          // spill the city into nearby given-name / first-name fields).
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          name={`labas-city-${listId}`}
          value={query}
          placeholder={t('fields.citySearch')}
          className={cn(
            'flex min-h-12 w-full rounded-[var(--radius-labas)] border-2 bg-surface px-4 py-3 text-base text-ink',
            'transition-[border-color,box-shadow] duration-150 ease-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:border-ink',
            !valid || highlight ? 'border-alert' : 'border-border',
            highlight && 'ring-2 ring-alert/35',
          )}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setGeoHint(null)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => onBlurCommit(), 120)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'Enter' && options[0]) {
              e.preventDefault()
              pick(options[0].name)
            }
          }}
          data-testid="city-select-input"
        />
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
      {list}
      {geoHint ? (
        <p className="text-sm text-ink-muted" data-testid="city-geo-hint">
          {geoHint}
        </p>
      ) : null}
    </div>
  )
}
