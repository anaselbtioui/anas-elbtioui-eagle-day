import { useTranslation } from 'react-i18next'
import type { LifecycleStage, LifecycleStageState } from '@/domain/lifecycle.ts'
import { lifecycleTonePaint } from '@/domain/lifecycle-tone.ts'
import { cn } from '@/lib/utils'

function stateLabelKey(state: LifecycleStageState): string {
  return `lifecycle.state.${state}`
}

export type LifecycleRailAction = {
  id: string
  label: string
  onClick: () => void
  disabled?: boolean
}

export type LifecycleRailStage = LifecycleStage & {
  /** Localized short detail under the stage (non-interactive). */
  detail?: string
  /** Actionable chips under the stage (e.g. request a missing piece). */
  actions?: LifecycleRailAction[]
}

type LifecycleRailProps = {
  stages: LifecycleRailStage[]
  className?: string
}

/** Compact vertical rail — next / current / done stages. */
export function LifecycleRail({ stages, className }: LifecycleRailProps) {
  const { t } = useTranslation()
  return (
    <ol className={cn('space-y-0', className)}>
      {stages.map((stage, i) => {
        const paint = lifecycleTonePaint(stage.tone)
        const last = i === stages.length - 1
        const detail = stage.detail ?? (stage.block ? t(stage.block.titleKey) : null)
        const actions = stage.actions
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
              {actions?.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {actions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      disabled={action.disabled}
                      onClick={action.onClick}
                      className={cn(
                        'rounded-[var(--radius-labas)] border border-border bg-sand-deep px-2 py-1',
                        'text-xs font-semibold text-ink transition-colors',
                        'hover:border-moss/40 hover:bg-moss-soft hover:text-moss',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/40',
                        'disabled:pointer-events-none disabled:opacity-50',
                      )}
                      data-testid={`lifecycle-action-${action.id}`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : detail ? (
                <p className="mt-1 text-xs leading-snug text-ink-muted">{detail}</p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
