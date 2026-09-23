import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import * as React from 'react'
import { FluidHover } from '@/components/ui/fluid-hover'
import { cn } from '@/lib/utils'

export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <FluidHover>
    <RadioGroupPrimitive.Root className={cn('grid gap-3', className)} {...props} ref={ref}>
      {children}
    </RadioGroupPrimitive.Root>
  </FluidHover>
))
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

export const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      'aspect-square h-5 w-5 rounded-full border-2 border-ink text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
      <span className="labas-radio-dot h-2.5 w-2.5 origin-center rounded-full bg-ink" />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
))
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

export function RadioChoice({
  value,
  label,
  description,
  id,
}: {
  value: string
  label: string
  description?: string
  id?: string
}) {
  const inputId = id ?? value
  return (
    <label
      htmlFor={inputId}
      data-fluid-item
      className="relative z-[1] flex min-h-14 cursor-pointer items-start gap-3 rounded-[var(--radius-labas)] border-2 border-border bg-transparent p-4 has-[[data-state=checked]]:border-ink has-[[data-state=checked]]:bg-sand"
    >
      <RadioGroupItem value={value} id={inputId} className="mt-0.5" />
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold text-ink">{label}</span>
        {description ? <span className="text-sm text-ink-muted">{description}</span> : null}
      </span>
    </label>
  )
}
