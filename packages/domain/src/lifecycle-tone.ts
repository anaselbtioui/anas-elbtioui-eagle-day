/** Traffic-light tones for lifecycle ring segments (wa-pharma / hamssah style). */
export type LifecycleTone = 'red' | 'amber' | 'green' | 'blue' | 'gray'

export type LifecycleSegment = {
  id: string
  tone: LifecycleTone
}

/** Paint for SVG donut slices — Labas tokens. */
export function lifecycleTonePaint(tone: LifecycleTone): { fill: string; stroke: string } {
  switch (tone) {
    case 'red':
      return { fill: 'var(--color-alert-soft)', stroke: 'var(--color-alert)' }
    case 'amber':
      return {
        fill: 'color-mix(in srgb, var(--color-sand-deep) 70%, white)',
        stroke: 'var(--color-ink)',
      }
    case 'green':
      return { fill: 'var(--color-moss-soft)', stroke: 'var(--color-moss)' }
    case 'blue':
      return {
        fill: 'color-mix(in srgb, var(--color-ink) 12%, white)',
        stroke: 'var(--color-ink)',
      }
    case 'gray':
    default:
      return {
        fill: 'color-mix(in srgb, var(--color-sand-deep) 55%, white)',
        stroke: 'color-mix(in srgb, var(--color-ink) 28%, white)',
      }
  }
}
