'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { UserCardList } from '@/types'
import { cn } from '@/lib/utils'
export default function ListsPage() {
  const { user, isLoading: authLoading } = useAuthStore()
  const router = useRouter()

  const [lists, setLists]         = useState<UserCardList[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [search, setSearch]       = useState('')

  // Create-list inline form
  const [creating, setCreating]       = useState(false)
  const [newName, setNewName]         = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError]     = useState<string | null>(null)

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  // Fetch lists
  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetch('/api/user-lists')
      .then(res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(data => setLists(data.lists ?? []))
      .catch(() => setError('Could not load your lists.'))
      .finally(() => setLoading(false))
  }, [user])

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

  const filtered = search.trim()
    ? lists.filter(l => l.name.toLowerCase().includes(search.toLowerCase()))
    : lists

  if (authLoading) return null

  return (
    <div className="min-h-screen bg-[color:var(--color-bg-base)]">
      <div className="max-w-screen-xl mx-auto px-4 py-8">

        {/* ── Header ─────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-3xl font-bold text-primary mb-1"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              My Lists
            </h1>
            <p className="text-secondary text-sm">
              Organise cards into themed collections.
            </p>
          </div>
          <Button
            onClick={() => { setCreating(true); setCreateError(null) }}
            className="shrink-0"
          >
            + New List
          </Button>
        </div>

        {/* ── Inline create form ──────────────────── */}
        {creating && (
          <div className="mb-6 p-4 rounded-xl bg-surface border border-subtle flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-primary">Create a new list</h2>
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
              <Button
                onClick={handleCreate}
                disabled={!newName.trim() || createLoading}
                className="h-8 text-xs"
              >
                {createLoading ? 'Creating…' : 'Create List'}
              </Button>
              <button
                onClick={() => { setCreating(false); setNewName(''); setCreateError(null) }}
                className="h-8 px-3 text-xs text-muted hover:text-primary rounded-lg hover:bg-elevated transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Search ─────────────────────────────── */}
        {!loading && lists.length > 1 && (
          <div className="mb-6 max-w-sm">
            <Input
              placeholder="Search lists…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
          </div>
        )}

        {/* ── Loading ─────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-24 gap-3 text-muted">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">Loading lists…</span>
          </div>
        )}

        {/* ── Error ───────────────────────────────── */}
        {!loading && error && (
          <div className="text-center py-24">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* ── Empty state ─────────────────────────── */}
        {!loading && !error && lists.length === 0 && (
          <div className="text-center py-24">
            <p className="text-4xl mb-4">📋</p>
            <h2 className="text-xl font-semibold text-primary mb-2">No lists yet</h2>
            <p className="text-secondary text-sm mb-6">
              Create a list to start organising cards by theme, artist, or anything you like.
            </p>
            <Button onClick={() => setCreating(true)}>Create your first list</Button>
          </div>
        )}

        {/* ── Lists grid ──────────────────────────── */}
        {!loading && !error && filtered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(list => (
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
                        {' · '}
                        <span className={list.is_public ? 'text-green-400' : 'text-muted'}>
                          {list.is_public ? '🌐 Public' : '🔒 Private'}
                        </span>
                      </p>
                    </div>
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── No search match ──────────────────────── */}
        {!loading && !error && filtered.length === 0 && lists.length > 0 && (
          <div className="text-center py-20 text-muted text-sm">
            No lists match &quot;{search}&quot;
          </div>
        )}
      </div>
    </div>
  )
}
