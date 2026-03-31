'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { UserSearchResult } from '@/app/api/users/search/route'

interface AddFriendModalProps {
  isOpen: boolean
  onClose: () => void
  /** Current logged-in user ID */
  currentUserId: string
}

export default function AddFriendModal({
  isOpen,
  onClose,
  currentUserId,
}: AddFriendModalProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  /** Track per-user loading states */
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // ── Debounced search ────────────────────────────────────────────────────────
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(trimmed)}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.results ?? [])
        }
      } catch (err) {
        console.error('[AddFriendModal] search error:', err)
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      // Auto-focus the search input after the transition
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen])

  // ── Optimistic status updater ───────────────────────────────────────────────
  function updateResultStatus(
    userId: string,
    status: UserSearchResult['friendship_status'],
    friendshipId: string | null
  ) {
    setResults(prev =>
      prev.map(r =>
        r.id === userId
          ? { ...r, friendship_status: status, friendship_id: friendshipId }
          : r
      )
    )
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleAddFriend(result: UserSearchResult) {
    setLoadingId(result.id)
    try {
      const res = await fetch('/api/friendships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressee_id: result.id }),
      })
      const data = await res.json()
      if (data.friendship) {
        updateResultStatus(result.id, 'pending_outgoing', data.friendship.id)
      }
    } catch (err) {
      console.error('[AddFriendModal] add friend error:', err)
    } finally {
      setLoadingId(null)
    }
  }

  async function handleCancel(result: UserSearchResult) {
    if (!result.friendship_id) return
    setLoadingId(result.id)
    try {
      await fetch(`/api/friendships/${result.friendship_id}`, { method: 'DELETE' })
      updateResultStatus(result.id, 'none', null)
    } catch (err) {
      console.error('[AddFriendModal] cancel error:', err)
    } finally {
      setLoadingId(null)
    }
  }

  async function handleAccept(result: UserSearchResult) {
    if (!result.friendship_id) return
    setLoadingId(result.id)
    try {
      const res = await fetch(`/api/friendships/${result.friendship_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      })
      const data = await res.json()
      if (data.friendship) {
        updateResultStatus(result.id, 'accepted', result.friendship_id)
        router.refresh()
      }
    } catch (err) {
      console.error('[AddFriendModal] accept error:', err)
    } finally {
      setLoadingId(null)
    }
  }

  async function handleDecline(result: UserSearchResult) {
    if (!result.friendship_id) return
    setLoadingId(result.id)
    try {
      await fetch(`/api/friendships/${result.friendship_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'declined' }),
      })
      updateResultStatus(result.id, 'none', null)
    } catch (err) {
      console.error('[AddFriendModal] decline error:', err)
    } finally {
      setLoadingId(null)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Find Friends"
      maxWidth="md"
    >
      <div className="px-6 pb-6 flex flex-col gap-4">
        {/* Search input */}
        <Input
          ref={inputRef}
          placeholder="Search by username or name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />

        {/* Results */}
        <div className="flex flex-col gap-1 min-h-[80px]">
          {/* Loading */}
          {searching && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
            </div>
          )}

          {/* No query yet */}
          {!searching && query.trim().length < 2 && (
            <p className="text-center text-secondary text-sm py-8">
              Type at least 2 characters to search
            </p>
          )}

          {/* No results */}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-center text-secondary text-sm py-8">
              No users found for &ldquo;{query.trim()}&rdquo;
            </p>
          )}

          {/* Results list */}
          {!searching && results.map(result => {
            const displayName = result.display_name || result.username || 'Unknown'
            const initials    = (result.username ?? 'U').slice(0, 2).toUpperCase()
            const isLoading   = loadingId === result.id

            return (
              <div
                key={result.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface transition-colors"
              >
                {/* Avatar — clickable → profile */}
                <button
                  type="button"
                  onClick={() => { onClose(); router.push(`/profile/${result.id}`) }}
                  className="shrink-0"
                  tabIndex={-1}
                >
                  {result.avatar_url ? (
                    <img
                      src={result.avatar_url}
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
                    onClick={() => { onClose(); router.push(`/profile/${result.id}`) }}
                    className="text-sm font-medium text-primary hover:text-accent transition-colors truncate block text-left"
                  >
                    {displayName}
                  </button>
                  {result.username && (
                    <p className="text-xs text-muted truncate">@{result.username}</p>
                  )}
                </div>

                {/* Status-aware action */}
                <div className="shrink-0 flex items-center gap-2">
                  {result.friendship_status === 'none' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAddFriend(result)}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Sending…' : '+ Add Friend'}
                    </Button>
                  )}

                  {result.friendship_status === 'pending_outgoing' && (
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-xs px-2.5 py-1 rounded-lg',
                        'bg-elevated border border-subtle text-muted'
                      )}>
                        Request Sent
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCancel(result)}
                        disabled={isLoading}
                        className="text-xs text-muted hover:text-secondary transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {result.friendship_status === 'pending_incoming' && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleAccept(result)}
                        disabled={isLoading}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDecline(result)}
                        disabled={isLoading}
                      >
                        Decline
                      </Button>
                    </div>
                  )}

                  {result.friendship_status === 'accepted' && (
                    <span className={cn(
                      'text-xs px-2.5 py-1 rounded-lg font-medium',
                      'bg-accent-dim border border-[rgba(109,95,255,0.3)] text-accent',
                      'flex items-center gap-1'
                    )}>
                      ✓ Friends
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
