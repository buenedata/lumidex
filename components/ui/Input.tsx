import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={id} className="text-xs font-medium text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none flex items-center">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            className={cn(
              'w-full h-9 bg-surface border border-subtle rounded-lg px-3 text-sm text-primary',
              'placeholder:text-muted',
              'transition-colors duration-150',
              'hover:border-[rgba(255,255,255,0.15)]',
              'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30',
              icon ? 'pl-9' : '',
              error ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : '',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
export default Input
