'use client'

import React from 'react'

interface LoadingSkeletonProps {
  className?: string
}

export default function LoadingSkeleton({ className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Quick Access Panel Skeleton */}
        <div className="lg:col-span-1 space-y-6">
          {/* Quick Access Title */}
          <div className="space-y-4">
            <div className="h-6 bg-gray-700 rounded w-32"></div>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-3 p-2.5 rounded-lg">
                  <div className="w-4 h-4 bg-gray-700 rounded"></div>
                  <div className="flex-1 space-y-1">
                    <div className="h-4 bg-gray-700 rounded w-24"></div>
                    <div className="h-3 bg-gray-600 rounded w-32"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>

        {/* Series Navigator Skeleton */}
        <div className="lg:col-span-1 space-y-4">
          {/* Search Bar Skeleton */}
          <div className="h-12 bg-gray-700 rounded-lg"></div>
          
          {/* Series List Skeleton */}
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-800/50 rounded-lg border border-gray-700/50">
                {/* Series Header */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center space-x-3">
                    <div className="space-y-2">
                      <div className="h-5 bg-gray-700 rounded w-32"></div>
                      <div className="h-4 bg-gray-600 rounded w-24"></div>
                    </div>
                    <div className="h-5 bg-yellow-600/30 rounded-full w-16"></div>
                  </div>
                  <div className="w-5 h-5 bg-gray-700 rounded"></div>
                </div>
                
                {/* Series Content (for first two items) */}
                {i < 2 && (
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {[...Array(4)].map((_, j) => (
                        <div key={j} className="flex items-center space-x-3 p-2 rounded-lg">
                          <div className="w-6 h-6 bg-gray-700 rounded"></div>
                          <div className="flex-1 space-y-1">
                            <div className="h-4 bg-gray-700 rounded w-20"></div>
                            <div className="h-3 bg-gray-600 rounded w-16"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Featured Panel Skeleton */}
        <div className="lg:col-span-1 space-y-6">
          {/* Featured Content Skeleton */}
          <div className="space-y-4">
            <div className="h-6 bg-gray-700 rounded w-20"></div>
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="h-5 bg-gray-700 rounded w-24"></div>
                    <div className="h-5 bg-purple-600/30 rounded-full w-12"></div>
                  </div>
                  <div className="h-4 bg-gray-600 rounded w-20"></div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// Shimmer effect skeleton for more advanced loading states
export function ShimmerSkeleton({ className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`mega-menu-skeleton-shimmer ${className}`}>
      <LoadingSkeleton />
    </div>
  )
}

// Minimal skeleton for quick loading states
export function MinimalSkeleton({ className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-4">
          <div className="h-6 bg-gray-700 rounded w-32"></div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-12 bg-gray-700 rounded"></div>
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-6 bg-gray-700 rounded w-24"></div>
          <div className="h-32 bg-gray-700 rounded"></div>
        </div>
      </div>
    </div>
  )
}