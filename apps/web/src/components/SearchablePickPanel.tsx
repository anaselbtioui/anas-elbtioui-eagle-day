import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

const LIST_GAP = 4
const EDGE = 8
const PANEL_MAX_PX = 320
const SEARCH_ROW_PX = 52

export function normalizePickQuery(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

function stickyFooterTop(): number {
  const el = document.querySelector('[data-sticky-actions-footer]:not([hidden])')
  if (!(el instanceof HTMLElement)) return window.innerHeight
  const r = el.getBoundingClientRect()
  if (r.height <= 0 || r.top >= window.innerHeight) return window.innerHeight
  return r.top
}

export type SearchablePickOption = {
  value: string
  label: string
  /** Extra searchable text (accents already ok — we normalize). */
  searchText?: string
  leading?: ReactNode
}

type SearchablePickPanelProps = {
  open: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  options: SearchablePickOption[]
  value: string
  onPick: (value: string) => void
  searchPlaceholder: string
  emptyLabel: string
  listTestId: string
  searchTestId?: string
  optionTestId?: (value: string) => string
}

/**
 * Portaled searchable list for modal/sheet contexts.
 * Sticky search row + scrollable options. Uses pointer-events-auto for Radix body lock.
 */
export function SearchablePickPanel({
  open,
  onClose,
  anchorRef,
  options,
  value,
  onPick,
  searchPlaceholder,
  emptyLabel,
  listTestId,
  searchTestId,
  optionTestId,
}: SearchablePickPanelProps) {
  const listId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, maxHeight: PANEL_MAX_PX })

  const filtered = useMemo(() => {
    const q = normalizePickQuery(query)
    if (!q) return options
    return options.filter((opt) => {
      const hay = normalizePickQuery(`${opt.label} ${opt.searchText ?? ''} ${opt.value}`)
      return hay.includes(q)
    })
  }, [options, query])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const id = window.requestAnimationFrame(() => searchRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    function place() {
      const r = anchorRef.current?.getBoundingClientRect()
      if (!r) return
      const bottomLimit = stickyFooterTop() - EDGE
      const spaceBelow = Math.max(0, bottomLimit - (r.bottom + LIST_GAP))
      const spaceAbove = Math.max(0, r.top - EDGE - LIST_GAP)
      const preferBelow =
        spaceBelow >= Math.min(PANEL_MAX_PX, 160) || spaceBelow >= spaceAbove
      const maxHeight = Math.max(120, Math.min(PANEL_MAX_PX, preferBelow ? spaceBelow : spaceAbove))
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
  }, [open, anchorRef, filtered.length])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const target = e.target as Node
      if (anchorRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose, anchorRef])

  if (!open) return null

  const listMax = Math.max(72, pos.maxHeight - SEARCH_ROW_PX)

  return createPortal(
    <div
      ref={panelRef}
      id={listId}
      className="pointer-events-auto fixed z-[80] flex flex-col overflow-hidden rounded-[var(--radius-labas)] border border-border bg-surface shadow-[0_12px_40px_-16px_rgba(16,40,96,0.45)]"
      style={{
        top: pos.top,
        left: pos.left,
        width: pos.width,
        maxHeight: pos.maxHeight,
      }}
      data-testid={listTestId}
    >
      <div className="shrink-0 border-b border-border/60 p-2">
        <input
          ref={searchRef}
          type="search"
          value={query}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          autoComplete="off"
          className="min-h-10 w-full rounded-[calc(var(--radius-labas)-2px)] border-2 border-border bg-sand/40 px-3 text-sm text-ink placeholder:text-ink-muted focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          data-testid={searchTestId}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              onClose()
            }
            if (e.key === 'Enter' && filtered[0]) {
              e.preventDefault()
              onPick(filtered[0].value)
            }
          }}
        />
      </div>
      <ul role="listbox" className="min-h-0 flex-1 overflow-y-auto py-1" style={{ maxHeight: listMax }}>
        {filtered.length === 0 ? (
          <li className="px-4 py-3 text-sm text-ink-muted">{emptyLabel}</li>
        ) : (
          filtered.map((opt) => (
            <li key={opt.value} role="option" aria-selected={opt.value === value}>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-sand-deep',
                  opt.value === value && 'bg-ink-soft',
                )}
                data-testid={optionTestId?.(opt.value)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(opt.value)}
              >
                {opt.leading ?? null}
                <span className="min-w-0 truncate">{opt.label}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>,
    document.body,
  )
}
