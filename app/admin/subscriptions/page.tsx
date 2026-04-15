'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface UserRow {
  id: string
  username: string | null
  display_name: string | null
  email: string | null
  role: string | null
  avatar_url: string | null
  tier: 'free' | 'pro'
  billing_period: 'monthly' | 'annual' | null
  current_period_end: string | null
  is_manual_grant: boolean
}

export default function AdminSubscriptionsPage() {
  const { user, profile, isLoading } = useAuthStore()
  const router = useRouter()

  const [query, setQuery]     = useState('')
  const [users, setUsers]     = useState<UserRow[]>([])
  const [fetching, setFetching] = useState(false)
  const [actionState, setActionState] = useState<Record<string, 'loading' | 'done' | 'error'>>({})
  const [messages, setMessages] = useState<Record<string, string>>({})

  // Auth guard
  useEffect(() => {
    if (!isLoading) {
      if (!user) { router.push('/login?redirect=/admin/subscriptions'); return }
      if (profile?.role !== 'admin') { router.push('/dashboard'); return }
    }
  }, [isLoading, user, profile, router])

  const search = useCallback(async (q: string) => {
    setFetching(true)
    try {
      const res = await fetch(`/api/admin/subscriptions?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch {
      setUsers([])
    } finally {
      setFetching(false)
    }
  }, [])

  // Initial load — show recent users
  useEffect(() => {
    if (profile?.role === 'admin') search('')
  }, [profile, search])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => search(query), 350)
    return () => clearTimeout(t)
  }, [query, search])

  async function handleGrant(userId: string, tier: 'pro' | 'free') {
    setActionState(s => ({ ...s, [userId]: 'loading' }))
    setMessages(m => ({ ...m, [userId]: '' }))
    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setActionState(s => ({ ...s, [userId]: 'done' }))
      setMessages(m => ({ ...m, [userId]: data.message }))
      // Update local row immediately
      setUsers(us => us.map(u =>
        u.id === userId
          ? { ...u, tier, billing_period: null, current_period_end: null, is_manual_grant: tier === 'pro' }
          : u
      ))
      setTimeout(() => setActionState(s => ({ ...s, [userId]: undefined as unknown as 'done' })), 2000)
    } catch (err) {
      setActionState(s => ({ ...s, [userId]: 'error' }))
      setMessages(m => ({ ...m, [userId]: err instanceof Error ? err.message : 'Error' }))
    }
  }

  if (isLoading || !profile) {
    return (
      <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#6d5fff] border-t-transparent animate-spin" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white px-4 py-10">
      <div className="max-w-4xl mx-auto">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <Link href="/admin" className="text-xs text-[#5a5a78] hover:text-[#9191b0] transition-colors mb-2 inline-block">
              ← Admin Hub
            </Link>
            <h1 className="text-2xl font-bold font-display">💎 Subscription Management</h1>
            <p className="text-[#9191b0] text-sm mt-1">
              Grant or revoke Lumidex Pro for any user — no payment required.
            </p>
          </div>
        </div>

        {/* ── Search ──────────────────────────────────────────────────────── */}
        <div className="relative mb-6">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a5a78]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by username, display name or email…"
            className="w-full h-10 bg-[#111118] border border-[#2a2a3d] rounded-xl pl-9 pr-4 text-sm text-white placeholder:text-[#5a5a78]
              focus:outline-none focus:border-[#6d5fff] focus:ring-1 focus:ring-[#6d5fff]/30 transition-colors"
          />
          {fetching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-[#6d5fff] border-t-transparent animate-spin" />
          )}
        </div>

        {/* ── User list ───────────────────────────────────────────────────── */}
        {users.length === 0 && !fetching ? (
          <div className="text-center py-16 text-[#5a5a78]">
            {query ? 'No users matching that search.' : 'No users found.'}
          </div>
        ) : (
          <div className="space-y-2">
            {users.map(u => {
              const displayName = u.display_name || u.username || u.email || u.id
              const state = actionState[u.id]
              const msg   = messages[u.id]

              return (
                <div
                  key={u.id}
                  className={`flex items-center gap-4 bg-[#111118] border rounded-xl px-4 py-3 transition-all duration-200 ${
                    u.tier === 'pro'
                      ? 'border-[rgba(109,95,255,0.3)]'
                      : 'border-[#2a2a3d]'
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-[#1a1a26] border border-[#2a2a3d] flex items-center justify-center shrink-0">
                    {u.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-[#6d5fff]">{(displayName)[0].toUpperCase()}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">{displayName}</span>
                      {u.username && u.display_name && (
                        <span className="text-xs text-[#5a5a78]">@{u.username}</span>
                      )}
                      {u.role === 'admin' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">ADMIN</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {u.tier === 'pro' ? (
                        <span className="text-xs font-bold text-[#a78bfa]">
                          💎 Pro{u.billing_period ? ` · ${u.billing_period}` : ' · manual grant'}{u.is_manual_grant ? ' · Complimentary' : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-[#5a5a78]">Free plan</span>
                      )}
                      {msg && (
                        <span className={`text-xs ${state === 'error' ? 'text-[#f87171]' : 'text-[#34d399]'}`}>
                          {msg}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action button */}
                  {u.tier === 'pro' ? (
                    <button
                      onClick={() => handleGrant(u.id, 'free')}
                      disabled={state === 'loading'}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold
                        text-[#f87171] border border-[#f87171]/30
                        hover:bg-[#f87171]/10 hover:border-[#f87171]/60
                        transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {state === 'loading' ? '…' : 'Revoke Pro'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleGrant(u.id, 'pro')}
                      disabled={state === 'loading'}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-white
                        bg-[#6d5fff] hover:bg-[#8577ff]
                        shadow-[0_0_10px_rgba(109,95,255,0.3)]
                        transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {state === 'loading' ? '…' : '💎 Grant Pro'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Info note ───────────────────────────────────────────────────── */}
        <p className="text-xs text-[#5a5a78] text-center mt-8">
          Manual grants have no billing period and are not tied to Stripe.
          They persist until revoked here. Paid subscriptions are managed via Stripe.
        </p>

      </div>
    </main>
  )
}
