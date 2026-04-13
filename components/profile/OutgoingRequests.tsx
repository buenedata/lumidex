'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { FriendEntry } from './FriendsList'

interface OutgoingRequestsProps {
  initialRequests: FriendEntry[]
  className?: string
}

export default function OutgoingRequests({
  initialRequests,
  className,
}: OutgoingRequestsProps) {
  const router = useRouter()
  const [requests, setRequests] = useState<FriendEntry[]>(initialRequests)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  if (requests.length === 0) return null

  async function handleCancel(request: FriendEntry) {
    setLoadingId(request.friendship_id)
    try {
      await fetch(`/api/friendships/${request.friendship_id}`, { method: 'DELETE' })
      setRequests(prev => prev.filter(r => r.friendship_id !== request.friendship_id))
    } catch (err) {
      console.error('[OutgoingRequests] cancel error:', err)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className={cn('mb-6 max-w-md', className)}>
      <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3">
        Sent Requests
        <span className="pill ml-2 px-1.5 py-0.5 rounded-full text-xs font-bold bg-elevated border border-subtle text-muted">
          {requests.length}
        </span>
      </h3>

      <div className="flex flex-col gap-2">
        {requests.map(request => {
          const displayName = request.display_name || request.username || 'Unknown'
          const initials    = (request.username ?? 'U').slice(0, 2).toUpperCase()
          const isLoading   = loadingId === request.friendship_id

          return (
            <div
              key={request.friendship_id}
              className="flex items-center gap-3 bg-surface border border-subtle rounded-xl px-4 py-3"
            >
              {/* Avatar */}
              <button
                type="button"
                onClick={() => router.push(`/profile/${request.user_id}`)}
                className="shrink-0"
              >
                {request.avatar_url ? (
                  <img
                    src={request.avatar_url}
                    alt={displayName}
                    className="w-9 h-9 rounded-full object-cover hover:opacity-80 transition-opacity"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-accent-dim flex items-center justify-center text-xs font-bold text-accent hover:opacity-80 transition-opacity">
                    {initials}
                  </div>
                )}
              </button>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => router.push(`/profile/${request.user_id}`)}
                  className="text-sm font-medium text-primary hover:text-accent transition-colors truncate block text-left"
                >
                  {displayName}
                </button>
                {request.username && request.display_name && (
                  <p className="text-xs text-muted truncate">@{request.username}</p>
                )}
              </div>

              {/* Status + Cancel */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="pill text-xs text-muted px-2.5 py-1 rounded-lg bg-elevated border border-subtle">
                  Pending…
                </span>
                <button
                  type="button"
                  onClick={() => handleCancel(request)}
                  disabled={isLoading}
                  className={cn(
                    'text-xs font-medium transition-colors',
                    isLoading
                      ? 'text-muted cursor-not-allowed'
                      : 'text-muted hover:text-red-400'
                  )}
                >
                  {isLoading ? 'Cancelling…' : 'Cancel'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
