import React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'hover' | 'luxury'
  children: React.ReactNode
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  className,
  children,
  ...props
}) => {
  const variantClasses = {
    default: 'card',
    hover: 'card-hover',
    luxury: 'card-luxury'
  }

  return (
    <div
      className={cn(variantClasses[variant], className)}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn('px-6 py-4 border-b border-gray-200', className)}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const CardContent: React.FC<CardContentProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn('p-6', className)}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const CardFooter: React.FC<CardFooterProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn('px-6 py-4 border-t border-gray-200 bg-gray-50', className)}
      {...props}
    >
      {children}
    </div>
  )
}