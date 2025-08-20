import React from 'react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'dots' | 'pulse' | 'bars'
  className?: string
  text?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'default',
  className,
  text
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  }

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  }

  const renderSpinner = () => {
    switch (variant) {
      case 'dots':
        return (
          <div className="flex space-x-1">
            <div className={cn('bg-blue-600 rounded-full animate-bounce', sizeClasses[size])} style={{ animationDelay: '0ms' }}></div>
            <div className={cn('bg-blue-600 rounded-full animate-bounce', sizeClasses[size])} style={{ animationDelay: '150ms' }}></div>
            <div className={cn('bg-blue-600 rounded-full animate-bounce', sizeClasses[size])} style={{ animationDelay: '300ms' }}></div>
          </div>
        )
      
      case 'pulse':
        return (
          <div className={cn('bg-blue-600 rounded-full animate-pulse', sizeClasses[size])}></div>
        )
      
      case 'bars':
        return (
          <div className="flex space-x-1">
            <div className={cn('bg-blue-600 animate-pulse', sizeClasses[size])} style={{ animationDelay: '0ms' }}></div>
            <div className={cn('bg-blue-600 animate-pulse', sizeClasses[size])} style={{ animationDelay: '150ms' }}></div>
            <div className={cn('bg-blue-600 animate-pulse', sizeClasses[size])} style={{ animationDelay: '300ms' }}></div>
          </div>
        )
      
      default:
        return (
          <div className={cn('animate-spin rounded-full border-2 border-gray-300 border-t-blue-600', sizeClasses[size])}></div>
        )
    }
  }

  return (
    <div className={cn('flex flex-col items-center justify-center space-y-2', className)}>
      {renderSpinner()}
      {text && (
        <p className={cn('text-gray-600 animate-pulse', textSizeClasses[size])}>
          {text}
        </p>
      )}
    </div>
  )
}

interface LoadingOverlayProps {
  isLoading: boolean
  text?: string
  children: React.ReactNode
  className?: string
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  text = 'Loading...',
  children,
  className
}) => {
  return (
    <div className={cn('relative', className)}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
          <LoadingSpinner size="lg" text={text} />
        </div>
      )}
    </div>
  )
}

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  lines?: number
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'text',
  width,
  height,
  lines = 1
}) => {
  const baseClasses = 'animate-pulse bg-gray-200'
  
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md'
  }

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  if (variant === 'text' && lines > 1) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(baseClasses, variantClasses[variant], 'h-4')}
            style={{
              width: index === lines - 1 ? '75%' : '100%',
              ...style
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        variant === 'text' && 'h-4',
        className
      )}
      style={style}
    />
  )
}

interface CardSkeletonProps {
  className?: string
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ className }) => {
  return (
    <div className={cn('card p-6 space-y-4', className)}>
      <Skeleton variant="rectangular" height={200} />
      <Skeleton lines={2} />
      <div className="flex justify-between items-center">
        <Skeleton width={80} />
        <Skeleton width={60} />
      </div>
    </div>
  )
}

interface PokemonCardSkeletonProps {
  className?: string
}

export const PokemonCardSkeleton: React.FC<PokemonCardSkeletonProps> = ({ className }) => {
  return (
    <div className={cn('pokemon-card', className)}>
      <Skeleton variant="rectangular" className="w-full h-full" />
    </div>
  )
}