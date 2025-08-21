// Base component patterns - foundational building blocks with consistent interfaces

import { forwardRef, ReactNode } from 'react'
import { BaseComponentProps, LoadingState } from '@/types'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

/**
 * Enhanced base props for all components
 */
export interface EnhancedBaseProps extends BaseComponentProps {
  children?: ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}

/**
 * Base container component with consistent spacing and layout
 */
export interface ContainerProps extends EnhancedBaseProps {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  background?: 'transparent' | 'white' | 'gray' | 'dark'
}

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  ({ 
    children, 
    className = '', 
    maxWidth = 'lg', 
    padding = 'md',
    background = 'transparent',
    testId,
    ...props 
  }, ref) => {
    const maxWidthClasses = {
      sm: 'max-w-sm',
      md: 'max-w-md', 
      lg: 'max-w-4xl',
      xl: 'max-w-6xl',
      '2xl': 'max-w-7xl',
      full: 'max-w-full'
    }

    const paddingClasses = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8'
    }

    const backgroundClasses = {
      transparent: '',
      white: 'bg-white',
      gray: 'bg-gray-50',
      dark: 'bg-gray-900'
    }

    return (
      <div
        ref={ref}
        className={`
          mx-auto
          ${maxWidthClasses[maxWidth]}
          ${paddingClasses[padding]}
          ${backgroundClasses[background]}
          ${className}
        `}
        data-testid={testId}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Container.displayName = 'Container'

/**
 * Base card component with consistent styling
 */
export interface CardProps extends EnhancedBaseProps {
  padding?: 'none' | 'sm' | 'md' | 'lg'
  shadow?: 'none' | 'sm' | 'md' | 'lg'
  border?: boolean
  hover?: boolean
  onClick?: () => void
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ 
    children, 
    className = '', 
    padding = 'md',
    shadow = 'md',
    border = true,
    hover = false,
    onClick,
    testId,
    ...props 
  }, ref) => {
    const paddingClasses = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8'
    }

    const shadowClasses = {
      none: '',
      sm: 'shadow-sm',
      md: 'shadow-md',
      lg: 'shadow-lg'
    }

    return (
      <div
        ref={ref}
        className={`
          bg-white rounded-lg
          ${paddingClasses[padding]}
          ${shadowClasses[shadow]}
          ${border ? 'border border-gray-200' : ''}
          ${hover ? 'hover:shadow-lg transition-shadow duration-200' : ''}
          ${onClick ? 'cursor-pointer' : ''}
          ${className}
        `}
        onClick={onClick}
        data-testid={testId}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

/**
 * Base button component with consistent variants
 */
export interface ButtonProps extends EnhancedBaseProps {
  type?: 'button' | 'submit' | 'reset'
  onClick?: () => void
  loadingState?: LoadingState
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    children, 
    className = '', 
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    disabled = false,
    loading = false,
    loadingState,
    leftIcon,
    rightIcon,
    type = 'button',
    onClick,
    testId,
    ...props 
  }, ref) => {
    const isLoading = loading || loadingState === 'loading'
    const isDisabled = disabled || isLoading

    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2'
    
    const variantClasses = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300',
      secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 disabled:bg-gray-300',
      outline: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-300',
      ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500 disabled:text-gray-300'
    }

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base'
    }

    return (
      <button
        ref={ref}
        type={type}
        className={`
          ${baseClasses}
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        disabled={isDisabled}
        onClick={onClick}
        data-testid={testId}
        {...props}
      >
        {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
        {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'

/**
 * Base input component with consistent styling
 */
export interface InputProps extends Omit<EnhancedBaseProps, 'children'> {
  type?: 'text' | 'email' | 'password' | 'number' | 'search'
  placeholder?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  onFocus?: () => void
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  label?: string
  helperText?: string
  required?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className = '', 
    type = 'text',
    size = 'md',
    fullWidth = false,
    disabled = false,
    error,
    placeholder,
    value,
    defaultValue,
    onChange,
    onBlur,
    onFocus,
    leftIcon,
    rightIcon,
    label,
    helperText,
    required = false,
    testId,
    ...props 
  }, ref) => {
    const baseClasses = 'border rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2'
    
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-4 py-3 text-base'
    }

    const stateClasses = error
      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              {leftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            type={type}
            className={`
              ${baseClasses}
              ${sizeClasses[size]}
              ${stateClasses}
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon ? 'pr-10' : ''}
              ${fullWidth ? 'w-full' : ''}
              ${disabled ? 'bg-gray-50 text-gray-500' : 'bg-white'}
              ${className}
            `}
            placeholder={placeholder}
            value={value}
            defaultValue={defaultValue}
            onChange={(e) => onChange?.(e.target.value)}
            onBlur={onBlur}
            onFocus={onFocus}
            disabled={disabled}
            data-testid={testId}
            {...props}
          />
          
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>
        
        {(helperText || error) && (
          <p className={`mt-1 text-sm ${error ? 'text-red-600' : 'text-gray-500'}`}>
            {typeof error === 'string' ? error : error?.message || helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

/**
 * Base loading wrapper component
 */
export interface LoadingWrapperProps extends Omit<EnhancedBaseProps, 'error'> {
  loading: boolean
  error?: string | null
  isEmpty?: boolean
  emptyMessage?: string
  loadingComponent?: ReactNode
  errorComponent?: ReactNode
  emptyComponent?: ReactNode
}

export const LoadingWrapper: React.FC<LoadingWrapperProps> = ({
  children,
  loading,
  error,
  isEmpty = false,
  emptyMessage = 'No data available',
  loadingComponent,
  errorComponent,
  emptyComponent,
  className = '',
  testId
}) => {
  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`} data-testid={testId}>
        {loadingComponent || <LoadingSpinner size="lg" />}
      </div>
    )
  }

  if (error) {
    return (
      <div className={`text-center p-8 ${className}`} data-testid={testId}>
        {errorComponent || (
          <div className="text-red-600">
            <div className="text-2xl mb-2">⚠️</div>
            <p>{error}</p>
          </div>
        )}
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className={`text-center p-8 text-gray-500 ${className}`} data-testid={testId}>
        {emptyComponent || (
          <div>
            <div className="text-2xl mb-2">📭</div>
            <p>{emptyMessage}</p>
          </div>
        )}
      </div>
    )
  }

  return <div className={className} data-testid={testId}>{children}</div>
}

LoadingWrapper.displayName = 'LoadingWrapper'