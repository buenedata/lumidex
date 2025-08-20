'use client'

import React, { useState, useEffect } from 'react'
import { loadingStateManager } from '@/lib/loading-state-manager'
import { cacheService } from '@/lib/cache-service'
import { Bug, RefreshCw, Trash2, Eye, EyeOff, Activity } from 'lucide-react'

export default function LoadingDebugPanel() {
  const [isVisible, setIsVisible] = useState(false)
  const [loadingStats, setLoadingStats] = useState(loadingStateManager.getStats())
  const [cacheStats, setCacheStats] = useState(cacheService.getStats())
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      setLoadingStats(loadingStateManager.getStats())
      setCacheStats(cacheService.getStats())
    }, 1000)

    return () => clearInterval(interval)
  }, [autoRefresh])

  const refreshStats = () => {
    setLoadingStats(loadingStateManager.getStats())
    setCacheStats(cacheService.getStats())
  }

  const clearAllCache = () => {
    cacheService.clear()
    refreshStats()
  }

  const forceCleanup = () => {
    loadingStateManager.cleanup()
    refreshStats()
  }

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <>
      {/* Debug Toggle Button */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition-all duration-200"
          title="Toggle Loading Debug Panel"
        >
          <Bug className="w-5 h-5" />
        </button>
      </div>

      {/* Debug Panel */}
      {isVisible && (
        <div className="fixed bottom-20 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-md w-full max-h-96 overflow-hidden">
          {/* Header */}
          <div className="bg-purple-600 text-white p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span className="font-semibold">Loading Debug</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`p-1 rounded ${autoRefresh ? 'bg-purple-500' : 'bg-purple-700'}`}
                title="Toggle auto-refresh"
              >
                {autoRefresh ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
              <button
                onClick={() => setIsVisible(false)}
                className="p-1 hover:bg-purple-500 rounded"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
            {/* Loading Stats */}
            <div>
              <h4 className="text-white font-medium mb-2">Loading States</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-800 p-2 rounded">
                  <div className="text-gray-400">Total</div>
                  <div className="text-white font-mono">{loadingStats.totalStates}</div>
                </div>
                <div className="bg-blue-900/50 p-2 rounded">
                  <div className="text-blue-300">Loading</div>
                  <div className="text-white font-mono">{loadingStats.loadingStates}</div>
                </div>
                <div className="bg-red-900/50 p-2 rounded">
                  <div className="text-red-300">Errors</div>
                  <div className="text-white font-mono">{loadingStats.errorStates}</div>
                </div>
                <div className="bg-green-900/50 p-2 rounded">
                  <div className="text-green-300">Success</div>
                  <div className="text-white font-mono">{loadingStats.successStates}</div>
                </div>
              </div>
            </div>

            {/* Cache Stats */}
            <div>
              <h4 className="text-white font-medium mb-2">Cache Statistics</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-800 p-2 rounded">
                  <div className="text-gray-400">Entries</div>
                  <div className="text-white font-mono">{cacheStats.totalEntries}</div>
                </div>
                <div className="bg-green-900/50 p-2 rounded">
                  <div className="text-green-300">Valid</div>
                  <div className="text-white font-mono">{cacheStats.validEntries}</div>
                </div>
                <div className="bg-yellow-900/50 p-2 rounded">
                  <div className="text-yellow-300">Expired</div>
                  <div className="text-white font-mono">{cacheStats.expiredEntries}</div>
                </div>
                <div className="bg-blue-900/50 p-2 rounded">
                  <div className="text-blue-300">Hit Rate</div>
                  <div className="text-white font-mono">{cacheStats.hitRate.toFixed(1)}%</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div>
              <h4 className="text-white font-medium mb-2">Actions</h4>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={refreshStats}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </button>
                <button
                  onClick={clearAllCache}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear Cache
                </button>
                <button
                  onClick={forceCleanup}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                >
                  <Activity className="w-3 h-3" />
                  Force Cleanup
                </button>
              </div>
            </div>

            {/* Performance Tips */}
            {(loadingStats.errorStates > 0 || loadingStats.loadingStates > 3) && (
              <div className="bg-yellow-900/30 border border-yellow-600/50 rounded p-3">
                <h5 className="text-yellow-300 font-medium text-sm mb-1">Performance Warning</h5>
                <div className="text-yellow-200 text-xs space-y-1">
                  {loadingStats.errorStates > 0 && (
                    <div>• {loadingStats.errorStates} operations have errors</div>
                  )}
                  {loadingStats.loadingStates > 3 && (
                    <div>• {loadingStats.loadingStates} operations are currently loading</div>
                  )}
                  <div>• Consider refreshing the page if issues persist</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}