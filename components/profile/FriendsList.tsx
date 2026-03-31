'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface FriendEntry {
  friendship_id: string
  user_id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

interface FriendsListProps {
  friends: FriendEntry[]
  className?: string
}

export default function FriendsList({ friends, className }: FriendsListProps) {
  const router = useRouter()

  if (friends.length === 0) {
    return (
      <div className={cn(
        'bg-surface border border-subtle rounded-xl p-8 flex flex-col items-center gap-3 text-center',
        className
      )}>
        <div className="text-3xl">🤝</div>
        <p className="text-secondary text-sm">No friends yet</p>
      </div>
    )
  }

  return (
    <div className={cn(
      'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3',
      className
    )}>
      {friends.map(friend => {
        const displayName = friend.display_name || friend.username || 'Unknown'
        const initials = (friend.username ?? 'U').slice(0, 2).toUpperCase()

        return (
          <button
            key={friend.friendship_id}
            type="button"
            onClick={() => router.push(`/profile/${friend.user_id}`)}
            className={cn(
              'flex flex-col items-center gap-2 p-3 rounded-xl text-center',
              'bg-surface border border-subtle',
              'hover:border-[rgba(109,95,255,0.4)] hover:bg-elevated',
              'transition-all duration-150 group'
            )}
          >
            {/* Avatar */}
            <div className="relative w-12 h-12 shrink-0">
              {friend.avatar_url ? (
                <img
                  src={friend.avatar_url}
                  alt={displayName}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-transparent group-hover:ring-accent/40 transition-all"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-accent-dim flex items-center justify-center text-sm font-bold text-accent ring-2 ring-transparent group-hover:ring-accent/40 transition-all">
                  {initials}
                </div>
              )}
            </div>

            {/* Name */}
            <div className="w-full">
              <p className="text-xs font-medium text-primary truncate leading-tight">
                {displayName}
              </p>
              {friend.display_name && friend.username && (
                <p className="text-[11px] text-muted truncate leading-tight">
                  @{friend.username}
                </p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
