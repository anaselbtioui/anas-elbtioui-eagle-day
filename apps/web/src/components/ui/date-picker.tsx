import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addMonths,
  formatDisplayFr,
  formatIsoDate,
  monthGrid,
  parseIsoDate,
  sameDay,
  startOfMonth,
} from '@/lib/iso-date.ts'
import { uiLocale } from '@/i18n'
import { cn } from '@/lib/utils'

type DatePickerProps = {
  id?: string
  value: string
  onChange: (iso: string) => void
  className?: string
  disabled?: boolean
  /** Wallet gap resume — alert border on the trigger. */
  highlight?: boolean
  'data-testid'?: string
  'aria-invalid'?: boolean
}

const PANEL_GAP = 4
const EDGE = 8
const PANEL_H = 340

function stickyFooterTop(): number {
  const el = document.querySelector('[data-sticky-actions-footer]:not([hidden])')
  if (!(el instanceof HTMLElement)) return window.innerHeight
  const r = el.getBoundingClientRect()
  if (r.height <= 0 || r.top >= window.innerHeight) return window.innerHeight
  return r.top
}

type PanelPos = { top: number; left: number; width: number; maxHeight: number }

function weekdayLetters(locale: string): string[] {
  // 2024-01-01 is a Monday — Monday-first grid.
  const base = new Date(2024, 0, 1)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)
    return new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(d)
  })
}

/**
 * Labas date field: ISO value in, locale-aware UI out.
 * Popover portals above sticky footers; clamps to viewport.
 */
export function DatePicker({
  id,
  value,
  onChange,
  className,
  disabled,
  highlight = false,
  'data-testid': testId,
  'aria-invalid': ariaInvalid,
}: DatePickerProps) {
  const { t, i18n } = useTranslation()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => parseIsoDate(value), [value])
  const [view, setView] = useState(() => startOfMonth(selected ?? new Date()))
  const [pos, setPos] = useState<PanelPos>({ top: 0, left: 0, width: 0, maxHeight: PANEL_H })

  useEffect(() => {
    if (selected) setView(startOfMonth(selected))
  }, [selected])

  useLayoutEffect(() => {
    if (!open) return
    function place() {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      const bottomLimit = stickyFooterTop() - EDGE
      const spaceBelow = Math.max(0, bottomLimit - (r.bottom + PANEL_GAP))
      const spaceAbove = Math.max(0, r.top - EDGE - PANEL_GAP)
      const preferBelow = spaceBelow >= Math.min(PANEL_H, 200) || spaceBelow >= spaceAbove
      const maxHeight = Math.max(200, Math.min(PANEL_H, preferBelow ? spaceBelow : spaceAbove))
      setPos({
        top: preferBelow ? r.bottom + PANEL_GAP : r.top - PANEL_GAP - maxHeight,
        left: r.left,
        width: Math.max(r.width, 280),
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
  }, [open, view])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const path = typeof e.composedPath === 'function' ? e.composedPath() : []
      if (path.includes(panelRef.current as EventTarget)) return
      if (path.includes(rootRef.current as EventTarget)) return
      const t = e.target as Node
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    // pointerdown (not mousedown): day cell click can finish before dismiss.
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const cells = useMemo(() => monthGrid(view), [view])
  const today = useMemo(() => new Date(), [])
  const locale = uiLocale(i18n.language)
  const weekdays = useMemo(() => weekdayLetters(locale), [locale])
  const monthLabel = view.toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  })

  const display = value ? formatDisplayFr(value) : ''

  function pick(day: Date) {
    onChange(formatIsoDate(day))
    setOpen(false)
  }

  const panel =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="dialog"
            aria-modal="true"
            aria-label={t('fields.datePickerLabel')}
            data-testid="date-picker-panel"
            className="fixed z-[80] overflow-y-auto rounded-[var(--radius-labas)] border-2 border-border bg-surface shadow-[0_12px_40px_rgba(16,40,96,0.14)]"
            style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
              <p className="min-w-0 flex-1 truncate font-display text-base font-bold capitalize text-ink">
                {monthLabel}
              </p>
              <div className="flex shrink-0 gap-0.5">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-labas)] text-ink transition-[background-color,transform] duration-150 ease-out hover:bg-sand-deep active:scale-[0.96]"
                  onClick={() => setView((v) => addMonths(v, -1))}
                  aria-label={t('fields.datePrevMonth')}
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-labas)] text-ink transition-[background-color,transform] duration-150 ease-out hover:bg-sand-deep active:scale-[0.96]"
                  onClick={() => setView((v) => addMonths(v, 1))}
                  aria-label={t('fields.dateNextMonth')}
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-0.5 px-2 pt-2" aria-hidden>
              {weekdays.map((d, i) => (
                <span
                  key={`${d}-${i}`}
                  className="flex h-8 items-center justify-center text-xs font-semibold text-ink-muted"
                >
                  {d}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5 px-2 pb-2" role="listbox">
              {cells.map((day) => {
                const inMonth = day.getMonth() === view.getMonth()
                const isSelected = selected ? sameDay(day, selected) : false
                const isToday = sameDay(day, today)
                return (
                  <button
                    key={formatIsoDate(day)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-iso={formatIsoDate(day)}
                    onClick={() => pick(day)}
                    className={cn(
                      'flex h-9 items-center justify-center rounded-[var(--radius-labas)] text-sm font-medium transition-[background-color,color,transform] duration-150 ease-out',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink',
                      'active:scale-[0.96]',
                      !inMonth && 'text-ink-muted/45',
                      inMonth && !isSelected && 'text-ink hover:bg-sand-deep',
                      isToday && !isSelected && 'ring-1 ring-inset ring-ink/25',
                      isSelected && 'bg-ink text-sand hover:bg-ink',
                    )}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border/60 px-3 py-2">
              <button
                type="button"
                className="min-h-10 text-sm font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
              >
                {t('fields.dateClear')}
              </button>
              <button
                type="button"
                className="min-h-10 text-sm font-semibold text-ink underline-offset-4 hover:underline"
                onClick={() => {
                  const now = new Date()
                  setView(startOfMonth(now))
                  pick(now)
                }}
              >
                {t('fields.dateToday')}
              </button>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className={cn('relative', className)} data-testid={testId ?? 'date-picker'}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="dialog"
        aria-invalid={ariaInvalid}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-labas)] border-2 bg-surface px-4 py-3 text-left text-base',
          'transition-[border-color,box-shadow] duration-150 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:border-ink',
          'disabled:cursor-not-allowed disabled:opacity-50',
          ariaInvalid || highlight ? 'border-alert' : 'border-border',
          highlight && !open && 'ring-2 ring-alert/35',
          open && 'border-ink ring-2 ring-ink',
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', display ? 'text-ink' : 'text-ink-muted')}>
          {display || t('fields.datePlaceholder')}
        </span>
        <svg
          className="h-5 w-5 shrink-0 text-ink"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 3v4M16 3v4" />
        </svg>
      </button>
      {panel}
    </div>
  )
}
