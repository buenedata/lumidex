import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type ButtonSize    = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children?: React.ReactNode
}

const variants: Record<ButtonVariant, string> = {
  primary:   'bg-accent text-white hover:bg-accent-light active:scale-95 glow-accent-sm',
  secondary: 'bg-surface border border-subtle text-primary hover:bg-elevated active:scale-95',
  ghost:     'bg-transparent text-secondary hover:text-primary hover:bg-elevated active:scale-95',
  danger:    'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 active:scale-95',
  outline:   'bg-transparent border border-subtle text-secondary hover:border-accent hover:text-accent active:scale-95',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-7  px-3 text-xs rounded-md gap-1.5',
  md: 'h-9  px-4 text-sm rounded-lg gap-2',
  lg: 'h-11 px-6 text-base rounded-xl gap-2.5',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
          'focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4 mr-1.5 opacity-75" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : null}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button }
export default Button
