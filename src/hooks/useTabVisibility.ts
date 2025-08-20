'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to detect when the browser tab becomes visible or hidden
 * Useful for preventing unnecessary re-renders or API calls when tab is not visible
 */
export function useTabVisibility() {
  const [isVisible, setIsVisible] = useState(true)
  const [hasBeenVisible, setHasBeenVisible] = useState(true)

  useEffect(() => {
    // Check if document is available (client-side)
    if (typeof document === 'undefined') return

    // Set initial state
    setIsVisible(!document.hidden)

    const handleVisibilityChange = () => {
      const visible = !document.hidden
      setIsVisible(visible)
      
      // Track if the tab has ever been visible
      if (visible) {
        setHasBeenVisible(true)
      }
    }

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return {
    isVisible,
    hasBeenVisible,
    isHidden: !isVisible
  }
}

/**
 * Hook that prevents effects from running when tab is not visible
 * Useful for preventing unnecessary API calls or state updates
 */
export function useVisibilityEffect(
  effect: () => void | (() => void),
  deps: React.DependencyList,
  options?: {
    runOnlyWhenVisible?: boolean
    runOnFirstVisible?: boolean
  }
) {
  const { isVisible, hasBeenVisible } = useTabVisibility()
  const { runOnlyWhenVisible = true, runOnFirstVisible = false } = options || {}

  useEffect(() => {
    // If we want to run only when visible and tab is not visible, skip
    if (runOnlyWhenVisible && !isVisible) {
      return
    }

    // If we want to run only on first visible and hasn't been visible yet, skip
    if (runOnFirstVisible && !hasBeenVisible) {
      return
    }

    return effect()
  }, [isVisible, hasBeenVisible, runOnlyWhenVisible, runOnFirstVisible, ...deps])
}