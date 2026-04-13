'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore, useCollectionStore } from '@/lib/store'
import CardGrid from '@/components/CardGrid'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { UserCardList, PokemonCard } from '@/types'
import { cn } from '@/lib/utils'

export default function ListDetailPage() {
  const params   = useParams()
  const listId   = params.listId as string
  const router   = useRouter()
  const { user } = useAuthStore()
  const { userCards } = useCollectionStore()

  const [list, setList]     = useState<UserCardList | null>(null)
  const [cards, setCards]   = useState<PokemonCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Editing state (owner only)
  const [editing, setEditing]         = useState(false)
  const [editName, setEditName]       = useState('')
  const [editDesc, setEditDesc]       = useState('')
  const [editPublic, setEditPublic]   = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)

  // Fetch list + cards
  useEffect(() => {
    if (!listId) return
    setLoading(true)
    fetch(`/api/user-lists/${listId}/cards`)
      .then(res => {
        if (res.status === 403) throw new Error('forbidden')
        if (res.status === 404) throw new Error('notfound')
        if (!res.ok) throw new Error('error')
        return res.json()
      })
      .then(data => {
        setList(data.list)
        setCards(data.cards ?? [])
        setEditName(data.list.name)
        setEditDesc(data.list.description ?? '')
        setEditPublic(data.list.is_public)
      })
      .catch(e => {
        if (e.message === 'forbidden') setError('This list is private.')
        else if (e.message === 'notfound') setError('List not found.')
        else setError('Could not load this list.')
      })
      .finally(() => setLoading(false))
  }, [listId])

  const isOwner = !!(user && list && user.id === list.user_id)

  async function handleSave() {
    setSaveLoading(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/user-lists/${listId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || null,
          is_public: editPublic,
        }),
      })
      if (!res.ok) throw new Error()
      const { list: updated } = await res.json()
      setList(updated)
      setEditing(false)
    } catch {
      setSaveError('Could not save changes.')
    } finally {
      setSaveLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this list permanently? This cannot be undone.')) return
    const res = await fetch(`/api/user-lists/${listId}`, { method: 'DELETE' })
    if (res.ok) router.push('/lists')
  }

  const filtered = search.trim()
    ? cards.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.number?.toLowerCase().includes(search.toLowerCase()),
      )
    : cards

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen gap-3 text-muted">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-sm">Loading list…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-secondary text-sm">{error}</p>
        <Link href="/lists" className="text-accent text-sm hover:underline">← Back to My Lists</Link>
      </div>
    )
  }

  if (!list) return null

  return (
    <div className="min-h-screen bg-[color:var(--color-bg-base)]">
      <div className="max-w-screen-2xl mx-auto px-4 py-8">

        {/* ── Breadcrumb ──────────────────────────── */}
        <div className="mb-6">
          <Link href="/lists" className="text-sm text-muted hover:text-accent transition-colors flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            My Lists
          </Link>
        </div>

        {/* ── Header ─────────────────────────────── */}
        {editing ? (
          <div className="mb-8 p-5 rounded-xl bg-surface border border-subtle flex flex-col gap-4 max-w-lg">
            <h2 className="text-sm font-semibold text-primary">Edit List</h2>
            <div className="flex flex-col gap-3">
              <input
                autoFocus
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                maxLength={80}
                placeholder="List name"
                className={cn(
                  'w-full h-9 bg-elevated border border-subtle rounded-lg px-3 text-sm text-primary',
                  'placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30',
                )}
              />
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                maxLength={280}
                rows={2}
                placeholder="Description (optional)"
                className={cn(
                  'w-full bg-elevated border border-subtle rounded-lg px-3 py-2 text-sm text-primary resize-none',
                  'placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30',
                )}
              />
              {/* Visibility toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setEditPublic(v => !v)}
                  className={cn(
                    'relative w-10 h-5 rounded-full transition-colors',
                    editPublic ? 'bg-accent' : 'bg-subtle',
                  )}
                >
                  <div className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    editPublic ? 'translate-x-5' : 'translate-x-0.5',
                  )} />
                </div>
                <span className="text-sm text-primary">
                  {editPublic ? '🌐 Public — anyone with the link can view' : '🔒 Private — only you can see this list'}
                </span>
              </label>
            </div>
            {saveError && <p className="text-xs text-red-400">{saveError}</p>}
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!editName.trim() || saveLoading} className="h-8 text-xs">
                {saveLoading ? 'Saving…' : 'Save changes'}
              </Button>
              <button
                onClick={() => { setEditing(false); setSaveError(null) }}
                className="h-8 px-3 text-xs text-muted hover:text-primary rounded-lg hover:bg-elevated transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h1
                  className="text-3xl font-bold text-primary"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {list.name}
                </h1>
                <span className={cn(
                  'pill text-xs font-medium px-2 py-0.5 rounded-full',
                  list.is_public
                    ? 'bg-green-500/15 text-green-400'
                    : 'bg-subtle text-muted',
                )}>
                  {list.is_public ? '🌐 Public' : '🔒 Private'}
                </span>
              </div>
              {list.description && (
                <p className="text-secondary text-sm">{list.description}</p>
              )}
              <p className="text-muted text-xs mt-1">{cards.length} card{cards.length !== 1 ? 's' : ''}</p>
            </div>

            {isOwner && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setEditing(true)}
                  className="h-8 px-3 text-xs text-secondary hover:text-primary border border-subtle rounded-lg hover:bg-elevated transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="h-8 px-3 text-xs text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Search ─────────────────────────────── */}
        {cards.length > 4 && (
          <div className="mb-6 max-w-sm">
            <Input
              placeholder="Search cards in this list…"
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

        {/* ── Empty states ───────────────────────── */}
        {cards.length === 0 && (
          <div className="text-center py-24">
            <p className="text-4xl mb-4">📋</p>
            <h2 className="text-xl font-semibold text-primary mb-2">This list is empty</h2>
            {isOwner && (
              <p className="text-secondary text-sm">
                Open any card modal and click the ★ star to add cards to this list.
              </p>
            )}
          </div>
        )}

        {cards.length > 0 && filtered.length === 0 && (
          <div className="text-center py-20 text-muted text-sm">
            No cards match &quot;{search}&quot;
          </div>
        )}

        {/* ── Card grid ──────────────────────────── */}
        {filtered.length > 0 && (
          <CardGrid
            cards={filtered}
            userCards={userCards}
            setTotal={filtered.length}
            disableGreyOut
          />
        )}
      </div>
    </div>
  )
}
