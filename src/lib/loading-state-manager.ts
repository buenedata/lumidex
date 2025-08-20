/**
 * Centralized loading state manager to prevent stuck skeleton loaders
 * Includes timeout handling, retry logic, and fallback mechanisms
 */

interface LoadingState {
  isLoading: boolean
  hasError: boolean
  hasData: boolean
  lastAttempt: number
  retryCount: number
  errorMessage?: string
}

interface LoadingConfig {
  timeout: number
  maxRetries: number
  retryDelay: number
  fallbackDelay: number
}

class LoadingStateManager {
  private states = new Map<string, LoadingState>()
  private timeouts = new Map<string, NodeJS.Timeout>()
  private defaultConfig: LoadingConfig = {
    timeout: 15000, // 15 seconds
    maxRetries: 3,
    retryDelay: 1000, // 1 second
    fallbackDelay: 30000 // 30 seconds fallback
  }

  /**
   * Execute a data fetching operation with comprehensive error handling
   */
  async executeWithTimeout<T>(
    key: string,
    operation: () => Promise<T>,
    config: Partial<LoadingConfig> = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    const finalConfig = { ...this.defaultConfig, ...config }
    const state = this.getState(key)

    // Prevent multiple simultaneous requests for the same key
    if (state.isLoading && Date.now() - state.lastAttempt < 1000) {
      return { success: false, error: 'Request already in progress' }
    }

    this.updateState(key, {
      isLoading: true,
      hasError: false,
      lastAttempt: Date.now(),
      errorMessage: undefined
    })

    try {
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Operation timed out after ${finalConfig.timeout}ms`))
        }, finalConfig.timeout)
        this.timeouts.set(key, timeoutId)
      })

      // Race the operation against the timeout
      const result = await Promise.race([operation(), timeoutPromise])

      // Clear timeout
      this.clearTimeout(key)

      // Success
      this.updateState(key, {
        isLoading: false,
        hasData: true,
        hasError: false,
        retryCount: 0
      })

      return { success: true, data: result }
    } catch (error) {
      this.clearTimeout(key)
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const currentState = this.getState(key)

      // Check if we should retry
      if (currentState.retryCount < finalConfig.maxRetries) {
        console.warn(`Retrying operation "${key}" (attempt ${currentState.retryCount + 1}/${finalConfig.maxRetries}):`, errorMessage)
        
        this.updateState(key, {
          isLoading: false,
          hasError: true,
          retryCount: currentState.retryCount + 1,
          errorMessage
        })

        // Retry after delay
        await new Promise(resolve => setTimeout(resolve, finalConfig.retryDelay))
        return this.executeWithTimeout(key, operation, config)
      }

      // Max retries reached
      this.updateState(key, {
        isLoading: false,
        hasError: true,
        errorMessage
      })

      console.error(`Operation "${key}" failed after ${finalConfig.maxRetries} retries:`, errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Get current loading state for a key
   */
  getState(key: string): LoadingState {
    if (!this.states.has(key)) {
      this.states.set(key, {
        isLoading: false,
        hasError: false,
        hasData: false,
        lastAttempt: 0,
        retryCount: 0
      })
    }
    return this.states.get(key)!
  }

  /**
   * Update loading state
   */
  private updateState(key: string, updates: Partial<LoadingState>): void {
    const current = this.getState(key)
    this.states.set(key, { ...current, ...updates })
  }

  /**
   * Clear timeout for a key
   */
  private clearTimeout(key: string): void {
    const timeoutId = this.timeouts.get(key)
    if (timeoutId) {
      clearTimeout(timeoutId)
      this.timeouts.delete(key)
    }
  }

  /**
   * Force reset a loading state (emergency fallback)
   */
  forceReset(key: string): void {
    this.clearTimeout(key)
    this.states.delete(key)
    console.warn(`Force reset loading state for "${key}"`)
  }

  /**
   * Check for stuck loading states and reset them
   */
  cleanup(): void {
    const now = Date.now()
    const stuckThreshold = 60000 // 1 minute

    Array.from(this.states.entries()).forEach(([key, state]) => {
      if (state.isLoading && now - state.lastAttempt > stuckThreshold) {
        console.warn(`Detected stuck loading state for "${key}", force resetting`)
        this.forceReset(key)
      }
    })
  }

  /**
   * Get loading statistics for debugging
   */
  getStats(): { 
    totalStates: number
    loadingStates: number
    errorStates: number
    successStates: number
  } {
    const states = Array.from(this.states.values())
    return {
      totalStates: states.length,
      loadingStates: states.filter(s => s.isLoading).length,
      errorStates: states.filter(s => s.hasError).length,
      successStates: states.filter(s => s.hasData && !s.hasError).length
    }
  }
}

// Create singleton instance
export const loadingStateManager = new LoadingStateManager()

// Set up periodic cleanup
if (typeof window !== 'undefined') {
  setInterval(() => {
    loadingStateManager.cleanup()
  }, 30000) // Clean up every 30 seconds
}

export default loadingStateManager