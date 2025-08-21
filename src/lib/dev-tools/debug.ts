// Debug utilities for development and troubleshooting

import { useState, useEffect, useRef } from 'react'

/**
 * Debug logger with levels and filtering
 */
export class DebugLogger {
  private static instance: DebugLogger
  private logs: Array<{
    level: 'log' | 'warn' | 'error' | 'debug'
    message: string
    timestamp: number
    data?: any
    component?: string
  }> = []
  private isEnabled = process.env.NODE_ENV === 'development'
  private logLevel: 'debug' | 'log' | 'warn' | 'error' = 'debug'

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger()
    }
    return DebugLogger.instance
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  setLogLevel(level: 'debug' | 'log' | 'warn' | 'error'): void {
    this.logLevel = level
  }

  private shouldLog(level: 'debug' | 'log' | 'warn' | 'error'): boolean {
    if (!this.isEnabled) return false
    
    const levels = ['debug', 'log', 'warn', 'error']
    return levels.indexOf(level) >= levels.indexOf(this.logLevel)
  }

  debug(message: string, data?: any, component?: string): void {
    if (!this.shouldLog('debug')) return
    
    console.debug(`[Lumidex Debug] ${message}`, data || '')
    this.addLog('debug', message, data, component)
  }

  log(message: string, data?: any, component?: string): void {
    if (!this.shouldLog('log')) return
    
    console.log(`[Lumidex] ${message}`, data || '')
    this.addLog('log', message, data, component)
  }

  warn(message: string, data?: any, component?: string): void {
    if (!this.shouldLog('warn')) return
    
    console.warn(`[Lumidex Warning] ${message}`, data || '')
    this.addLog('warn', message, data, component)
  }

  error(message: string, error?: Error | any, component?: string): void {
    if (!this.shouldLog('error')) return
    
    console.error(`[Lumidex Error] ${message}`, error || '')
    this.addLog('error', message, error, component)
  }

  private addLog(
    level: 'log' | 'warn' | 'error' | 'debug',
    message: string,
    data?: any,
    component?: string
  ): void {
    this.logs.push({
      level,
      message,
      timestamp: Date.now(),
      data,
      component
    })

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs.splice(0, this.logs.length - 1000)
    }
  }

  getLogs(): typeof this.logs {
    return [...this.logs]
  }

  clearLogs(): void {
    this.logs = []
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }
}

/**
 * State inspector for debugging component state
 */
export class StateInspector {
  private static instance: StateInspector
  private stateSnapshots: Map<string, any[]> = new Map()

  static getInstance(): StateInspector {
    if (!StateInspector.instance) {
      StateInspector.instance = new StateInspector()
    }
    return StateInspector.instance
  }

  captureState(componentName: string, state: any): void {
    if (process.env.NODE_ENV !== 'development') return

    if (!this.stateSnapshots.has(componentName)) {
      this.stateSnapshots.set(componentName, [])
    }

    const snapshots = this.stateSnapshots.get(componentName)!
    snapshots.push({
      timestamp: Date.now(),
      state: JSON.parse(JSON.stringify(state)) // Deep clone
    })

    // Keep only last 50 snapshots per component
    if (snapshots.length > 50) {
      snapshots.splice(0, snapshots.length - 50)
    }
  }

  getStateHistory(componentName: string): any[] {
    return this.stateSnapshots.get(componentName) || []
  }

  compareStates(componentName: string, index1: number, index2: number): any {
    const history = this.getStateHistory(componentName)
    if (index1 >= history.length || index2 >= history.length) {
      return null
    }

    const state1 = history[index1].state
    const state2 = history[index2].state

    return this.deepDiff(state1, state2)
  }

  private deepDiff(obj1: any, obj2: any): any {
    const diff: any = {}

    for (const key in obj1) {
      if (obj1[key] !== obj2[key]) {
        if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
          const nestedDiff = this.deepDiff(obj1[key], obj2[key])
          if (Object.keys(nestedDiff).length > 0) {
            diff[key] = nestedDiff
          }
        } else {
          diff[key] = { from: obj1[key], to: obj2[key] }
        }
      }
    }

    for (const key in obj2) {
      if (!(key in obj1)) {
        diff[key] = { from: undefined, to: obj2[key] }
      }
    }

    return diff
  }

  clearHistory(componentName?: string): void {
    if (componentName) {
      this.stateSnapshots.delete(componentName)
    } else {
      this.stateSnapshots.clear()
    }
  }
}

/**
 * Query inspector for debugging React Query operations
 */
export class QueryInspector {
  private static instance: QueryInspector
  private queryLogs: Array<{
    queryKey: string[]
    operation: 'fetch' | 'success' | 'error' | 'invalidate'
    timestamp: number
    data?: any
    error?: Error
    duration?: number
  }> = []

  static getInstance(): QueryInspector {
    if (!QueryInspector.instance) {
      QueryInspector.instance = new QueryInspector()
    }
    return QueryInspector.instance
  }

