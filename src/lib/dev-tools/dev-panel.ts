// Development panel utilities for debugging and monitoring

import { useState, useEffect, useCallback } from 'react'

/**
 * Development mode detection and utilities
 */
export const useDevMode = () => {
  const [isDevMode, setIsDevMode] = useState(false)
  const [debugLevel, setDebugLevel] = useState<'none' | 'basic' | 'verbose'>('none')

  useEffect(() => {
    const isDev = process.env.NODE_ENV === 'development'
    setIsDevMode(isDev)
    
    // Check for debug flags in localStorage
    if (typeof window !== 'undefined') {
      const storedLevel = localStorage.getItem('lumidex-debug-level')
      if (storedLevel && ['none', 'basic', 'verbose'].includes(storedLevel)) {
        setDebugLevel(storedLevel as any)
      }
    }
  }, [])

  const setDebugLevelPersistent = useCallback((level: 'none' | 'basic' | 'verbose') => {
    setDebugLevel(level)
    if (typeof window !== 'undefined') {
      localStorage.setItem('lumidex-debug-level', level)
    }
  }, [])

  return {
    isDevMode,
    debugLevel,
    setDebugLevel: setDebugLevelPersistent,
    isDebugging: debugLevel !== 'none'
  }
}

/**
 * Debug information interface
 */
export interface DebugInfo {
  component: string
  props?: any
  state?: any
  renderCount?: number
  lastRender?: number
  errors?: Error[]
  warnings?: string[]
  performance?: {
    renderTime: number
    memoryUsage?: number
  }
}

/**
 * Development panel state management
 */
class DevPanelStore {
  private static instance: DevPanelStore
  private isVisible = false
  private activeTab = 'overview'
  private debugInfo: Map<string, DebugInfo> = new Map()
  private logs: Array<{ level: string; message: string; timestamp: number; data?: any }> = []
  private subscribers: Set<() => void> = new Set()

  static getInstance(): DevPanelStore {
    if (!DevPanelStore.instance) {
      DevPanelStore.instance = new DevPanelStore()
    }
    return DevPanelStore.instance
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  private notify(): void {
    this.subscribers.forEach(callback => callback())
  }

  setVisible(visible: boolean): void {
    this.isVisible = visible
    this.notify()
  }

  getVisible(): boolean {
    return this.isVisible
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab
    this.notify()
  }

  getActiveTab(): string {
    return this.activeTab
  }

  addDebugInfo(component: string, info: Partial<DebugInfo>): void {
    const existing = this.debugInfo.get(component) || { component }
    this.debugInfo.set(component, { ...existing, ...info })
    this.notify()
  }

  getDebugInfo(): Map<string, DebugInfo> {
    return new Map(this.debugInfo)
  }

  addLog(level: string, message: string, data?: any): void {
    this.logs.push({
      level,
      message,
      timestamp: Date.now(),
      data
    })

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs.splice(0, this.logs.length - 1000)
    }

    this.notify()
  }

  getLogs(): Array<{ level: string; message: string; timestamp: number; data?: any }> {
    return [...this.logs]
  }

  clearLogs(): void {
    this.logs = []
    this.notify()
  }

  clearDebugInfo(): void {
    this.debugInfo.clear()
    this.notify()
  }
}

/**
 * Hook for development panel functionality
 */
export const useDevPanel = () => {
  const [state, setState] = useState({
    isVisible: false,
    activeTab: 'overview',
    debugInfo: new Map<string, DebugInfo>(),
    logs: [] as Array<{ level: string; message: string; timestamp: number; data?: any }>
  })

  useEffect(() => {
    const store = DevPanelStore.getInstance()
    
    const updateState = () => {
      setState({
        isVisible: store.getVisible(),
        activeTab: store.getActiveTab(),
        debugInfo: store.getDebugInfo(),
        logs: store.getLogs()
      })
    }

    updateState()
    const unsubscribe = store.subscribe(updateState)

    return unsubscribe
  }, [])

  const togglePanel = useCallback(() => {
    const store = DevPanelStore.getInstance()
    store.setVisible(!store.getVisible())
  }, [])

  const setActiveTab = useCallback((tab: string) => {
    const store = DevPanelStore.getInstance()
    store.setActiveTab(tab)
  }, [])

  const addDebugInfo = useCallback((component: string, info: Partial<DebugInfo>) => {
    const store = DevPanelStore.getInstance()
    store.addDebugInfo(component, info)
  }, [])

  const log = useCallback((level: string, message: string, data?: any) => {
    const store = DevPanelStore.getInstance()
    store.addLog(level, message, data)
  }, [])

  const clearLogs = useCallback(() => {
    const store = DevPanelStore.getInstance()
    store.clearLogs()
  }, [])

  const clearDebugInfo = useCallback(() => {
    const store = DevPanelStore.getInstance()
    store.clearDebugInfo()
  }, [])

  return {
    ...state,
    togglePanel,
    setActiveTab,
    addDebugInfo,
    log,
    clearLogs,
    clearDebugInfo
  }
}

