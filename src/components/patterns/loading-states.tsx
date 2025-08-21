// Loading state patterns - comprehensive loading management components and utilities

import React, { ReactNode, useState, useEffect } from 'react'
import { Button } from './base-components'

/**
 * Loading spinner component with various sizes and styles
 */
interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'primary' | 'secondary' | 'white'
  className?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'primary',
  className = ''
}) => {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  }

  const variantClasses = {
    primary: 'text-blue-600',
    secondary: 'text-gray-600',
    white: 'text-white'
  }

  return (
    <svg
      className={`animate-spin ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

/**
 * Loading skeleton component for content placeholders
 */
interface LoadingSkeletonProps {
  className?: string
  variant?: 'text' | 'rect' | 'circle' | 'rounded'
  animation?: 'pulse' | 'wave' | 'none'
  lines?: number
  width?: string | number
  height?: string | number
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  className = '',
  variant = 'text',
  animation = 'pulse',
  lines = 1,
  width,
  height
}) => {
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-pulse', // Could be enhanced with custom wave animation
    none: ''
  }

  const variantClasses = {
    text: 'h-4 bg-gray-200 rounded',
    rect: 'bg-gray-200',
    circle: 'bg-gray-200 rounded-full',
    rounded: 'bg-gray-200 rounded-lg'
  }

  const baseClasses = `${variantClasses[variant]} ${animationClasses[animation]} ${className}`

  const style: React.CSSProperties = {}
  if (width) style.width = width
  if (height) style.height = height

  if (lines === 1) {
    return <div className={baseClasses} style={style} />
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={`${baseClasses} ${index === lines - 1 ? 'w-3/4' : ''}`}
          style={style}
        />
      ))}
    </div>
  )
}

/**
 * Loading overlay component for blocking interactions
 */
interface LoadingOverlayProps {
  isLoading: boolean
  children: ReactNode
  message?: string
  spinnerSize?: 'sm' | 'md' | 'lg'
  backdrop?: 'light' | 'dark' | 'blur'
  className?: string
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  children,
  message = 'Loading...',
  spinnerSize = 'md',
  backdrop = 'light',
  className = ''
}) => {
  const backdropClasses = {
    light: 'bg-white/80',
    dark: 'bg-gray-900/50',
    blur: 'bg-white/80 backdrop-blur-sm'
  }

  return (
    <div className={`relative ${className}`}>
      {children}
      {isLoading && (
        <div className={`
          absolute inset-0 z-50 flex flex-col items-center justify-center
          ${backdropClasses[backdrop]}
        `}>
          <LoadingSpinner size={spinnerSize} />
          {message && (
            <p className="mt-3 text-sm text-gray-600 font-medium">{message}</p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Progressive loading component for content that loads in stages
 */
interface ProgressiveLoadingProps {
  stages: Array<{
    key: string
    message: string
    completed: boolean
  }>
  className?: string
}

export const ProgressiveLoading: React.FC<ProgressiveLoadingProps> = ({
  stages,
  className = ''
}) => {
  const completedCount = stages.filter(stage => stage.completed).length
  const progress = (completedCount / stages.length) * 100

  return (
    <div className={`p-6 ${className}`}>
      <div className="mb-4">
        <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
          <span>Loading Progress</span>
          <span>{completedCount}/{stages.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {stages.map((stage) => (
          <div key={stage.key} className="flex items-center text-sm">
            {stage.completed ? (
              <svg className="w-4 h-4 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <LoadingSpinner size="xs" className="mr-3" />
            )}
            <span className={stage.completed ? 'text-gray-700' : 'text-gray-500'}>
              {stage.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Lazy loading wrapper with intersection observer
 */
interface LazyLoadWrapperProps {
  children: ReactNode
  placeholder?: ReactNode
  threshold?: number
  rootMargin?: string
  onLoad?: () => void
  className?: string
}

export const LazyLoadWrapper: React.FC<LazyLoadWrapperProps> = ({
  children,
  placeholder,
  threshold = 0.1,
  rootMargin = '100px',
  onLoad,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true)
          onLoad?.()
        }
      },
      { threshold, rootMargin }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [threshold, rootMargin, onLoad, isVisible])

  useEffect(() => {
    if (isVisible && !isLoaded) {
      // Simulate content loading
      const timer = setTimeout(() => setIsLoaded(true), 100)
      return () => clearTimeout(timer)
    }
  }, [isVisible, isLoaded])

  return (
    <div ref={ref} className={className}>
      {isVisible && isLoaded ? children : (
        placeholder || <LoadingSkeleton variant="rect" height={200} />
      )}
    </div>
  )
}

/**
 * Loading button with built-in states
 */
interface LoadingButtonProps {
  children: ReactNode
  isLoading?: boolean
  loadingText?: string
  onClick?: () => void | Promise<void>
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  children,
  isLoading: externalLoading = false,
  loadingText = 'Loading...',
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'md',
  className = ''
}) => {
  const [internalLoading, setInternalLoading] = useState(false)
  const isLoading = externalLoading || internalLoading

  const handleClick = async () => {
    if (onClick && !isLoading && !disabled) {
      setInternalLoading(true)
      try {
        await onClick()
      } finally {
        setInternalLoading(false)
      }
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || isLoading}
      variant={variant}
      size={size}
      className={className}
    >
      {isLoading ? (
        <div className="flex items-center">
          <LoadingSpinner size="xs" variant="white" className="mr-2" />
          {loadingText}
        </div>
      ) : (
        children
      )}
    </Button>
  )
}

/**
 * Data loading state component for lists and content
 */
interface DataLoadingStateProps {
  isLoading: boolean
  isEmpty: boolean
  error?: Error | string | null
  children: ReactNode
  loadingComponent?: ReactNode
  emptyComponent?: ReactNode
  errorComponent?: ReactNode
  retryAction?: () => void
  className?: string
}

export const DataLoadingState: React.FC<DataLoadingStateProps> = ({
  isLoading,
  isEmpty,
  error,
  children,
  loadingComponent,
  emptyComponent,
  errorComponent,
  retryAction,
  className = ''
}) => {
  // Error state
  if (error) {
    if (errorComponent) {
      return <div className={className}>{errorComponent}</div>
    }

    const errorMessage = error instanceof Error ? error.message : error

    return (
      <div className={`text-center p-8 ${className}`}>
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
        <p className="text-gray-600 mb-4">{errorMessage}</p>
        {retryAction && (
          <Button onClick={retryAction} variant="primary" size="sm">
            Try Again
          </Button>
        )}
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    if (loadingComponent) {
      return <div className={className}>{loadingComponent}</div>
    }

    return (
      <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">Loading data...</p>
      </div>
    )
  }

  // Empty state
  if (isEmpty) {
    if (emptyComponent) {
      return <div className={className}>{emptyComponent}</div>
    }

    return (
      <div className={`text-center p-8 ${className}`}>
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Found</h3>
        <p className="text-gray-600">There's nothing here yet.</p>
      </div>
    )
  }

  // Success state - render children
  return <div className={className}>{children}</div>
}

/**
 * Suspense-like loading boundary for async components
 */
interface LoadingBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  delay?: number
  className?: string
}

export const LoadingBoundary: React.FC<LoadingBoundaryProps> = ({
  children,
  fallback,
  delay = 200,
  className = ''
}) => {
  const [showFallback, setShowFallback] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowFallback(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  return (
    <React.Suspense
      fallback={
        <div className={className}>
          {showFallback && (
            fallback || (
              <div className="flex items-center justify-center p-8">
                <LoadingSpinner size="lg" />
              </div>
            )
          )}
        </div>
      }
    >
      {children}
    </React.Suspense>
  )
}

/**
 * Staggered loading animation for lists
 */
interface StaggeredLoadingProps {
  items: any[]
  renderItem: (item: any, index: number) => ReactNode
  staggerDelay?: number
  className?: string
}

export const StaggeredLoading: React.FC<StaggeredLoadingProps> = ({
  items,
  renderItem,
  staggerDelay = 100,
  className = ''
}) => {
  const [visibleItems, setVisibleItems] = useState<number>(0)

  useEffect(() => {
    if (items.length === 0) return

    const timer = setInterval(() => {
      setVisibleItems(prev => {
        if (prev >= items.length) {
          clearInterval(timer)
          return prev
        }
        return prev + 1
      })
    }, staggerDelay)

    return () => clearInterval(timer)
  }, [items.length, staggerDelay])

  return (
    <div className={className}>
      {items.slice(0, visibleItems).map((item, index) => (
        <div
          key={index}
          className="animate-fadeIn"
          style={{
            animationDelay: `${index * staggerDelay}ms`,
            animationFillMode: 'both'
          }}
        >
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  )
}