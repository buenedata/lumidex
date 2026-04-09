'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { UserCardList } from '@/types'

interface ProfileListsProps {
  userId: string
  isOwnProfile: boolean
  displayName: string
}

export default function ProfileLists({ userId, isOwnProfile, displayName }: ProfileListsProps) {
  const [lists, setLists]       = useState<UserCardList[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  // Create-list inline form state (own profile only)
  const [creating, setCreating]             = useState(false)
  const [newName, setNewName]               = useState('')
  const [createLoading, setCreateLoading]   = useState(false)
  const [createError, setCreateError]       = useState<string | null>(null)

  // Fetch lists on mount
  useEffect(() => {
    setLoading(true)
    setError(null)

    const url = isOwnProfile
      ? '/api/user-lists'
      : `/api/user-lists/public/${userId}`

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(data => setLists(data.lists ?? []))
      .catch(() => setError('Could not load lists.'))
      .finally(() => setLoading(false))
  }, [userId, isOwnProfile])

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    setCreateLoading(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/user-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error()
      const { list } = await res.json()
      setLists(prev => [...prev, list])
      setNewName('')
      setCreating(false)
    } catch {
      setCreateError('Could not create list. Please try again.')
    } finally {
      setCreateLoading(false)
    }
  }

  async function handleDelete(listId: string) {
    if (!confirm('Delete this list? This cannot be undone.')) return
    const prev = lists
    setLists(lists.filter(l => l.id !== listId))
    try {
      const res = await fetch(`/api/user-lists/${listId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setLists(prev)
    }
  }

  // ── Section header ──────────────────────────────────────────────────────────
  const sectionTitle = isOwnProfile ? 'Your Lists' : `${displayName}'s Lists`

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2
          className="text-xl font-bold text-primary"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          {sectionTitle}
        </h2>
        {isOwnProfile && (
          <button
            onClick={() => { setCreating(true); setCreateError(null) }}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-accent border border-accent/40 rounded-lg hover:bg-accent-dim transition-all shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New List
          </button>
        )}
        {isOwnProfile && lists.length > 0 && !creating && (
          <Link
            href="/lists"
            className="text-xs text-accent hover:text-accent-light transition-colors ml-auto"
          >
            Manage all →
          </Link>
        )}
      </div>

      {/* ── Inline create form ─────────────────────────────────────────────── */}
      {creating && (
        <div className="mb-4 p-4 rounded-xl bg-surface border border-subtle flex flex-col gap-3">
          <p className="text-sm font-semibold text-primary">Create a new list</p>
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') { setCreating(false); setNewName('') }
            }}
            placeholder="List name…"
            maxLength={80}
            className={cn(
              'w-full h-9 bg-elevated border border-subtle rounded-lg px-3 text-sm text-primary',
              'placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30',
            )}
          />
          {createError && <p className="text-xs text-red-400">{createError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || createLoading}
              className={cn(
                'h-8 px-4 text-xs font-medium rounded-lg transition-all',
                'bg-accent text-white hover:bg-accent-light',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {createLoading ? 'Creating…' : 'Create List'}
            </button>
            <button
              onClick={() => { setCreating(false); setNewName(''); setCreateError(null) }}
              className="h-8 px-3 text-xs text-muted hover:text-primary rounded-lg hover:bg-elevated transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center gap-3 py-10 text-muted">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm">Loading lists…</span>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="bg-surface border border-subtle rounded-xl p-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!loading && !error && lists.length === 0 && (
        <div className="bg-surface border border-subtle rounded-xl p-8 flex flex-col items-center gap-3 text-center">
          <div className="text-3xl">📋</div>
          {isOwnProfile ? (
            <>
              <p className="text-secondary text-sm">You have no lists yet.</p>
              <button
                onClick={() => setCreating(true)}
                className="h-8 px-4 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-light transition-all"
              >
                Create your first list
              </button>
            </>
          ) : (
            <p className="text-secondary text-sm">No public lists yet.</p>
          )}
        </div>
      )}

      {/* ── Lists grid ─────────────────────────────────────────────────────── */}
      {!loading && !error && lists.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {lists.map(list => (
            <div
              key={list.id}
              className="group relative bg-surface border border-subtle rounded-xl overflow-hidden hover:border-[rgba(255,255,255,0.15)] transition-all"
            >
              {/* Preview thumbnails */}
              <Link href={`/lists/${list.id}`} className="block">
                <div className="flex gap-1 p-3 bg-elevated min-h-[90px] items-center">
                  {list.preview_images && list.preview_images.length > 0 ? (
                    list.preview_images.slice(0, 4).map((img, i) => (
                      <div
                        key={i}
                        className="flex-1 aspect-[2.5/3.5] rounded overflow-hidden bg-surface"
                      >
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-subtle/50" />
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-muted text-xs">
                      No cards yet
                    </div>
                  )}
                </div>
              </Link>

              {/* List info */}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/lists/${list.id}`}
                      className="block font-semibold text-primary truncate hover:text-accent transition-colors text-sm"
                    >
                      {list.name}
                    </Link>
                    <p className="text-xs text-muted mt-0.5">
                      {list.card_count ?? 0} card{(list.card_count ?? 0) !== 1 ? 's' : ''}
                      {isOwnProfile && (
                        <>
                          {' · '}
                          <span className={list.is_public ? 'text-green-400' : 'text-muted'}>
                            {list.is_public ? '🌐 Public' : '🔒 Private'}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Delete — own profile only */}
                  {isOwnProfile && (
                    <button
                      onClick={() => handleDelete(list.id)}
                      title="Delete list"
                      className="shrink-0 p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
