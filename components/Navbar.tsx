'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { signOut } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useIsPro } from '@/hooks/useProGate'
import { ProBadge } from '@/components/upgrade/ProBadge'

interface NotifProposal {
  id: string
  created_at: string
  currency_code: string
  otherUser: { id: string; display_name: string | null; username: string | null; avatar_url: string | null } | null
  offeringCount: number
}

interface NotifFriend {
  id: string   // friendship_id
  type: 'received' | 'accepted' | 'declined'
  otherUser: { id: string; display_name: string | null; username: string | null; avatar_url: string | null }
  created_at: string
  updated_at?: string
}

function relTime(iso: string): string {
  const mins  = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 2)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function Navbar() {
  const { user, profile, isLoading: isAuthLoading } = useAuthStore()
  const router = useRouter()
  const isPro  = useIsPro()

  const isAdmin = profile?.role === 'admin'

  const [searchQuery,    setSearchQuery]    = useState('')
  const [proposals,      setProposals]      = useState<NotifProposal[]>([])
  const [friendNotifs,   setFriendNotifs]   = useState<NotifFriend[]>([])
  const [seenFriendIds,  setSeenFriendIds]  = useState<Set<string>>(new Set())
  const [showNotif,      setShowNotif]      = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  // Load dismissed friend notification IDs from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('lumidex_friend_notif_seen')
      if (raw) setSeenFriendIds(new Set(JSON.parse(raw) as string[]))
    } catch {}
  }, [])

  // Poll for friend notifications
  useEffect(() => {
    if (!user) return
    function loadFriends() {
      fetch('/api/friendships')
        .then(r => r.json())
        .then(d => {
          const notifs: NotifFriend[] = []

          // Pending incoming → "X sent you a friend request"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const f of (d.pending_incoming ?? []) as any[]) {
            notifs.push({
              id: f.friendship_id,
              type: 'received',
              otherUser: { id: f.user_id, display_name: f.display_name, username: f.username, avatar_url: f.avatar_url },
              created_at: f.created_at,
            })
          }

          // Accepted outgoing → "X accepted your friend request"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const f of (d.accepted_outgoing ?? []) as any[]) {
            notifs.push({
              id: f.friendship_id,
              type: 'accepted',
              otherUser: { id: f.user_id, display_name: f.display_name, username: f.username, avatar_url: f.avatar_url },
              created_at: f.created_at,
              updated_at: f.updated_at,
            })
          }

          // Declined outgoing → "X declined your friend request"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const f of (d.declined_outgoing ?? []) as any[]) {
            notifs.push({
              id: f.friendship_id,
              type: 'declined',
              otherUser: { id: f.user_id, display_name: f.display_name, username: f.username, avatar_url: f.avatar_url },
              created_at: f.created_at,
              updated_at: f.updated_at,
            })
          }

          setFriendNotifs(notifs)
        })
        .catch(() => {})
    }
    loadFriends()
    const fid = setInterval(loadFriends, 60_000)
    return () => clearInterval(fid)
  }, [user])

  // Poll for pending trade proposals
  useEffect(() => {
    if (!user) return
    function load() {
      fetch('/api/trade-proposals')
        .then(r => r.json())
        .then(d => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pending = (d.proposals ?? []).filter((p: any) => p.status === 'pending' && !p.isProposer)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setProposals(pending.map((p: any) => ({
            id:           p.id,
            created_at:   p.created_at,
            currency_code:p.currency_code ?? 'EUR',
            otherUser:    p.otherUser ?? null,
            offeringCount:(p.trade_proposal_items ?? []).filter((i: { direction: string }) => i.direction === 'offering').length,
          })))
        })
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [user])

  // Close dropdown on outside click
  useEffect(() => {
    if (!showNotif) return
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showNotif])

  // Friend notifications that are still "unread":
  //   - 'received' ones always show until the user acts (they vanish from the API when actioned)
  //   - 'accepted' / 'declined' show until explicitly dismissed via localStorage
  const visibleFriendNotifs = friendNotifs.filter(
    n => n.type === 'received' || !seenFriendIds.has(n.id)
  )
  const totalNotifCount = proposals.length + visibleFriendNotifs.length

  function dismissFriend(id: string) {
    setSeenFriendIds(prev => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem('lumidex_friend_notif_seen', JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      router.push(`/browse?q=${encodeURIComponent(searchQuery.trim())}&mode=cards`)
      setSearchQuery('')
    }
  }

  return (
    <nav className="sticky top-0 z-50 h-14 bg-[color:var(--color-bg-surface)]/90 backdrop-blur-xl border-b border-subtle">
      <div className="max-w-screen-2xl mx-auto h-full px-4 flex items-center gap-4">

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center shrink-0 mr-2">
          <img src="/logo.svg" alt="Lumidex" className="h-9 w-auto" />
        </Link>

        {/* Search */}
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search cards..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              className="w-full h-9 bg-elevated border border-subtle rounded-lg pl-9 pr-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
            />
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Nav links + user section */}
        {isAuthLoading ? (
          /* Skeleton while Supabase session is resolving — prevents the Sign-In
             button from flashing then disappearing for logged-in users. */
          <div className="flex items-center gap-2 animate-pulse">
            <div className="w-7 h-7 rounded-full bg-elevated" />
            <div className="w-16 h-3.5 bg-elevated rounded hidden sm:block" />
          </div>
        ) : user ? (
          <>
            {/* Nav links */}
            <div className="flex items-center gap-1">
              <Link href="/dashboard"            className="px-3 py-1.5 text-sm text-secondary hover:text-accent hover:bg-elevated rounded-lg transition-all">Dashboard</Link>
              <Link href={`/profile/${user.id}`} className="px-3 py-1.5 text-sm text-secondary hover:text-accent hover:bg-elevated rounded-lg transition-all">Profile</Link>
              <Link href="/sets"                 className="px-3 py-1.5 text-sm text-secondary hover:text-accent hover:bg-elevated rounded-lg transition-all">Sets</Link>
              <Link href="/collection"           className="px-3 py-1.5 text-sm text-secondary hover:text-accent hover:bg-elevated rounded-lg transition-all">Collection</Link>
              <Link href="/wanted-board"         className="px-3 py-1.5 text-sm text-secondary hover:text-accent hover:bg-elevated rounded-lg transition-all">Wanted Board</Link>
              <Link href="/faq"                  className="px-3 py-1.5 text-sm text-secondary hover:text-accent hover:bg-elevated rounded-lg transition-all">FAQ</Link>
              {isAdmin && (
                <Link href="/admin" className="px-3 py-1.5 text-sm text-secondary hover:text-accent hover:bg-elevated rounded-lg transition-all" title="Admin Panel">
                  🛠️ Admin
                </Link>
              )}
              {/* Upgrade CTA — only shown to free users */}
              {!isPro && (
                <Link
                  href="/upgrade"
                  className="ml-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white
                    bg-[#6d5fff] hover:bg-[#8577ff]
                    shadow-[0_0_10px_rgba(109,95,255,0.35)]
                    hover:shadow-[0_0_14px_rgba(109,95,255,0.5)]
                    transition-all duration-200"
                >
                  💎 Upgrade
                </Link>
              )}
            </div>

            {/* ── Notification bell ── */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotif(v => !v)}
                className={`relative p-2 rounded-lg transition-all ${
                  totalNotifCount > 0
                    ? 'text-amber-400 hover:bg-elevated'
                    : 'text-muted hover:text-secondary hover:bg-elevated'
                }`}
                title={totalNotifCount > 0 ? `${totalNotifCount} notification${totalNotifCount !== 1 ? 's' : ''}` : 'Notifications'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {totalNotifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none px-0.5">
                    {totalNotifCount > 9 ? '9+' : totalNotifCount}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {showNotif && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-elevated border border-subtle rounded-2xl shadow-2xl overflow-hidden z-50">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
                    <p className="text-sm font-semibold text-primary">Notifications</p>
                    {totalNotifCount > 0 && (
                      <span className="pill text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400">
                        {totalNotifCount} pending
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  {totalNotifCount === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-2xl mb-2">🔔</p>
                      <p className="text-sm text-muted">No new notifications</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-subtle max-h-80 overflow-y-auto">

                      {/* ── Friend notifications ── */}
                      {visibleFriendNotifs.map(n => {
                        const name = n.otherUser.display_name ?? n.otherUser.username ?? 'Trainer'
                        const timeStr = relTime(n.updated_at ?? n.created_at)

                        const label =
                          n.type === 'received' ? `${name} sent you a friend request` :
                          n.type === 'accepted' ? `${name} accepted your friend request` :
                                                  `${name} declined your friend request`

                        const iconBg =
                          n.type === 'received' ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' :
                          n.type === 'accepted' ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                                                  'bg-red-500/20   border-red-500/30   text-red-400'

                        const icon =
                          n.type === 'received' ? (
                            // Person / add-friend icon
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                          ) : n.type === 'accepted' ? (
                            // Checkmark icon
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            // X icon
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )

                        return (
                          <div key={n.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors group">
                            {/* Avatar or icon badge */}
                            <div className="relative shrink-0">
                              <div className="w-9 h-9 rounded-full overflow-hidden bg-surface border border-subtle flex items-center justify-center">
                                {n.otherUser.avatar_url ? (
                                  <Image src={n.otherUser.avatar_url} alt={name} width={36} height={36} className="object-cover w-full h-full" unoptimized />
                                ) : (
                                  <span className="text-sm font-bold text-accent">{name[0].toUpperCase()}</span>
                                )}
                              </div>
                              {/* Type badge overlaid on avatar */}
                              <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${iconBg}`}>
                                {icon}
                              </span>
                            </div>

                            {/* Text — clicking navigates to the other user's profile */}
                            <Link
                              href={`/profile/${n.otherUser.id}`}
                              onClick={() => {
                                setShowNotif(false)
                                if (n.type !== 'received') dismissFriend(n.id)
                              }}
                              className="flex-1 min-w-0"
                            >
                              <p className="text-sm font-medium text-primary leading-tight">{label}</p>
                              <p className="text-xs text-muted leading-tight">{timeStr}</p>
                            </Link>

                            {/* Dismiss button for accepted / declined (not for received — those need action) */}
                            {n.type !== 'received' && (
                              <button
                                onClick={() => dismissFriend(n.id)}
                                className="shrink-0 p-1 rounded text-muted hover:text-primary hover:bg-elevated transition-colors"
                                title="Dismiss"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        )
                      })}

                      {/* ── Trade proposal notifications ── */}
                      {proposals.map(p => {
                        const name = p.otherUser?.display_name ?? p.otherUser?.username ?? 'Trainer'
                        return (
                          <Link
                            key={p.id}
                            href="/wanted-board"
                            onClick={() => setShowNotif(false)}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors group"
                          >
                            {/* Avatar */}
                            <div className="w-9 h-9 rounded-full overflow-hidden bg-surface border border-subtle shrink-0 flex items-center justify-center">
                              {p.otherUser?.avatar_url ? (
                                <Image src={p.otherUser.avatar_url} alt={name} width={36} height={36} className="object-cover w-full h-full" unoptimized />
                              ) : (
                                <span className="text-sm font-bold text-accent">{name[0].toUpperCase()}</span>
                              )}
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-primary leading-tight truncate">
                                {name} proposed a trade
                              </p>
                              <p className="text-xs text-muted leading-tight">
                                {p.offeringCount} card{p.offeringCount !== 1 ? 's' : ''} · {relTime(p.created_at)}
                              </p>
                            </div>

                            {/* Arrow */}
                            <svg className="w-4 h-4 text-muted group-hover:text-accent transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        )
                      })}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="px-4 py-2.5 border-t border-subtle flex items-center justify-between">
                    <Link
                      href={`/profile/${user.id}`}
                      onClick={() => setShowNotif(false)}
                      className="text-xs text-accent hover:text-accent-light transition-colors font-medium"
                    >
                      Friend requests →
                    </Link>
                    <Link
                      href="/wanted-board"
                      onClick={() => setShowNotif(false)}
                      className="text-xs text-accent hover:text-accent-light transition-colors font-medium"
                    >
                      Trade offers →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* User section */}
            <div className="flex items-center gap-2 pl-2 border-l border-subtle">
              <Link href={`/profile/${user.id}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-7 h-7 rounded-full ring-1 ring-accent/30" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-accent-dim border border-accent/30 flex items-center justify-center shrink-0">
                    <span className="text-accent text-xs font-semibold uppercase">
                      {(profile?.username || user.email || 'U')[0]}
                    </span>
                  </div>
                )}
                <span className="text-sm font-medium text-primary hidden sm:block">
                  {profile?.username || 'User'}
                </span>
                {isPro && <ProBadge size="sm" className="hidden sm:inline-flex" />}
              </Link>
              <button
                onClick={handleSignOut}
                className="ml-1 px-3 py-1.5 text-xs text-secondary hover:text-primary hover:bg-elevated rounded-lg transition-all"
              >
                Sign Out
              </button>
            </div>
          </>
        ) : (
          <Link href="/login" className="h-9 px-4 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-light transition-all glow-accent-sm inline-flex items-center">
            Sign In
          </Link>
        )}
      </div>
    </nav>
  )
}
