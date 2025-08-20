import React from 'react'

interface SkeletonLoaderProps {
  className?: string
  variant?: 'text' | 'rectangular' | 'circular' | 'card'
  width?: string | number
  height?: string | number
  lines?: number
  animate?: boolean
}

export function SkeletonLoader({
  className = '',
  variant = 'text',
  width,
  height,
  lines = 1,
  animate = true
}: SkeletonLoaderProps) {
  const baseClasses = `bg-gray-700/50 ${animate ? 'animate-pulse' : ''}`
  
  const getVariantClasses = () => {
    switch (variant) {
      case 'text':
        return 'rounded h-4'
      case 'rectangular':
        return 'rounded-lg'
      case 'circular':
        return 'rounded-full'
      case 'card':
        return 'rounded-xl'
      default:
        return 'rounded'
    }
  }

  const getStyle = () => {
    const style: React.CSSProperties = {}
    if (width) style.width = typeof width === 'number' ? `${width}px` : width
    if (height) style.height = typeof height === 'number' ? `${height}px` : height
    return style
  }

  if (variant === 'text' && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={`${baseClasses} ${getVariantClasses()}`}
            style={{
              ...getStyle(),
              width: index === lines - 1 ? '75%' : '100%' // Last line is shorter
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={`${baseClasses} ${getVariantClasses()} ${className}`}
      style={getStyle()}
    />
  )
}

// Predefined skeleton components for common use cases
export function StatCardSkeleton() {
  return (
    <div className="bg-gradient-to-br from-pkmn-card to-pkmn-surface rounded-xl p-4 border border-gray-700/50">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonLoader variant="text" width="60px" height="32px" />
          <SkeletonLoader variant="text" width="80px" height="14px" />
        </div>
        <SkeletonLoader variant="circular" width="32px" height="32px" />
      </div>
    </div>
  )
}

export function CommunityOverviewSkeleton() {
  return (
    <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
      <div className="flex items-center mb-4">
        <SkeletonLoader variant="circular" width="20px" height="20px" className="mr-2" />
        <SkeletonLoader variant="text" width="150px" height="24px" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="bg-pkmn-surface/50 rounded-lg p-4">
            <SkeletonLoader variant="text" width="80px" height="32px" className="mb-1" />
            <SkeletonLoader variant="text" width="120px" height="14px" className="mb-1" />
            <SkeletonLoader variant="text" width="100px" height="12px" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ActivityListSkeleton({ items = 3 }: { items?: number }) {
  return (
    <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
      <div className="flex items-center mb-4">
        <SkeletonLoader variant="circular" width="20px" height="20px" className="mr-2" />
        <SkeletonLoader variant="text" width="180px" height="24px" />
      </div>
      
      <div className="space-y-3">
        {Array.from({ length: items }).map((_, index) => (
          <div key={index} className="flex items-center space-x-3 p-3 rounded-lg bg-pkmn-surface/50">
            <SkeletonLoader variant="circular" width="8px" height="8px" />
            <div className="flex-1 space-y-1">
              <SkeletonLoader variant="text" width="200px" height="14px" />
              <SkeletonLoader variant="text" width="100px" height="12px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TrendingCardsSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
      <div className="flex items-center mb-4">
        <SkeletonLoader variant="circular" width="20px" height="20px" className="mr-2" />
        <SkeletonLoader variant="text" width="120px" height="24px" />
      </div>
      
      <div className="space-y-3">
        {Array.from({ length: items }).map((_, index) => (
          <div key={index} className="flex items-center space-x-3 p-3 rounded-lg bg-pkmn-surface/30">
            <SkeletonLoader variant="rectangular" width="48px" height="64px" />
            <div className="flex-1 space-y-1">
              <SkeletonLoader variant="text" width="150px" height="14px" />
              <SkeletonLoader variant="text" width="120px" height="12px" />
              <SkeletonLoader variant="text" width="80px" height="12px" />
            </div>
            <div className="text-right space-y-1">
              <SkeletonLoader variant="text" width="60px" height="14px" />
              <SkeletonLoader variant="text" width="50px" height="12px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TopCollectorsSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
      <div className="flex items-center mb-4">
        <SkeletonLoader variant="circular" width="20px" height="20px" className="mr-2" />
        <SkeletonLoader variant="text" width="140px" height="24px" />
      </div>
      
      <div className="space-y-3">
        {Array.from({ length: items }).map((_, index) => (
          <div key={index} className="flex items-center space-x-3 p-3 rounded-lg bg-pkmn-surface/30">
            <SkeletonLoader variant="circular" width="32px" height="32px" />
            <SkeletonLoader variant="circular" width="40px" height="40px" />
            <div className="flex-1 space-y-1">
              <SkeletonLoader variant="text" width="120px" height="14px" />
              <SkeletonLoader variant="text" width="100px" height="12px" />
            </div>
            <div className="text-right space-y-1">
              <SkeletonLoader variant="text" width="50px" height="14px" />
              <SkeletonLoader variant="text" width="60px" height="12px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SkeletonLoader