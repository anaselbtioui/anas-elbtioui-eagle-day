import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { LifecycleStage } from '@/domain/lifecycle.ts'
import { lifecycleTonePaint, type LifecycleTone } from '@/domain/lifecycle-tone.ts'
import { LifecycleRail } from '@/components/LifecycleRail'
import { cn } from '@/lib/utils'

function donutSlicePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
): string {
  const sr = (startDeg * Math.PI) / 180
  const er = (endDeg * Math.PI) / 180
  const x1 = cx + rOuter * Math.cos(sr)
  const y1 = cy + rOuter * Math.sin(sr)
  const x2 = cx + rOuter * Math.cos(er)
  const y2 = cy + rOuter * Math.sin(er)
  const x3 = cx + rInner * Math.cos(er)
  const y3 = cy + rInner * Math.sin(er)
  const x4 = cx + rInner * Math.cos(sr)
  const y4 = cy + rInner * Math.sin(sr)
  const span = endDeg - startDeg
  const largeArc = Math.abs(span) > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4} Z`
}

function RingSvg({ tones, size }: { tones: LifecycleTone[]; size: number }) {
  const vb = size
  const cx = vb / 2
  const cy = vb / 2
  const rOuter = vb / 2 - 0.5
  const rInner = Math.max(rOuter - 3.4, 1.5)
  const gapDeg = 2.5
  const n = tones.length
  const arcSpan = (360 - n * gapDeg) / n

  return (
    <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} aria-hidden>
      {tones.map((tone, i) => {
        const startDeg = -90 + i * (arcSpan + gapDeg) + gapDeg / 2
        const endDeg = startDeg + arcSpan
        const { fill, stroke } = lifecycleTonePaint(tone)
        return (
          <path
            key={`${tone}-${i}`}
            d={donutSlicePath(cx, cy, rOuter, rInner, startDeg, endDeg)}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.55}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
    </svg>
  )
}

type LifecycleRingProps = {
  tones?: LifecycleTone[]
  /** When set, hover shows stage rail (next / current / done). */
  stages?: LifecycleStage[]
  /** Subset shown in the hover tip; defaults to all `stages`. */
  tipStages?: LifecycleStage[]
  label: string
  size?: number
  className?: string
}

const TIP_WIDTH = 248

/** Compact traffic-light donut — optional hover lifecycle rail (portaled). */
export function LifecycleRing({
  tones,
  stages,
  tipStages,
  label,
  size = 16,
  className,
}: LifecycleRingProps) {
  const { t } = useTranslation()
  const resolvedTones = tones ?? stages?.map((s) => s.tone) ?? []
  const tipList = tipStages ?? stages
  const blockKey =
    tipList?.find((s) => s.state === 'active' && s.block)?.block?.titleKey ??
    tipList?.find((s) => s.block)?.block?.titleKey ??
    stages?.find((s) => s.state === 'active' && s.block)?.block?.titleKey ??
    stages?.find((s) => s.block)?.block?.titleKey
  const accessibleLabel = blockKey ? `${label}. ${t(blockKey)}` : label
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  if (resolvedTones.length === 0) return null

  const hasTip = Boolean(tipList && tipList.length > 0)

  function place() {
    const r = anchorRef.current?.getBoundingClientRect()
    if (!r || !tipList) return
    const left = Math.min(
      Math.max(8, r.right - TIP_WIDTH),
      window.innerWidth - TIP_WIDTH - 8,
    )
    const below = r.bottom + 8
    const blockCount = tipList.filter((s) => s.block).length
    const tipH = 12 + tipList.length * 40 + blockCount * 32
    const top =
      below + tipH > window.innerHeight - 8 ? Math.max(8, r.top - tipH - 8) : below
    setPos({ top, left })
  }

  function show() {
    if (!hasTip) return
    place()
    setOpen(true)
  }

  function hide() {
    setOpen(false)
  }

  return (
    <span
      ref={anchorRef}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center',
        hasTip && 'cursor-help',
        className,
      )}
      aria-label={accessibleLabel}
      title={hasTip ? undefined : label}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={(e) => {
        if (!hasTip) return
        e.stopPropagation()
        if (open) hide()
        else show()
      }}
      onKeyDown={(e) => e.stopPropagation()}
      tabIndex={hasTip ? 0 : undefined}
      role={hasTip ? 'button' : undefined}
    >
      <RingSvg tones={resolvedTones} size={size} />
      {open && hasTip && tipList
        ? createPortal(
            <div
              role="tooltip"
              className="fixed z-[80] rounded-[var(--radius-labas)] border border-border bg-surface px-3 py-3 shadow-[0_12px_40px_-16px_rgba(16,40,96,0.45)]"
              style={{ top: pos.top, left: pos.left, width: TIP_WIDTH }}
              onMouseEnter={show}
              onMouseLeave={hide}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-2.5 text-xs font-semibold text-ink-muted">{label}</p>
              <LifecycleRail stages={tipList} />
            </div>,
            document.body,
          )
        : null}
    </span>
  )
}
