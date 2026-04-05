'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { signOut } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export default function Navbar() {
  const { user, profile } = useAuthStore()
  const router = useRouter()

  // Check if current user is admin based on database role
  const isAdmin = profile?.role === 'admin'

  const [searchQuery, setSearchQuery] = useState('')

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
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
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
        {user ? (
          <>
            {/* Nav links */}
            <div className="flex items-center gap-1">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 text-sm text-secondary hover:text-accent hover:bg-elevated rounded-lg transition-all"
              >
                Dashboard
              </Link>
              <Link
                href="/sets"
                className="px-3 py-1.5 text-sm text-secondary hover:text-accent hover:bg-elevated rounded-lg transition-all"
              >
                Sets
              </Link>
              <Link
                href="/collection"
                className="px-3 py-1.5 text-sm text-secondary hover:text-accent hover:bg-elevated rounded-lg transition-all"
              >
                Collection
              </Link>
              <Link
                href={`/profile/${user.id}`}
                className="px-3 py-1.5 text-sm text-secondary hover:text-accent hover:bg-elevated rounded-lg transition-all"
              >
                Profile
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="px-3 py-1.5 text-sm text-secondary hover:text-accent hover:bg-elevated rounded-lg transition-all"
                  title="Admin Panel"
                >
                  🛠️ Admin
                </Link>
              )}
            </div>

            {/* User section */}
            <div className="flex items-center gap-2 pl-2 border-l border-subtle">
              <Link
                href={`/profile/${user.id}`}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Profile"
                    className="w-7 h-7 rounded-full ring-1 ring-accent/30"
                  />
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
          <Link
            href="/login"
            className="h-9 px-4 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-light transition-all glow-accent-sm inline-flex items-center"
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  )
}
