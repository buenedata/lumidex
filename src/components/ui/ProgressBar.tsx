import React from 'react'
import { cn } from '@/lib/utils'

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  variant?: 'default' | 'gold'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  label?: string
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  variant = 'default',
  size = 'md',
  showLabel = false,
  label,
  className,
  ...props
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)
  
  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  }
  
  const fillClasses = {
    default: 'progress-fill',
    gold: 'progress-fill-gold'
  }

  return (
    <div className={cn('w-full', className)} {...props}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            {label || `${value}/${max}`}
          </span>
          <span className="text-sm text-gray-500">
            {percentage.toFixed(1)}%
          </span>
        </div>
      )}
      <div className={cn('progress-bar', sizeClasses[size])}>
        <div
          className={cn(fillClasses[variant])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  variant?: 'default' | 'gold'
  showLabel?: boolean
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  variant = 'default',
  showLabel = true,
  className,
  ...props
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  
  const colors = {
    default: '#3b82f6',
    gold: '#ffd700'
  }

  return (
    <div 
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors[variant]}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold text-gray-900">
            {percentage.toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  )
}