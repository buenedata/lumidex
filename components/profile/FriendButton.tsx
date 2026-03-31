'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export type FriendshipStatus =
  | 'none'
  | 'accepted'
  | 'pending_outgoing'   // I sent the request
  | 'pending_incoming'   // They sent the request

interface FriendshipRow {
  id: string
  status: string
  requester_id: string
  addressee_id: string
}

interface FriendButtonProps {
  /** The profile user's ID (not the current user) */
  targetUserId: string
  /** Current logged-in user ID */
  currentUserId: string
  /** Initial friendship row (null = no relation yet) */
  initialFriendship: FriendshipRow | null
  className?: string
}

export default function FriendButton({
  targetUserId,
  currentUserId,
  initialFriendship,
  className,
}: FriendButtonProps) {
  const [friendship, setFriendship] = useState<FriendshipRow | null>(initialFriendship)
  const [loading, setLoading] = useState(false)

  /** Derive the status from the friendship row + who the current user is */
  function getStatus(): FriendshipStatus {
    if (!friendship) return 'none'
    if (friendship.status === 'accepted') return 'accepted'
    if (friendship.status === 'pending') {
      return friendship.requester_id === currentUserId
        ? 'pending_outgoing'
        : 'pending_incoming'
    }
    return 'none'
  }

  async function handleAddFriend() {
    setLoading(true)
    try {
      const res = await fetch('/api/friendships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressee_id: targetUserId }),
      })
      const data = await res.json()
      if (data.friendship) {
        setFriendship({
          ...data.friendship,
          requester_id: currentUserId,
          addressee_id: targetUserId,
        })
      }
    } catch (err) {
      console.error('FriendButton: add friend failed', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept() {
    if (!friendship) return
    setLoading(true)
    try {
      const res = await fetch(`/api/friendships/${friendship.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      })
      const data = await res.json()
      if (data.friendship) {
        setFriendship(prev => prev ? { ...prev, status: 'accepted' } : prev)
      }
    } catch (err) {
      console.error('FriendButton: accept failed', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDecline() {
    if (!friendship) return
    setLoading(true)
    try {
      await fetch(`/api/friendships/${friendship.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'declined' }),
      })
      setFriendship(null)
    } catch (err) {
      console.error('FriendButton: decline failed', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove() {
    if (!friendship) return
    if (!confirm('Remove this friend?')) return
    setLoading(true)
    try {
      await fetch(`/api/friendships/${friendship.id}`, { method: 'DELETE' })
      setFriendship(null)
    } catch (err) {
      console.error('FriendButton: remove failed', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!friendship) return
    setLoading(true)
    try {
      await fetch(`/api/friendships/${friendship.id}`, { method: 'DELETE' })
      setFriendship(null)
    } catch (err) {
      console.error('FriendButton: cancel failed', err)
    } finally {
      setLoading(false)
    }
  }

  const status = getStatus()

  if (status === 'none') {
    return (
      <Button
        variant="primary"
        size="sm"
        onClick={handleAddFriend}
        disabled={loading}
        className={className}
      >
        {loading ? 'Sending…' : '+ Add Friend'}
      </Button>
    )
  }

  if (status === 'pending_outgoing') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="text-xs text-muted px-3 py-1.5 rounded-lg bg-elevated border border-subtle">
          Request Sent
        </span>
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="text-xs text-muted hover:text-secondary transition-colors"
          title="Cancel request"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (status === 'pending_incoming') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="text-xs text-secondary font-medium">Wants to be friends</span>
        <Button
          variant="primary"
          size="sm"
          onClick={handleAccept}
          disabled={loading}
        >
          Accept
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleDecline}
          disabled={loading}
        >
          Decline
        </Button>
      </div>
    )
  }

  // accepted
  return (
    <div className={cn('flex items-center gap-2 group', className)}>
      <span className="text-xs font-medium text-accent flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-dim border border-[rgba(109,95,255,0.3)]">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        Friends
      </span>
      <button
        type="button"
        onClick={handleRemove}
        disabled={loading}
        className="text-xs text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        title="Remove friend"
      >
        Remove
      </button>
    </div>
  )
}
