import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

type HighlightBox = {
  top: number
  left: number
  width: number
  height: number
}

type FluidHoverProps = {
  children: ReactNode
  className?: string
  /** Highlight fill. Default sand-deep. */
  highlightClassName?: string
}

/**
 * Sliding pointer highlight over `[data-fluid-item]` children.
 * Uses CSS transitions so reverse mid-move retargets (Fluid Functionalism).
 */
export function FluidHover({
  children,
  className,
  highlightClassName = 'bg-sand-deep/80',
}: FluidHoverProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<HighlightBox | null>(null)
  const [visible, setVisible] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    function onChange() {
      setReduceMotion(mq.matches)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const measure = useCallback((el: HTMLElement) => {
    const root = rootRef.current
    if (!root) return
    const rr = root.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    setBox({
      top: er.top - rr.top + root.scrollTop,
      left: er.left - rr.left + root.scrollLeft,
      width: er.width,
      height: er.height,
    })
  }, [])

  function onPointerMove(e: ReactPointerEvent) {
    if (reduceMotion) return
    const target = (e.target as HTMLElement | null)?.closest?.(
      '[data-fluid-item]',
    ) as HTMLElement | null
    if (!target || !rootRef.current?.contains(target)) {
      setVisible(false)
      return
    }
    if (target.hasAttribute('data-fluid-disabled')) {
      setVisible(false)
      return
    }
    measure(target)
    setVisible(true)
  }

  function onPointerLeave() {
    setVisible(false)
  }

  const style: CSSProperties | undefined = box
    ? {
        transform: `translate3d(${box.left}px, ${box.top}px, 0)`,
        width: box.width,
        height: box.height,
      }
    : undefined

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative',
        reduceMotion && '[&_[data-fluid-item]:hover]:bg-sand-deep/70',
        className,
      )}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {!reduceMotion ? (
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute left-0 top-0 z-0 rounded-[var(--radius-labas)]',
            highlightClassName,
            'transition-[transform,width,height,opacity] duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)]',
            visible && box ? 'opacity-100' : 'opacity-0',
          )}
          style={style}
        />
      ) : null}
      <div className="relative z-[1]">{children}</div>
    </div>
  )
}
