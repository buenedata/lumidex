// Simple toast notification service
export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info' | 'achievement'
  title: string
  message?: string
  duration?: number
  icon?: string
}

class ToastService {
  private toasts: Toast[] = []
  private listeners: ((toasts: Toast[]) => void)[] = []

  /**
   * Add a new toast notification
   */
  show(toast: Omit<Toast, 'id'>): string {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: Toast = {
      id,
      duration: 5000, // 5 seconds default
      ...toast
    }

    this.toasts.push(newToast)
    this.notifyListeners()

    // Auto-remove after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        this.remove(id)
      }, newToast.duration)
    }

    return id
  }

  /**
   * Remove a toast by ID
   */
  remove(id: string): void {
    this.toasts = this.toasts.filter(toast => toast.id !== id)
    this.notifyListeners()
  }

  /**
   * Clear all toasts
   */
  clear(): void {
    this.toasts = []
    this.notifyListeners()
  }

  /**
   * Get all current toasts
   */
  getToasts(): Toast[] {
    return [...this.toasts]
  }

  /**
   * Subscribe to toast changes
   */
  subscribe(listener: (toasts: Toast[]) => void): () => void {
    this.listeners.push(listener)
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  /**
   * Show a success toast
   */
  success(title: string, message?: string): string {
    return this.show({
      type: 'success',
      title,
      message,
      icon: '✅'
    })
  }

  /**
   * Show an error toast
   */
  error(title: string, message?: string): string {
    return this.show({
      type: 'error',
      title,
      message,
      icon: '❌',
      duration: 7000 // Longer duration for errors
    })
  }

  /**
   * Show an achievement toast
   */
  achievement(title: string, message?: string, icon?: string): string {
    return this.show({
      type: 'achievement',
      title,
      message,
      icon: icon || '🏆',
      duration: 8000 // Longer duration for achievements
    })
  }

  /**
   * Show an info toast
   */
  info(title: string, message?: string): string {
    return this.show({
      type: 'info',
      title,
      message,
      icon: 'ℹ️'
    })
  }

  /**
   * Show a warning toast
   */
  warning(title: string, message?: string): string {
    return this.show({
      type: 'warning',
      title,
      message,
      icon: '⚠️'
    })
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener([...this.toasts])
      } catch (error) {
        console.error('Error in toast listener:', error)
      }
    })
  }
}

export const toastService = new ToastService()
export default toastService