'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from './button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-6">
              We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
            </p>
            <div className="space-y-3">
              <Button onClick={this.handleReset} variant="primary">
                Try Again
              </Button>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline"
              >
                Refresh Page
              </Button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

interface ErrorMessageProps {
  title?: string
  message: string
  action?: {
    label: string
    onClick: () => void
  }
  variant?: 'error' | 'warning' | 'info'
  className?: string
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = 'Error',
  message,
  action,
  variant = 'error',
  className
}) => {
  const variantClasses = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  }

  const iconClasses = {
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }

  return (
    <div className={`border rounded-lg p-4 ${variantClasses[variant]} ${className}`}>
      <div className="flex items-start space-x-3">
        <span className="text-xl flex-shrink-0">{iconClasses[variant]}</span>
        <div className="flex-1">
          <h3 className="font-medium mb-1">{title}</h3>
          <p className="text-sm">{message}</p>
          {action && (
            <div className="mt-3">
              <Button
                onClick={action.onClick}
                size="sm"
                variant="outline"
                className="text-current border-current hover:bg-current hover:text-white"
              >
                {action.label}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface NetworkErrorProps {
  onRetry?: () => void
  className?: string
}

export const NetworkError: React.FC<NetworkErrorProps> = ({
  onRetry,
  className
}) => {
  return (
    <ErrorMessage
      title="Connection Error"
      message="Unable to connect to the server. Please check your internet connection and try again."
      action={onRetry ? { label: 'Retry', onClick: onRetry } : undefined}
      variant="warning"
      className={className}
    />
  )
}

interface NotFoundErrorProps {
  resource?: string
  onGoBack?: () => void
  className?: string
}

export const NotFoundError: React.FC<NotFoundErrorProps> = ({
  resource = 'resource',
  onGoBack,
  className
}) => {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="text-6xl mb-4">🔍</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        {resource.charAt(0).toUpperCase() + resource.slice(1)} Not Found
      </h2>
      <p className="text-gray-600 mb-6">
        The {resource} you're looking for doesn't exist or has been moved.
      </p>
      {onGoBack && (
        <Button onClick={onGoBack} variant="primary">
          Go Back
        </Button>
      )}
    </div>
  )
}

interface EmptyStateProps {
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  icon?: string
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  icon = '📭',
  className
}) => {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">{description}</p>
      {action && (
        <Button onClick={action.onClick} variant="primary">
          {action.label}
        </Button>
      )}
    </div>
  )
}

interface RetryableErrorProps {
  error: Error
  onRetry: () => void
  maxRetries?: number
  currentRetry?: number
  className?: string
}

export const RetryableError: React.FC<RetryableErrorProps> = ({
  error,
  onRetry,
  maxRetries = 3,
  currentRetry = 0,
  className
}) => {
  const canRetry = currentRetry < maxRetries

  return (
    <ErrorMessage
      title="Operation Failed"
      message={`${error.message}${canRetry ? ` (Attempt ${currentRetry + 1}/${maxRetries})` : ' (Max retries reached)'}`}
      action={canRetry ? { label: 'Retry', onClick: onRetry } : undefined}
      variant="error"
      className={className}
    />
  )
}