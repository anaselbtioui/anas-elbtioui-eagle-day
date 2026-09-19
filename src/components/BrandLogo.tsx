import { cn } from '@/lib/utils'

type Size = 'sm' | 'md' | 'lg' | 'xl'

const markSize: Record<Size, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-16 w-16',
  xl: 'h-24 w-24',
}

const logoHeight: Record<Size, string> = {
  sm: 'h-10',
  md: 'h-14',
  lg: 'h-40',
  xl: 'h-56',
}

/** Speech-bubble mark — `/brand/icon.png` (unchanged). */
export function BrandMark({
  size = 'md',
  className,
  alt = 'Med Assurance',
}: {
  size?: Size
  className?: string
  alt?: string
}) {
  return (
    <img
      src="/brand/icon.png"
      alt={alt}
      className={cn(markSize[size], 'shrink-0 object-contain', className)}
      draggable={false}
    />
  )
}

/** Full logo asset — `/brand/med-assurance-logo.png` (includes mark + wordmark). */
export function BrandLogo({
  size = 'lg',
  className,
  stacked = true,
}: {
  size?: Size
  className?: string
  /** When false: compact mark + text (logo PNG already has mark — avoid double). */
  stacked?: boolean
}) {
  if (!stacked) {
    return (
      <span className={cn('inline-flex items-center gap-2', className)}>
        <BrandMark size={size} />
        <span className="font-display text-lg font-extrabold leading-none text-ink sm:text-xl">
          Med Assurance
        </span>
      </span>
    )
  }

  return (
    <img
      src="/brand/med-assurance-logo.png"
      alt="Med Assurance"
      className={cn(
        'mx-auto bg-transparent object-contain object-center',
        logoHeight[size],
        'w-auto max-w-[min(100%,18rem)]',
        className,
      )}
      draggable={false}
    />
  )
}