/**
 * Debug logger for development
 */
export class DebugLogger {
  private static instance: DebugLogger
  private isEnabled = process.env.NODE_ENV === 'development'

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger()
    }
    return DebugLogger.instance
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  log(message: string, data?: any): void {
    if (!this.isEnabled) return

    console.log(`[Lumidex Debug] ${message}`, data || '')
    
    const store = DevPanelStore.getInstance()
    store.addLog('log', message, data)
  }

  warn(message: string, data?: any): void {
    if (!this.isEnabled) return

    console.warn(`[Lumidex Warning] ${message}`, data || '')
    
    const store = DevPanelStore.getInstance()
    store.addLog('warn', message, data)
  }

  error(message: string, error?: Error | any): void {
    if (!this.isEnabled) return

    console.error(`[Lumidex Error] ${message}`, error || '')
    
    const store = DevPanelStore.getInstance()
    store.addLog('error', message, error)
  }

  group(label: string): void {
    if (!this.isEnabled) return
    console.group(`[Lumidex] ${label}`)
  }

  groupEnd(): void {
    if (!this.isEnabled) return
    console.groupEnd()
  }

  time(label: string): void {
    if (!this.isEnabled) return
    console.time(`[Lumidex] ${label}`)
  }

  timeEnd(label: string): void {
    if (!this.isEnabled) return
    console.timeEnd(`[Lumidex] ${label}`)
  }
}

/**
 * Development tools provider context
 */
interface DevToolsContextType {
  isDevMode: boolean
  debugLevel: 'none' | 'basic' | 'verbose'
  logger: DebugLogger
  panel: ReturnType<typeof useDevPanel>
}

let devToolsContext: DevToolsContextType | null = null

export const DevToolsProvider = {
  init: () => {
    if (devToolsContext) return devToolsContext

    devToolsContext = {
      isDevMode: process.env.NODE_ENV === 'development',
      debugLevel: 'basic',
      logger: DebugLogger.getInstance(),
      panel: null as any // Will be set when useDevPanel is called
    }

    // Enable keyboard shortcuts in development
    if (typeof window !== 'undefined' && devToolsContext.isDevMode) {
      window.addEventListener('keydown', (e) => {
        // Ctrl+Shift+D to toggle dev panel
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
          e.preventDefault()
          const store = DevPanelStore.getInstance()
          store.setVisible(!store.getVisible())
        }
      })
    }

    return devToolsContext
  },
  
  getContext: () => devToolsContext
}

/**
 * Performance monitoring utilities
 */
export const DevPerformance = {
  markStart: (label: string) => {
    if (process.env.NODE_ENV === 'development') {
      performance.mark(`lumidex-${label}-start`)
    }
  },

  markEnd: (label: string) => {
    if (process.env.NODE_ENV === 'development') {
      performance.mark(`lumidex-${label}-end`)
      performance.measure(
        `lumidex-${label}`,
        `lumidex-${label}-start`,
        `lumidex-${label}-end`
      )

      const measures = performance.getEntriesByName(`lumidex-${label}`)
      if (measures.length > 0) {
        const duration = measures[0].duration
        DebugLogger.getInstance().log(`Performance: ${label} took ${duration.toFixed(2)}ms`)

        if (duration > 100) {
          DebugLogger.getInstance().warn(`Slow operation detected: ${label} (${duration.toFixed(2)}ms)`)
        }
      }

      // Cleanup
      performance.clearMarks(`lumidex-${label}-start`)
      performance.clearMarks(`lumidex-${label}-end`)
      performance.clearMeasures(`lumidex-${label}`)
    }
  }
}

/**
 * Component debugging utilities
 */
export const DevComponent = {
  logRender: (componentName: string, props?: any) => {
    if (process.env.NODE_ENV === 'development') {
      DebugLogger.getInstance().log(`Component render: ${componentName}`, props)
    }
  },

  logRerender: (componentName: string, reason?: string) => {
    if (process.env.NODE_ENV === 'development') {
      DebugLogger.getInstance().warn(`Component re-render: ${componentName}${reason ? ` (${reason})` : ''}`)
    }
  },

  trackProps: (componentName: string, prevProps: any, nextProps: any) => {
    if (process.env.NODE_ENV === 'development') {
      const changedProps = Object.keys(nextProps).filter(
        key => prevProps[key] !== nextProps[key]
      )

      if (changedProps.length > 0) {
        DebugLogger.getInstance().log(
          `Props changed in ${componentName}:`,
          changedProps.reduce((acc, key) => ({
            ...acc,
            [key]: { from: prevProps[key], to: nextProps[key] }
          }), {})
        )
      }
    }
  }
}