  logQuery(
    queryKey: string[],
    operation: 'fetch' | 'success' | 'error' | 'invalidate',
    data?: any,
    error?: Error,
    duration?: number
  ): void {
    if (process.env.NODE_ENV !== 'development') return

    this.queryLogs.push({
      queryKey,
      operation,
      timestamp: Date.now(),
      data,
      error,
      duration
    })

    // Keep only last 500 query logs
    if (this.queryLogs.length > 500) {
      this.queryLogs.splice(0, this.queryLogs.length - 500)
    }

    // Log slow queries
    if (operation === 'success' && duration && duration > 2000) {
      DebugLogger.getInstance().warn(
        `Slow query detected: ${queryKey.join('.')} took ${duration}ms`
      )
    }
  }

  getQueryLogs(): typeof this.queryLogs {
    return [...this.queryLogs]
  }

  getQueryLogsByKey(queryKey: string[]): typeof this.queryLogs {
    const keyString = queryKey.join('.')
    return this.queryLogs.filter(log => log.queryKey.join('.') === keyString)
  }

  getSlowQueries(threshold: number = 1000): typeof this.queryLogs {
    return this.queryLogs.filter(
      log => log.operation === 'success' && log.duration && log.duration > threshold
    )
  }

  getFailedQueries(): typeof this.queryLogs {
    return this.queryLogs.filter(log => log.operation === 'error')
  }

  clearLogs(): void {
    this.queryLogs = []
  }

  exportLogs(): string {
    return JSON.stringify(this.queryLogs, null, 2)
  }
}

/**
 * Hook for debugging component renders
 */
export const useRenderDebug = (componentName: string, props?: any) => {
  const renderCount = useRef(0)
  const prevProps = useRef(props)

  renderCount.current += 1

  useEffect(() => {
    const logger = DebugLogger.getInstance()
    logger.debug(`${componentName} rendered (${renderCount.current})`, props, componentName)

    // Log prop changes
    if (prevProps.current && props) {
      const changedProps = Object.keys(props).filter(
        key => prevProps.current[key] !== props[key]
      )

      if (changedProps.length > 0) {
        logger.debug(
          `${componentName} props changed:`,
          changedProps.reduce((acc, key) => ({
            ...acc,
            [key]: { from: prevProps.current[key], to: props[key] }
          }), {}),
          componentName
        )
      }
    }

    prevProps.current = props
  })

  return renderCount.current
}

/**
 * Hook for debugging state changes
 */
export const useStateDebug = <T>(
  state: T,
  componentName: string,
  stateName?: string
) => {
  const prevState = useRef(state)
  const inspector = StateInspector.getInstance()

  useEffect(() => {
    const name = stateName ? `${componentName}.${stateName}` : componentName
    inspector.captureState(name, state)

    if (prevState.current !== state) {
      DebugLogger.getInstance().debug(
        `State changed in ${name}:`,
        { from: prevState.current, to: state },
        componentName
      )
    }

    prevState.current = state
  }, [state, componentName, stateName, inspector])

  return {
    getHistory: () => inspector.getStateHistory(componentName),
    compareStates: (index1: number, index2: number) => 
      inspector.compareStates(componentName, index1, index2)
  }
}

/**
 * Performance tracking hook
 */
export const usePerformanceDebug = (operationName: string) => {
  const startTime = useRef<number>(0)

  const start = () => {
    startTime.current = performance.now()
  }

  const end = () => {
    const duration = performance.now() - startTime.current
    DebugLogger.getInstance().debug(
      `Performance: ${operationName} took ${duration.toFixed(2)}ms`
    )
    return duration
  }

  return { start, end }
}

/**
 * Debug utilities for specific scenarios
 */
export const DebugUtils = {
  /**
   * Trace function calls
   */
  trace: (fn: Function, name?: string) => {
    if (process.env.NODE_ENV !== 'development') return fn

    return (...args: any[]) => {
      const logger = DebugLogger.getInstance()
      const fnName = name || fn.name || 'anonymous'
      
      logger.debug(`Calling ${fnName}`, args)
      
      const start = performance.now()
      const result = fn(...args)
      const duration = performance.now() - start

      if (result instanceof Promise) {
        return result
          .then(resolved => {
            logger.debug(`${fnName} resolved in ${duration.toFixed(2)}ms`, resolved)
            return resolved
          })
          .catch(error => {
            logger.error(`${fnName} rejected in ${duration.toFixed(2)}ms`, error)
            throw error
          })
      } else {
        logger.debug(`${fnName} returned in ${duration.toFixed(2)}ms`, result)
        return result
      }
    }
  },

  /**
   * Monitor object property changes
   */
  watchObject: (obj: any, name: string) => {
    if (process.env.NODE_ENV !== 'development') return obj

    return new Proxy(obj, {
      set(target, property, value) {
        const oldValue = target[property]
        target[property] = value
        
        DebugLogger.getInstance().debug(
          `Property changed in ${name}.${String(property)}:`,
          { from: oldValue, to: value }
        )
        
        return true
      }
    })
  },

  /**
   * Create a debug checkpoint
   */
  checkpoint: (label: string, data?: any) => {
    if (process.env.NODE_ENV !== 'development') return

    DebugLogger.getInstance().debug(`Checkpoint: ${label}`, data)
  }
}