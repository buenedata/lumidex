'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { UserCardList } from '@/types'

interface AddToListDropdownProps {
  cardId: string
  /** Whether this card is currently in the wanted list */
  isWanted: boolean
  /** Whether the wanted toggle is mid-flight */
  wantedLoading: boolean
  onToggleWanted: () => void
  /**
   * Called whenever this card's list membership changes so the parent
   * (CardGrid) can update the star icon's filled state.
   * `isInAnyList` is true if the card now belongs to at least one list.
   */
  onListMembershipChange: (cardId: string, isInAnyList: boolean) => void
}

export default function AddToListDropdown({
  cardId,
  isWanted,
  wantedLoading,
  onToggleWanted,
  onListMembershipChange,
}: AddToListDropdownProps) {
  const [isOpen, setIsOpen]             = useState(false)
  const [lists, setLists]               = useState<UserCardList[]>([])
  const [memberListIds, setMemberListIds] = useState<Set<string>>(new Set())
  const [loading, setLoading]           = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null) // listId being toggled
  const [creating, setCreating]         = useState(false)
  const [newListName, setNewListName]   = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError]   = useState<string | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    function onMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [isOpen])

  // When "create" input appears, focus it
  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  // Fetch lists + membership for this card when the dropdown opens
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [listsRes, memberRes] = await Promise.all([
        fetch('/api/user-lists'),
        fetch(`/api/user-lists/card/${cardId}`),
      ])
      if (listsRes.ok) {
        const json = await listsRes.json()
        setLists(json.lists ?? [])
      }
      if (memberRes.ok) {
        const json = await memberRes.json()
        setMemberListIds(new Set(json.listIds ?? []))
      }
    } catch { /* non-critical */ }
    finally { setLoading(false) }
  }, [cardId])

  function handleOpen() {
    setIsOpen(prev => {
      if (!prev) fetchData()
      return !prev
    })
  }

  // Toggle card membership in a custom list
  async function handleListToggle(listId: string) {
    if (actionLoading) return
    const isCurrentlyMember = memberListIds.has(listId)
    // Optimistic update
    setMemberListIds(prev => {
      const next = new Set(prev)
      if (isCurrentlyMember) { next.delete(listId) } else { next.add(listId) }
      return next
    })
    setActionLoading(listId)
    try {
      const res = await fetch(`/api/user-lists/${listId}/cards`, {
        method: isCurrentlyMember ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId }),
      })
      if (!res.ok) throw new Error('Failed')
      // Notify parent — compute new set from the current optimistic state
      const newSet = new Set(memberListIds)
      if (isCurrentlyMember) { newSet.delete(listId) } else { newSet.add(listId) }
      onListMembershipChange(cardId, newSet.size > 0)
    } catch {
      // Revert optimistic update
      setMemberListIds(prev => {
        const next = new Set(prev)
        if (isCurrentlyMember) { next.add(listId) } else { next.delete(listId) }
        return next
      })
    } finally {
      setActionLoading(null)
    }
  }

  // Create a new list and immediately add the card to it
  async function handleCreateList() {
    const name = newListName.trim()
    if (!name) return
    setCreateLoading(true)
    setCreateError(null)
    try {
      // 1. Create the list
      const createRes = await fetch('/api/user-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!createRes.ok) throw new Error('Failed to create list')
      const { list } = await createRes.json()

      // 2. Add the card to the new list
      await fetch(`/api/user-lists/${list.id}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId }),
      })

      // Update local state
      setLists(prev => [...prev, list])
      setMemberListIds(prev => {
        const next = new Set(prev)
        next.add(list.id)
        return next
      })
      onListMembershipChange(cardId, true)
      setNewListName('')
      setCreating(false)
    } catch {
      setCreateError('Could not create list. Try again.')
    } finally {
      setCreateLoading(false)
    }
  }

  // Star appearance: filled if wanted OR in any list
  const isStarFilled = isWanted || memberListIds.size > 0

  return (
    <div ref={dropdownRef} className="relative">
      {/* ── Star button ─────────────────────────────── */}
      <button
        onClick={handleOpen}
        title="Add to wanted list or custom list"
        className={cn(
          'p-2 transition-colors',
          (wantedLoading || actionLoading) && 'opacity-40 cursor-not-allowed',
        )}
        disabled={!!(wantedLoading && !isOpen)}
      >
        {isStarFilled
          ? <span className="text-2xl leading-none text-yellow-400">★</span>
          : <span className="text-2xl leading-none text-muted hover:text-yellow-400 transition-colors">☆</span>
        }
      </button>

      {/* ── Dropdown panel ──────────────────────────── */}
      {isOpen && (
        <div className={cn(
          'absolute right-0 top-full mt-1 z-50 min-w-[220px] max-w-xs',
          'bg-surface border border-subtle rounded-xl shadow-2xl overflow-hidden',
        )}>
          {loading ? (
            <div className="py-6 flex items-center justify-center">
              <svg className="w-5 h-5 animate-spin text-muted" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          ) : (
            <>
              {/* ── Wanted list row ─────────────────────── */}
              <button
                onClick={() => { onToggleWanted(); }}
                disabled={wantedLoading}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-sm text-left',
                  'hover:bg-elevated transition-colors disabled:opacity-50',
                )}
              >
                <span className={cn(
                  'text-lg leading-none shrink-0',
                  isWanted ? 'text-yellow-400' : 'text-muted',
                )}>
                  {isWanted ? '★' : '☆'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-primary">Wanted List</div>
                  <div className="text-xs text-muted truncate">
                    {isWanted ? 'Remove from wanted list' : 'Add to wanted list'}
                  </div>
                </div>
                {wantedLoading && (
                  <svg className="w-3.5 h-3.5 animate-spin text-muted shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
              </button>

              {/* ── Custom lists ────────────────────────── */}
              {lists.length > 0 && (
                <>
                  <div className="h-px bg-subtle mx-3" />
                  <div className="px-3 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      My Lists
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {lists.map(list => {
                      const isMember = memberListIds.has(list.id)
                      const isTogglingThis = actionLoading === list.id
                      return (
                        <button
                          key={list.id}
                          onClick={() => handleListToggle(list.id)}
                          disabled={!!actionLoading}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left',
                            'hover:bg-elevated transition-colors disabled:opacity-60',
                          )}
                        >
                          {/* Checkmark or hollow circle */}
                          <span className={cn(
                            'w-4 h-4 rounded flex items-center justify-center shrink-0 border text-[10px]',
                            isMember
                              ? 'bg-accent border-accent text-white'
                              : 'border-subtle',
                          )}>
                            {isMember && (
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          <span className="flex-1 min-w-0 truncate text-primary">{list.name}</span>
                          {isTogglingThis && (
                            <svg className="w-3.5 h-3.5 animate-spin text-muted shrink-0" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                          )}
                          {/* Show public/private indicator */}
                          {!list.is_public && (
                            <span className="text-[10px] text-muted shrink-0">🔒</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {/* ── Create new list ─────────────────────── */}
              <div className="h-px bg-subtle mx-3" />
              {creating ? (
                <div className="px-3 py-2.5 flex flex-col gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newListName}
                    onChange={e => setNewListName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleCreateList()
                      if (e.key === 'Escape') { setCreating(false); setNewListName('') }
                    }}
                    placeholder="List name…"
                    maxLength={80}
                    className={cn(
                      'w-full h-8 bg-elevated border border-subtle rounded-lg px-2.5 text-sm text-primary',
                      'placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30',
                    )}
                  />
                  {createError && (
                    <p className="text-xs text-red-400">{createError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateList}
                      disabled={!newListName.trim() || createLoading}
                      className="flex-1 h-7 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-light transition-colors disabled:opacity-50"
                    >
                      {createLoading ? 'Creating…' : 'Create'}
                    </button>
                    <button
                      onClick={() => { setCreating(false); setNewListName(''); setCreateError(null) }}
                      className="h-7 px-3 text-xs text-muted hover:text-primary rounded-lg hover:bg-elevated transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-secondary hover:text-primary hover:bg-elevated transition-colors"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create new list</span>
                </button>
              )}

              {/* ── Manage lists link ───────────────────── */}
              <div className="h-px bg-subtle mx-3" />
              <Link
                href="/lists"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between px-4 py-2.5 text-sm text-secondary hover:text-accent hover:bg-elevated transition-colors"
              >
                <span>Manage lists</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
