// Simplified app providers - replaces the complex provider nesting

'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAppInitialization } from '@/lib/hooks/use-app-initialization'
import { useToasts, useConfirmation } from '@/lib/state/app-store'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useState } from 'react'

/**
 * Query client configuration
 */
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (replaces cacheTime)
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false
        }
        return failureCount < 3
      },
      refetchOnWindowFocus: false,
      refetchOnMount: 'always'
    },
    mutations: {
      retry: 1
    }
  }
})

/**
 * App initialization component
 */
function AppInitializer({ children }: { children: React.ReactNode }) {
  const { isInitialized, loading, error } = useAppInitialization()

  // Show loading screen during initialization
  if (!isInitialized || loading) {
    return (
      <div className="min-h-screen bg-pkmn-dark flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-white mt-4">Initializing Lumidex...</p>
        </div>
      </div>
    )
  }

  // Show error screen if initialization failed
  if (error) {
    return (
      <div className="min-h-screen bg-pkmn-dark flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-2xl mb-4">⚠️</div>
          <h1 className="text-white text-xl mb-2">Initialization Failed</h1>
          <p className="text-gray-300 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="btn-gaming"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

/**
 * Simple toast component
 */
function ToastNotifications() {
  const { toasts, removeToast } = useToasts()
  
  if (toasts.length === 0) return null
  
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            p-4 rounded-lg shadow-lg max-w-sm
            ${toast.type === 'error' ? 'bg-red-500 text-white' : ''}
            ${toast.type === 'success' ? 'bg-green-500 text-white' : ''}
            ${toast.type === 'warning' ? 'bg-yellow-500 text-black' : ''}
            ${toast.type === 'info' ? 'bg-blue-500 text-white' : ''}
            ${toast.type === 'achievement' ? 'bg-purple-500 text-white' : ''}
          `}
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="font-semibold">{toast.title}</div>
              {toast.message && (
                <div className="text-sm opacity-90 mt-1">{toast.message}</div>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Simple confirmation modal
 */
function ConfirmationDialog() {
  const {
    isOpen,
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    closeConfirmation
  } = useConfirmation()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={closeConfirmation} />
      <div className="relative bg-white rounded-lg p-6 max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{message}</p>
        <div className="flex space-x-2 justify-end">
          <button
            onClick={() => {
              onCancel?.()
              closeConfirmation()
            }}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm?.()
              closeConfirmation()
            }}
            className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Global UI components that need to be rendered at the root level
 */
function GlobalUI() {
  return (
    <>
      {/* Toast notifications */}
      <ToastNotifications />
      
      {/* Confirmation modal */}
      <ConfirmationDialog />
      
      {/* Scroll to top button */}
      <div id="scroll-to-top-root" />
    </>
  )
}

/**
 * Main app providers component
 * Replaces the complex nested provider structure with optimized state management
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  // Create query client instance (stable across re-renders)
  const [queryClient] = useState(() => createQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <AppInitializer>
        {children}
        <GlobalUI />
      </AppInitializer>
      
      {/* Development tools would go here */}
    </QueryClientProvider>
  )
}

/**
 * Development component for debugging store state
 */
function StoreDevTools() {
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  // Could add a floating debug panel here
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <details className="bg-black/80 text-white p-2 rounded text-xs max-w-xs">
        <summary className="cursor-pointer">🔧 Debug</summary>
        <div className="mt-2 space-y-1">
          <div>Store: ✅ Zustand</div>
          <div>Services: ✅ Initialized</div>
          <div>Auth: ✅ Active</div>
        </div>
      </details>
    </div>
  )
}

// Add dev tools in development
if (process.env.NODE_ENV === 'development') {
  const OriginalAppProviders = AppProviders
  
  // Override AppProviders to include dev tools
  Object.defineProperty(exports, 'AppProviders', {
    value: function DevAppProviders({ children }: { children: React.ReactNode }) {
      return (
        <OriginalAppProviders>
          {children}
          <StoreDevTools />
        </OriginalAppProviders>
      )
    }
  })
}