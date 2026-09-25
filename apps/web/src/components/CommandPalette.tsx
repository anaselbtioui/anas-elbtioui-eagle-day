import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { LabasIcon } from '@/components/LabasIcon'
import { cn } from '@/lib/utils'

export type CommandPaletteItem = {
  id: string
  title: string
  subtitle?: string
  icon?: ReactNode
  disabled?: boolean
  onSelect: () => void
}

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  items: CommandPaletteItem[]
  placeholder: string
  emptyLabel: string
  title: string
  inputTestId?: string
}

export function CommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  items,
  placeholder,
  emptyLabel,
  title,
  inputTestId,
}: CommandPaletteProps) {
  const titleId = useId()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!open) return
    setActiveIndex(0)
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  function moveActive(delta: number) {
    if (items.length === 0) return
    setActiveIndex((current) => {
      let next = current
      for (let step = 0; step < items.length; step += 1) {
        next = (next + delta + items.length) % items.length
        if (!items[next]?.disabled) return next
      }
      return current
    })
  }

  function selectIndex(index: number) {
    const item = items[index]
    if (!item || item.disabled) return
    item.onSelect()
    onOpenChange(false)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveActive(1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveActive(-1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      selectIndex(activeIndex)
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) onQueryChange('')
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="labas-overlay fixed inset-0 z-[70] bg-ink/40" />
        <Dialog.Content
          aria-labelledby={titleId}
          className="labas-dialog-panel fixed left-1/2 top-[min(20vh,8rem)] z-[71] w-[min(100%-1.5rem,28rem)] -translate-x-1/2 overflow-hidden rounded-[var(--radius-labas)] border border-border bg-surface shadow-[0_16px_48px_rgba(16,40,96,0.18)] outline-none"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <Dialog.Title id={titleId} className="sr-only">
            {title}
          </Dialog.Title>
          <div className="flex items-center gap-2 border-b border-border/70 px-3">
            <LabasIcon name="search" className="h-5 w-5 shrink-0" tone="onSand" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className="min-h-12 w-full bg-transparent py-3 text-base text-ink placeholder:text-ink-muted outline-none"
              data-testid={inputTestId}
              aria-label={placeholder}
              aria-controls={listId}
              aria-autocomplete="list"
              role="combobox"
              aria-expanded
              aria-activedescendant={
                items[activeIndex] ? `${listId}-option-${items[activeIndex].id}` : undefined
              }
            />
            <kbd className="hidden shrink-0 rounded-md border border-border bg-sand-deep/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-ink-muted sm:inline">
              esc
            </kbd>
          </div>
          <ul
            id={listId}
            role="listbox"
            className="labas-scroll max-h-[min(50vh,20rem)] overflow-y-auto p-1.5"
          >
            {items.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-ink-muted">{emptyLabel}</li>
            ) : (
              items.map((item, index) => {
                const active = index === activeIndex
                return (
                  <li key={item.id} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-option-${item.id}`}
                      role="option"
                      aria-selected={active}
                      disabled={item.disabled}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-[calc(var(--radius-labas)-2px)] px-3 py-2.5 text-left text-sm transition-colors',
                        item.disabled && 'cursor-not-allowed opacity-45',
                        active && !item.disabled
                          ? 'bg-ink-soft text-ink ring-1 ring-inset ring-ink/15'
                          : !item.disabled && 'text-ink hover:bg-sand-deep/70',
                      )}
                      onMouseEnter={() => {
                        if (!item.disabled) setActiveIndex(index)
                      }}
                      onClick={() => selectIndex(index)}
                    >
                      {item.icon ? (
                        <span className="shrink-0">{item.icon}</span>
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{item.title}</span>
                        {item.subtitle ? (
                          <span className="mt-0.5 block truncate text-xs text-ink-muted">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
