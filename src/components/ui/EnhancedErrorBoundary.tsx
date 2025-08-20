'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'
import { loadingStateManager } from '@/lib/loading-state-manager'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  resetKeys?: Array<string | number>
  resetOnPropsChange?: boolean
  level?: 'page' | 'component' | 'data'
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  retryCount: number
  lastResetKeys: Array<string | number>
}

export class EnhancedErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null
  private readonly maxRetries = 3
  private readonly retryDelay = 2000

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      lastResetKeys: props.resetKeys || []
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('EnhancedErrorBoundary caught an error:', error, errorInfo)
    
    this.setState({
      error,
      errorInfo
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Reset any stuck loading states that might be related
    loadingStateManager.cleanup()
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props
    const { hasError, lastResetKeys } = this.state

    // Reset error boundary if resetKeys changed
    if (resetKeys && hasError) {
      const hasResetKeyChanged = resetKeys.some((key, idx) => key !== lastResetKeys[idx])
      if (hasResetKeyChanged) {
        this.resetErrorBoundary()
      }
    }

    // Reset if any prop changed and resetOnPropsChange is true
    if (resetOnPropsChange && hasError && prevProps !== this.props) {
      this.resetErrorBoundary()
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      lastResetKeys: this.props.resetKeys || []
    })
  }

  handleRetry = () => {
    const { retryCount } = this.state
    
    if (retryCount < this.maxRetries) {
      this.setState({ retryCount: retryCount + 1 })
      
      // Auto-retry after delay
      this.resetTimeoutId = window.setTimeout(() => {
        this.resetErrorBoundary()
      }, this.retryDelay)
    }
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    const { hasError, error, errorInfo, retryCount } = this.state
    const { children, fallback, level = 'component' } = this.props

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback
      }

      // Different error UIs based on error level
      if (level === 'page') {
        return (
          <div className="min-h-screen bg-pkmn-dark flex items-center justify-center px-4">
            <div className="text-center max-w-md">
              <div className="mb-8">
                <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <div className="text-4xl font-bold text-red-400 mb-4 animate-pulse">
                  Oops!
                </div>
              </div>
              
              <h1 className="text-3xl font-bold text-white mb-4">
                Something went wrong
              </h1>
              <p className="text-gray-400 mb-8 leading-relaxed">
                We encountered an unexpected error. This has been logged and we'll fix it soon.
              </p>
              
              {process.env.NODE_ENV === 'development' && error && (
                <div className="mb-8 p-4 bg-red-900/20 border border-red-600/30 rounded-lg text-left">
                  <p className="text-red-400 text-sm font-mono break-all">
                    {error.message}
                  </p>
                </div>
              )}
              
              <div className="space-y-4">
                {retryCount < this.maxRetries && (
                  <button
                    onClick={this.handleRetry}
                    className="btn-gaming inline-flex items-center"
                    disabled={this.resetTimeoutId !== null}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again ({this.maxRetries - retryCount} attempts left)
                  </button>
                )}
                <div className="flex gap-4 justify-center">
                  <button onClick={this.handleGoHome} className="btn-secondary">
                    <Home className="w-4 h-4 mr-2" />
                    Go Home
                  </button>
                  <button onClick={this.handleReload} className="btn-outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reload Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      if (level === 'data') {
        return (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-red-400 mb-2">Data Loading Error</h3>
            <p className="text-red-300 text-sm mb-4">
              Failed to load data. Please try refreshing.
            </p>
            {retryCount < this.maxRetries && (
              <button
                onClick={this.handleRetry}
                className="btn-sm bg-red-600 hover:bg-red-700 text-white"
                disabled={this.resetTimeoutId !== null}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Retry
              </button>
            )}
          </div>
        )
      }

      // Component level error (default)
      return (
        <div className="bg-pkmn-card rounded-lg p-6 border border-red-500/30 text-center">
          <Bug className="w-12 h-12 text-red-400 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-red-400 mb-2">Component Error</h3>
          <p className="text-red-300 text-sm mb-4">
            This component encountered an error and couldn't render properly.
          </p>
          
          {process.env.NODE_ENV === 'development' && error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-600/30 rounded text-left">
              <p className="text-red-400 text-xs font-mono break-all">
                {error.message}
              </p>
            </div>
          )}
          
          {retryCount < this.maxRetries ? (
            <button
              onClick={this.handleRetry}
              className="btn-sm bg-red-600 hover:bg-red-700 text-white"
              disabled={this.resetTimeoutId !== null}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Try Again
            </button>
          ) : (
            <button
              onClick={this.handleReload}
              className="btn-sm bg-gray-600 hover:bg-gray-700 text-white"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Reload Page
            </button>
          )}
        </div>
      )
    }

    return children
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <EnhancedErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </EnhancedErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  return WrappedComponent
}

// Hook for triggering error boundary from function components
export function useErrorBoundary() {
  const [, setState] = React.useState()
  
  return React.useCallback((error: Error) => {
    setState(() => {
      throw error
    })
  }, [])
}

export default EnhancedErrorBoundary