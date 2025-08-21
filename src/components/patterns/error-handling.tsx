// Error handling patterns - comprehensive error management components and utilities

import React, { Component, ReactNode, useState, useEffect } from 'react'
import { Button } from './base-components'

/**
 * Error boundary component for catching React errors
 */
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, errorInfo: React.ErrorInfo | null, retry: () => void) => ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  isolate?: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo)

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }

    // Report error to monitoring service
    this.reportError(error, errorInfo)
  }

  private reportError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Integration point for error reporting services like Sentry
    try {
      // Example: Sentry.captureException(error, { extra: errorInfo })
      console.error('Error reported:', { error, errorInfo })
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError)
    }
  }

  private retry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.state.errorInfo, this.retry)
      }

      return (
        <DefaultErrorFallback
          error={this.state.error!}
          errorInfo={this.state.errorInfo}
          onRetry={this.retry}
          isolate={this.props.isolate}
        />
      )
    }

    return this.props.children
  }
}

/**
 * Default error fallback component
 */
interface DefaultErrorFallbackProps {
  error: Error
  errorInfo: React.ErrorInfo | null
  onRetry: () => void
  isolate?: boolean
}

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({
  error,
  errorInfo,
  onRetry,
  isolate = false
}) => {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className={`
      bg-red-50 border border-red-200 rounded-lg p-6 
      ${isolate ? 'min-h-[200px]' : 'min-h-[400px]'} 
      flex flex-col items-center justify-center text-center
    `}>
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {isolate ? 'Component Error' : 'Something went wrong'}
      </h3>

      <p className="text-gray-600 mb-4 max-w-md">
        {isolate 
          ? 'This component encountered an error and couldn\'t render properly.'
          : 'An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.'
        }
      </p>

      <div className="flex flex-col items-center space-y-3">
        <div className="flex space-x-3">
          <Button 
            onClick={onRetry}
            variant="primary"
            size="sm"
          >
            Try Again
          </Button>
          
          {!isolate && (
            <Button 
              onClick={() => window.location.reload()}
              variant="secondary"
              size="sm"
            >
              Refresh Page
            </Button>
          )}
        </div>

        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            {showDetails ? 'Hide' : 'Show'} Error Details
          </button>
        )}
      </div>

      {showDetails && process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-4 bg-gray-100 rounded text-left text-xs font-mono overflow-auto max-w-full max-h-40">
          <div className="font-bold text-red-600 mb-2">Error:</div>
          <div className="mb-2">{error.message}</div>
          <div className="font-bold text-red-600 mb-2">Stack:</div>
          <div className="whitespace-pre-wrap">{error.stack}</div>
          {errorInfo && (
            <>
              <div className="font-bold text-red-600 mb-2 mt-4">Component Stack:</div>
              <div className="whitespace-pre-wrap">{errorInfo.componentStack}</div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Async error boundary for handling async errors
 */
interface AsyncErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, retry: () => void) => ReactNode
  onError?: (error: Error) => void
}

export const AsyncErrorBoundary: React.FC<AsyncErrorBoundaryProps> = ({
  children,
  fallback,
  onError
}) => {
  const [asyncError, setAsyncError] = useState<Error | null>(null)

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
      setAsyncError(error)
      onError?.(error)
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  }, [onError])

  const retry = () => setAsyncError(null)

  if (asyncError) {
    if (fallback) {
      return <>{fallback(asyncError, retry)}</>
    }

    return (
      <DefaultErrorFallback
        error={asyncError}
        errorInfo={null}
        onRetry={retry}
        isolate={false}
      />
    )
  }

  return <ErrorBoundary onError={onError}>{children}</ErrorBoundary>
}

/**
 * Error toast notification component
 */
interface ErrorToastProps {
  error: Error | string
  onDismiss: () => void
  duration?: number
  showRetry?: boolean
  onRetry?: () => void
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
  error,
  onDismiss,
  duration = 5000,
  showRetry = false,
  onRetry
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onDismiss, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onDismiss])

  const errorMessage = error instanceof Error ? error.message : error

  return (
    <div className="fixed top-4 right-4 z-50 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-md">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium text-red-800">Error</p>
          <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
          
          {showRetry && onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          )}
        </div>
        
        <button
          onClick={onDismiss}
          className="ml-4 flex-shrink-0 text-red-400 hover:text-red-600"
        >
          <span className="sr-only">Dismiss</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/**
 * Inline error display component
 */
interface InlineErrorProps {
  error: Error | string | null
  className?: string
  showIcon?: boolean
}

export const InlineError: React.FC<InlineErrorProps> = ({
  error,
  className = '',
  showIcon = true
}) => {
  if (!error) return null

  const errorMessage = error instanceof Error ? error.message : error

  return (
    <div className={`flex items-center text-sm text-red-600 ${className}`}>
      {showIcon && (
        <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      )}
      {errorMessage}
    </div>
  )
}

/**
 * Error retry wrapper component
 */
interface ErrorRetryWrapperProps {
  children: ReactNode
  maxRetries?: number
  retryDelay?: number
  onError?: (error: Error, attempt: number) => void
  fallback?: (error: Error, retryCount: number, retry: () => void) => ReactNode
}

export const ErrorRetryWrapper: React.FC<ErrorRetryWrapperProps> = ({
  children,
  maxRetries = 3,
  retryDelay = 1000,
  onError,
  fallback
}) => {
  const [retryCount, setRetryCount] = useState(0)
  const [lastError, setLastError] = useState<Error | null>(null)

  const handleError = (error: Error) => {
    setLastError(error)
    onError?.(error, retryCount + 1)

    if (retryCount < maxRetries) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1)
        setLastError(null)
      }, retryDelay)
    }
  }

  const manualRetry = () => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1)
      setLastError(null)
    }
  }

  if (lastError && retryCount >= maxRetries) {
    if (fallback) {
      return <>{fallback(lastError, retryCount, manualRetry)}</>
    }

    return (
      <div className="text-center p-4 text-red-600">
        <p>Failed after {maxRetries} attempts</p>
        <p className="text-sm mt-1">{lastError.message}</p>
        <Button onClick={manualRetry} variant="secondary" size="sm" className="mt-2">
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <ErrorBoundary
      onError={handleError}
      key={retryCount} // Force remount on retry
    >
      {children}
    </ErrorBoundary>
  )
}

/**
 * Network error wrapper for handling API failures
 */
interface NetworkErrorWrapperProps {
  children: ReactNode
  fallback?: (isOffline: boolean, retry: () => void) => ReactNode
}

export const NetworkErrorWrapper: React.FC<NetworkErrorWrapperProps> = ({
  children,
  fallback
}) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const retry = () => setRetryKey(prev => prev + 1)

  if (isOffline) {
    if (fallback) {
      return <>{fallback(true, retry)}</>
    }

    return (
      <div className="text-center p-8 text-gray-600">
        <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Internet Connection</h3>
        <p className="text-gray-600 mb-4">Please check your connection and try again.</p>
        <Button onClick={retry} variant="primary" size="sm">
          Try Again
        </Button>
      </div>
    )
  }

  return <div key={retryKey}>{children}</div>
}