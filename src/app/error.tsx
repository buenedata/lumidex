'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-pkmn-dark flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Error Icon */}
        <div className="mb-8">
          <div className="text-8xl mb-4">⚠️</div>
          <div className="text-4xl font-bold text-red-400 mb-4 animate-glow-pulse">
            Oops!
          </div>
        </div>
        
        {/* Error Message */}
        <h1 className="text-3xl font-bold text-white mb-4">
          Something went wrong
        </h1>
        <p className="text-gray-400 mb-8 leading-relaxed">
          An unexpected error occurred while loading this page. 
          Don't worry, your Pokemon collection is safe!
        </p>
        
        {/* Error Details (in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-8 p-4 bg-red-900/20 border border-red-600/30 rounded-lg text-left">
            <p className="text-red-400 text-sm font-mono break-all">
              {error.message}
            </p>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={reset}
            className="btn-gaming inline-flex items-center"
          >
            <span className="mr-2">🔄</span>
            Try Again
          </button>
          <div className="flex gap-4 justify-center">
            <Link href="/dashboard" className="btn-secondary">
              Go to Dashboard
            </Link>
            <Link href="/" className="btn-secondary">
              Go Home
            </Link>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="mt-12 opacity-20">
          <div className="flex justify-center space-x-4 text-2xl">
            <span className="animate-bounce" style={{ animationDelay: '0s' }}>⚡</span>
            <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>🔥</span>
            <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>💧</span>
            <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>🌿</span>
            <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>🌟</span>
          </div>
        </div>
      </div>
    </div>
  )
}