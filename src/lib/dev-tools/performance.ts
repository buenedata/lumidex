// Performance monitoring utilities for development and production

import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Performance metrics interface
 */
interface PerformanceMetrics {
  renderTime: number
  componentCount: number
  rerenderCount: number
  memoryUsage?: number
  timestamp: number
}

/**
 * Performance monitor class for tracking app performance
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: Map<string, PerformanceMetrics[]> = new Map()
  private observers: Map<string, PerformanceObserver> = new Map()
  private isEnabled: boolean = process.env.NODE_ENV === 'development'

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  /**
   * Start monitoring performance for a component
   */
  startTracking(componentName: string): void {
    if (!this.isEnabled) return

    const startTime = performance.now()
    
    // Track render performance
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (entry.name.includes(componentName)) {
            this.recordMetric(componentName, {
              renderTime: entry.duration,
              componentCount: 1,
              rerenderCount: 0,
              timestamp: Date.now()
            })
          }
        })
      })

      observer.observe({ entryTypes: ['measure'] })
      this.observers.set(componentName, observer)
    }

    // Mark the start
    performance.mark(`${componentName}-start`)
  }

  /**
   * Stop tracking and record metrics
   */
  stopTracking(componentName: string): void {
    if (!this.isEnabled) return

    // Mark the end and measure
    performance.mark(`${componentName}-end`)
    performance.measure(
      `${componentName}-render`,
      `${componentName}-start`,
      `${componentName}-end`
    )

    // Clean up observer
    const observer = this.observers.get(componentName)
    if (observer) {
      observer.disconnect()
      this.observers.delete(componentName)
    }

    // Clean up marks
    performance.clearMarks(`${componentName}-start`)
    performance.clearMarks(`${componentName}-end`)
    performance.clearMeasures(`${componentName}-render`)
  }

  /**
   * Record a performance metric
   */
  recordMetric(componentName: string, metric: PerformanceMetrics): void {
    if (!this.isEnabled) return

    if (!this.metrics.has(componentName)) {
      this.metrics.set(componentName, [])
    }

    const componentMetrics = this.metrics.get(componentName)!
    componentMetrics.push(metric)

    // Keep only last 100 entries to prevent memory leaks
    if (componentMetrics.length > 100) {
      componentMetrics.splice(0, componentMetrics.length - 100)
    }

    // Log slow renders in development
    if (process.env.NODE_ENV === 'development' && metric.renderTime > 16) {
      console.warn(`Slow render detected in ${componentName}: ${metric.renderTime.toFixed(2)}ms`)
    }
  }

  /**
   * Get metrics for a component
   */
  getMetrics(componentName: string): PerformanceMetrics[] {
    return this.metrics.get(componentName) || []
  }

  /**
   * Get average metrics for a component
   */
  getAverageMetrics(componentName: string): Partial<PerformanceMetrics> | null {
    const metrics = this.getMetrics(componentName)
    if (metrics.length === 0) return null

    const totals = metrics.reduce(
      (acc, metric) => ({
        renderTime: acc.renderTime + metric.renderTime,
        componentCount: acc.componentCount + metric.componentCount,
        rerenderCount: acc.rerenderCount + metric.rerenderCount
      }),
      { renderTime: 0, componentCount: 0, rerenderCount: 0 }
    )

    return {
      renderTime: totals.renderTime / metrics.length,
      componentCount: totals.componentCount / metrics.length,
      rerenderCount: totals.rerenderCount / metrics.length
    }
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear()
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    const data = Object.fromEntries(this.metrics)
    return JSON.stringify(data, null, 2)
  }
}

/**
 * Hook for tracking component performance
 */
