import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
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

const LIST_GAP = 4
const EDGE = 8
const LIST_MAX_PX = 280

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

function stickyFooterTop(): number {
  const el = document.querySelector('[data-sticky-actions-footer]:not([hidden])')
  if (!(el instanceof HTMLElement)) return window.innerHeight
  const r = el.getBoundingClientRect()
  if (r.height <= 0 || r.top >= window.innerHeight) return window.innerHeight
  return r.top
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

type ListPos = {
  top: number
  left: number
  width: number
  maxHeight: number
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
  const listId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState(() => draftFromValue(value))
  const [makeOpen, setMakeOpen] = useState(false)
  const [pos, setPos] = useState<ListPos>({ top: 0, left: 0, width: 0, maxHeight: LIST_MAX_PX })
  const years = vehicleYears()
  const models = vehicleModels(draft.make)
  const makes = vehicleMakes()
  const other = draft.make === OTHER
  const gapMake = highlight && !draft.make
  const gapModel = highlight && Boolean(draft.make) && draft.make !== OTHER && !draft.model
  const gapYear = highlight && Boolean(draft.model) && !draft.year
  const gapOther = highlight && other && !draft.otherText.trim()
  const gapStyle = 'border-alert ring-2 ring-alert/35'

  useEffect(() => {
    setDraft((current) => {
      if (value === committedLabel(current)) return current
      if (!value.trim() && current.make && current.make !== OTHER && !current.year) return current
      return draftFromValue(value)
    })
  }, [value])

  useLayoutEffect(() => {
    if (!makeOpen) return
    function place() {
      const r = triggerRef.current?.getBoundingClientRect()
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
  }, [makeOpen])

  useEffect(() => {
    if (!makeOpen) return
    function onDoc(e: MouseEvent) {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (listRef.current?.contains(target)) return
      setMakeOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [makeOpen])

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

  const makeList = makeOpen
    ? createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="fixed z-[80] overflow-auto rounded-[var(--radius-labas)] border border-border bg-surface py-1 shadow-[0_12px_40px_-16px_rgba(16,40,96,0.45)]"
          style={{
            top: pos.top,
            left: pos.left,
            width: pos.width,
            maxHeight: pos.maxHeight,
          }}
          data-testid="vehicle-make-list"
        >
          {makes.map((make) => (
            <li key={make} role="option" aria-selected={make === draft.make}>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-sand-deep',
                  make === draft.make && 'bg-ink-soft',
                )}
                data-testid={`vehicle-make-option-${make}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickMake(make)}
              >
                <MakeLogo make={make} />
                <span>{make}</span>
              </button>
            </li>
          ))}
          <li role="option" aria-selected={other}>
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-sand-deep',
                other && 'bg-ink-soft',
              )}
              data-testid="vehicle-make-option-other"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pickMake(OTHER)}
            >
              <span className="h-7 w-7 shrink-0" aria-hidden />
              <span>{t('onboarding.vehicleOther')}</span>
            </button>
          </li>
        </ul>,
        document.body,
      )
    : null

  return (
    <div ref={rootRef} className={cn('grid gap-2', className)} data-testid="vehicle-select">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-label={t('onboarding.vehicleMake')}
        aria-haspopup="listbox"
        aria-expanded={makeOpen}
        aria-controls={listId}
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
      {makeList}

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
