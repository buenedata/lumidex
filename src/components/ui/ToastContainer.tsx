'use client'

import { useState, useEffect } from 'react'
import { toastService, Toast } from '@/lib/toast-service'
import { cn } from '@/lib/utils'

// Hook for using toast notifications
export function useToast() {
  return {
    showToast: (title: string, message?: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
      return toastService.show({
        type,
        title,
        message
      })
    },
    showSuccess: (title: string, message?: string) => {
      return toastService.success(title, message)
    },
    showError: (title: string, message?: string) => {
      return toastService.error(title, message)
    },
    showWarning: (title: string, message?: string) => {
      return toastService.warning(title, message)
    },
    showInfo: (title: string, message?: string) => {
      return toastService.info(title, message)
    },
    showAchievement: (title: string, message?: string, icon?: string) => {
      return toastService.achievement(title, message, icon)
    }
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    // Subscribe to toast changes
    const unsubscribe = toastService.subscribe(setToasts)
    
    // Get initial toasts
    setToasts(toastService.getToasts())
    
    return unsubscribe
  }, [])

  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
}

function ToastItem({ toast }: ToastItemProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setIsLeaving(true)
    setTimeout(() => {
      toastService.remove(toast.id)
    }, 300) // Match animation duration
  }

  const getToastStyles = () => {
    const baseStyles = "relative flex items-start space-x-3 p-4 rounded-lg shadow-lg border transition-all duration-300 transform"
    
    switch (toast.type) {
      case 'success':
        return cn(baseStyles, "bg-green-50 border-green-200 text-green-800")
      case 'error':
        return cn(baseStyles, "bg-red-50 border-red-200 text-red-800")
      case 'warning':
        return cn(baseStyles, "bg-yellow-50 border-yellow-200 text-yellow-800")
      case 'info':
        return cn(baseStyles, "bg-blue-50 border-blue-200 text-blue-800")
      case 'achievement':
        return cn(baseStyles, "bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-300 text-yellow-900 shadow-xl")
      default:
        return cn(baseStyles, "bg-gray-50 border-gray-200 text-gray-800")
    }
  }

  const getAnimationStyles = () => {
    if (isLeaving) {
      return "opacity-0 translate-x-full scale-95"
    }
    if (isVisible) {
      return "opacity-100 translate-x-0 scale-100"
    }
    return "opacity-0 translate-x-full scale-95"
  }

  return (
    <div className={cn(getToastStyles(), getAnimationStyles())}>
      {/* Icon */}
      {toast.icon && (
        <div className="flex-shrink-0">
          <span className={cn(
            "text-lg",
            toast.type === 'achievement' ? "text-2xl" : ""
          )}>
            {toast.icon}
          </span>
        </div>
      )}
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          "font-medium",
          toast.type === 'achievement' ? "text-lg font-bold" : "text-sm"
        )}>
          {toast.title}
        </div>
        {toast.message && (
          <div className={cn(
            "mt-1 text-sm opacity-90",
            toast.type === 'achievement' ? "text-base" : ""
          )}>
            {toast.message}
          </div>
        )}
      </div>
      
      {/* Close button */}
      <button
        onClick={handleClose}
        className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Close notification"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      {/* Achievement special effects */}
      {toast.type === 'achievement' && (
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-yellow-200/20 to-orange-200/20 animate-pulse pointer-events-none" />
      )}
    </div>
  )
}

// Provider component that just renders the ToastContainer
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastContainer />
    </>
  )
}

export default ToastContainer