export const usePerformanceTracker = (componentName: string) => {
  const renderCountRef = useRef(0)
  const startTimeRef = useRef<number>(0)
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)

  const monitor = PerformanceMonitor.getInstance()

  useEffect(() => {
    renderCountRef.current += 1
    startTimeRef.current = performance.now()

    return () => {
      const renderTime = performance.now() - startTimeRef.current
      const metric: PerformanceMetrics = {
        renderTime,
        componentCount: 1,
        rerenderCount: renderCountRef.current - 1,
        timestamp: Date.now()
      }

      monitor.recordMetric(componentName, metric)
      setMetrics(metric)
    }
  })

  const getComponentMetrics = useCallback(() => {
    return monitor.getMetrics(componentName)
  }, [componentName, monitor])

  const getAverageMetrics = useCallback(() => {
    return monitor.getAverageMetrics(componentName)
  }, [componentName, monitor])

  return {
    currentMetrics: metrics,
    allMetrics: getComponentMetrics,
    averageMetrics: getAverageMetrics,
    renderCount: renderCountRef.current
  }
}

/**
 * HOC factory for automatic performance tracking
 * Note: This should be moved to a .tsx file when used with React components
 */
export const createPerformanceTracker = (componentName: string) => {
  return {
    start: () => {
      const monitor = PerformanceMonitor.getInstance()
      monitor.startTracking(componentName)
    },
    stop: () => {
      const monitor = PerformanceMonitor.getInstance()
      monitor.stopTracking(componentName)
    },
    getMetrics: () => {
      const monitor = PerformanceMonitor.getInstance()
      return monitor.getMetrics(componentName)
    }
  }
}

/**
 * Performance budget checker
 */
export class PerformanceBudget {
  private budgets: Map<string, number> = new Map()

  setBudget(componentName: string, maxRenderTime: number): void {
    this.budgets.set(componentName, maxRenderTime)
  }

  checkBudget(componentName: string, actualRenderTime: number): boolean {
    const budget = this.budgets.get(componentName)
    if (!budget) return true

    const isWithinBudget = actualRenderTime <= budget
    
    if (!isWithinBudget && process.env.NODE_ENV === 'development') {
      console.warn(
        `Performance budget exceeded for ${componentName}: ` +
        `${actualRenderTime.toFixed(2)}ms > ${budget}ms`
      )
    }

    return isWithinBudget
  }

  getAllBudgets(): Record<string, number> {
    return Object.fromEntries(this.budgets)
  }
}

/**
 * Memory usage tracker
 */
export class MemoryTracker {
  private static instance: MemoryTracker
  private measurements: Array<{ timestamp: number; usage: number }> = []

  static getInstance(): MemoryTracker {
    if (!MemoryTracker.instance) {
      MemoryTracker.instance = new MemoryTracker()
    }
    return MemoryTracker.instance
  }

  measureMemory(): number | null {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return null
    }

    // Use performance.memory if available (Chrome)
    if ('memory' in performance) {
      const memory = (performance as any).memory
      const usage = memory.usedJSHeapSize / 1024 / 1024 // Convert to MB
      
      this.measurements.push({
        timestamp: Date.now(),
        usage
      })

      // Keep only last 1000 measurements
      if (this.measurements.length > 1000) {
        this.measurements.splice(0, this.measurements.length - 1000)
      }

      return usage
    }

    return null
  }

  getMemoryTrend(): Array<{ timestamp: number; usage: number }> {
    return [...this.measurements]
  }

  detectMemoryLeaks(): boolean {
    if (this.measurements.length < 10) return false

    const recent = this.measurements.slice(-10)
    const trend = recent[recent.length - 1].usage - recent[0].usage

    // If memory increased by more than 10MB over last 10 measurements, flag as potential leak
    return trend > 10
  }
}

/**
 * Hook for memory monitoring
 */
export const useMemoryMonitor = (intervalMs: number = 5000) => {
  const [memoryUsage, setMemoryUsage] = useState<number | null>(null)
  const [isLeaking, setIsLeaking] = useState(false)

  useEffect(() => {
    const tracker = MemoryTracker.getInstance()
    
    const interval = setInterval(() => {
      const usage = tracker.measureMemory()
      setMemoryUsage(usage)
      setIsLeaking(tracker.detectMemoryLeaks())
    }, intervalMs)

    return () => clearInterval(interval)
  }, [intervalMs])

  return {
    memoryUsage,
    isLeaking,
    measurements: MemoryTracker.getInstance().getMemoryTrend()
  }
}