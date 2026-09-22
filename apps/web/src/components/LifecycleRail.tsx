import { useTranslation } from 'react-i18next'
import type { LifecycleStage, LifecycleStageState } from '@/domain/lifecycle.ts'
import { lifecycleTonePaint } from '@/domain/lifecycle-tone.ts'
import { cn } from '@/lib/utils'

function stateLabelKey(state: LifecycleStageState): string {
  return `lifecycle.state.${state}`
}

type LifecycleRailProps = {
  stages: LifecycleStage[]
  className?: string
}

/** Compact vertical rail — next / current / done stages for hover tip. */
export function LifecycleRail({ stages, className }: LifecycleRailProps) {
  const { t } = useTranslation()
  return (
    <ol className={cn('space-y-0', className)}>
      {stages.map((stage, i) => {
        const paint = lifecycleTonePaint(stage.tone)
        const last = i === stages.length - 1
        return (
          <li key={stage.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2.5">
            <div className="relative flex justify-center pt-1">
              {!last ? (
                <span
                  className="absolute top-5 bottom-[-0.35rem] w-0.5 rounded-full"
                  style={{ background: paint.stroke, opacity: 0.35 }}
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  'relative z-[1] h-3.5 w-3.5 rounded-full border-[1.5px]',
                  stage.state === 'active' && 'ring-4 ring-ink/5',
                )}
                style={{ background: paint.fill, borderColor: paint.stroke }}
                aria-hidden
              />
            </div>
            <div className={cn('min-w-0 pb-3', last && 'pb-0')}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p
                  className={cn(
                    'font-display text-sm font-semibold leading-tight text-ink',
                    stage.state === 'pending' && 'opacity-70',
                  )}
                >
                  {t(stage.titleKey)}
                </p>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold leading-none"
                  style={{
                    background: paint.fill,
                    color: paint.stroke,
                    border: `1px solid color-mix(in srgb, ${paint.stroke} 35%, white)`,
                  }}
                >
                  {t(stateLabelKey(stage.state))}
                </span>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
