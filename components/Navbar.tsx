'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { signOut } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface NotifProposal {
  id: string
  created_at: string
  currency_code: string
  otherUser: { id: string; display_name: string | null; username: string | null; avatar_url: string | null } | null
  offeringCount: number
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

  const isAdmin = profile?.role === 'admin'

  const [searchQuery,    setSearchQuery]    = useState('')
  const [proposals,      setProposals]      = useState<NotifProposal[]>([])
  const [showNotif,      setShowNotif]      = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

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
            </div>

            {/* ── Notification bell ── */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotif(v => !v)}
                className={`relative p-2 rounded-lg transition-all ${
                  proposals.length > 0
                    ? 'text-amber-400 hover:bg-elevated'
                    : 'text-muted hover:text-secondary hover:bg-elevated'
                }`}
                title={proposals.length > 0 ? `${proposals.length} pending trade offer${proposals.length !== 1 ? 's' : ''}` : 'Notifications'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {proposals.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none px-0.5">
                    {proposals.length > 9 ? '9+' : proposals.length}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {showNotif && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-elevated border border-subtle rounded-2xl shadow-2xl overflow-hidden z-50">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
                    <p className="text-sm font-semibold text-primary">Notifications</p>
                    {proposals.length > 0 && (
                      <span className="pill text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400">
                        {proposals.length} pending
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  {proposals.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-2xl mb-2">🔔</p>
                      <p className="text-sm text-muted">No pending trade offers</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-subtle max-h-72 overflow-y-auto">
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
                  <div className="px-4 py-2.5 border-t border-subtle">
                    <Link
                      href="/wanted-board"
                      onClick={() => setShowNotif(false)}
                      className="text-xs text-accent hover:text-accent-light transition-colors font-medium"
                    >
                      View all trade offers →
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
