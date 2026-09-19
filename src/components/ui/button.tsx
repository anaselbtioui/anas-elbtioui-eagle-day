import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from '@radix-ui/react-slot'
import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-labas)]',
    'text-base font-semibold transition-[transform,box-shadow,background-color,border-color] duration-150',
    'cursor-pointer',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-sand',
    'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:translate-y-0 disabled:cursor-not-allowed',
    'min-h-12 px-5 select-none',
    'active:translate-y-[2px] active:shadow-none',
  ].join(' '),
  {
    variants: {
      variant: {
        default: [
          'bg-ink text-sand',
          'border border-ink',
          'shadow-[0_4px_0_0_#0a1838]',
          'hover:bg-[#16306e]',
          'active:shadow-[0_0_0_0_#0a1838]',
        ].join(' '),
        secondary: [
          'bg-sand-deep text-ink',
          'border border-border',
          'shadow-[0_3px_0_0_#c4bbaa]',
          'hover:bg-border',
          'active:shadow-[0_0_0_0_#c4bbaa]',
        ].join(' '),
        outline: [
          'border-2 border-ink bg-surface/80 text-ink',
          'shadow-[0_3px_0_0_#102860]',
          'hover:bg-sand-deep',
          'active:shadow-[0_0_0_0_#102860]',
        ].join(' '),
        ghost: 'text-ink hover:bg-sand-deep shadow-none active:translate-y-0',
        moss: [
          'bg-moss text-white border border-moss',
          'shadow-[0_4px_0_0_#156b54]',
          'hover:bg-[#1a7d62]',
          'active:shadow-[0_0_0_0_#156b54]',
        ].join(' '),
        alert: [
          'bg-alert text-white border border-alert',
          'shadow-[0_4px_0_0_#8a1c16]',
          'hover:bg-[#9e211a]',
          'active:shadow-[0_0_0_0_#8a1c16]',
        ].join(' '),
        softAlert: 'bg-alert-soft text-alert hover:bg-alert/10 shadow-none active:translate-y-0',
      },
      size: {
        default: 'min-h-12 px-5',
        sm: 'min-h-10 px-4 text-sm shadow-[0_3px_0_0_#0a1838]',
        lg: 'min-h-14 px-6 text-lg',
        icon: 'h-12 w-12 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'
