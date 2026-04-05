'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { Variant } from '@/types'
import { SearchCard } from './CardSearch'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createCardSpecificVariant, deleteVariant } from '@/app/admin/variants/actions'

interface CardVariantEditorProps {
  selectedCard: SearchCard
  allVariants: Variant[]      // full global variant catalog
  onClose?: () => void
  onCardVariantCreated?: (variant: Variant) => void
}

const COLOR_HEX: Record<string, string> = {
  green:  '#10b981',
  blue:   '#3b82f6',
  purple: '#8b5cf6',
  red:    '#ef4444',
  pink:   '#ec4899',
  yellow: '#eab308',
  gray:   '#6b7280',
  orange: '#f97316',
  teal:   '#14b8a6',
}

const COLOR_OPTIONS = ['blue', 'green', 'purple', 'red', 'pink', 'yellow', 'gray', 'orange', 'teal'] as const

type ColorOption = typeof COLOR_OPTIONS[number]

const DEFAULT_FORM = {
  name: '',
  color: 'gray' as ColorOption,
  shortLabel: '',
  description: '',
  sortOrder: 0,
  makeDefault: false,
}

export function CardVariantEditor({
  selectedCard,
  allVariants,
  onClose,
  onCardVariantCreated,
}: CardVariantEditorProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasOverrides, setHasOverrides] = useState(false)
  /** variant IDs that are currently selected (either from DB overrides or computed defaults) */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  /** IDs that were loaded from DB — used to detect dirty state */
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  /** The variant used for double-click quick-add, read from cards.default_variant_id */
  const [defaultVariantId, setDefaultVariantId] = useState<string | null>(
    selectedCard.default_variant_id ?? null
  )
  const [savedDefaultVariantId, setSavedDefaultVariantId] = useState<string | null>(
    selectedCard.default_variant_id ?? null
  )

  // Card-specific variants state
  const [cardSpecificVariants, setCardSpecificVariants] = useState<Variant[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Add-variant inline form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState(DEFAULT_FORM)
  const [isCreating, startCreating] = useTransition()

  // sort_order editing state for existing card-specific variants
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null)

  // inline rename state for card-specific variants
  const [editingCsVariantId,          setEditingCsVariantId]          = useState<string | null>(null)
  const [editingCsVariantName,        setEditingCsVariantName]        = useState<string>('')
  const [editingCsVariantShortLabel,  setEditingCsVariantShortLabel]  = useState<string>('')
  const [editingCsVariantDescription, setEditingCsVariantDescription] = useState<string>('')
  const [savingRenameId,              setSavingRenameId]              = useState<string | null>(null)

  // global variant promotion state
  const [promotingGlobalId, setPromotingGlobalId] = useState<string | null>(null)

  // Variant image state — maps variantId → image URL. Read-only here; upload via Image Upload tool.
  const [variantImages, setVariantImages] = useState<Record<string, string | null>>({})

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const loadOverrides = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/card-variant-availability?cardId=${selectedCard.id}`)
      if (!res.ok) throw new Error('Failed to load variant configuration')
      const data: {
        variants: Variant[]
        hasOverrides: boolean
        cardSpecificVariants: Variant[]
      } = await res.json()

      // Card-specific variants section
      setCardSpecificVariants(data.cardSpecificVariants ?? [])

      // Global override toggles
      if (data.hasOverrides) {
        const ids = new Set(data.variants.map((v) => v.id))
        setSelectedIds(ids)
        setSavedIds(new Set(ids))
        setHasOverrides(true)
      } else {
        setSelectedIds(new Set())
        setSavedIds(new Set())
        setHasOverrides(false)
      }
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to load variant configuration')
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCard.id])

  useEffect(() => {
    loadOverrides()
  }, [loadOverrides])

  // Load existing variant images for this card so thumbnails render on mount.
  // Uses the variants API which now joins card_variant_images.
  const loadVariantImages = useCallback(async () => {
    try {
      const res = await fetch(`/api/variants?cardId=${selectedCard.id}`)
      if (!res.ok) return
      const variants: Array<{ id: string; variant_image_url?: string | null }> = await res.json()
      const imageMap: Record<string, string | null> = {}
      variants.forEach(v => { imageMap[v.id] = v.variant_image_url ?? null })
      setVariantImages(imageMap)
    } catch { /* non-critical */ }
  }, [selectedCard.id])

  useEffect(() => {
    loadVariantImages()
  }, [loadVariantImages])

  const toggleVariant = (variantId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(variantId)) {
        next.delete(variantId)
      } else {
        next.add(variantId)
      }
      return next
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/card-variant-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: selectedCard.id,
          variantIds: Array.from(selectedIds),
          defaultVariantId: defaultVariantId,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Save failed')
      }
      setSavedIds(new Set(selectedIds))
      setSavedDefaultVariantId(defaultVariantId)
      setHasOverrides(selectedIds.size > 0)
      showMessage('success', 'Variant configuration saved!')
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('Reset available variants to rarity-based defaults? The default variant setting is kept.')) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/card-variant-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: selectedCard.id, variantIds: [] }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Reset failed')
      }
      setSelectedIds(new Set())
      setSavedIds(new Set())
      setHasOverrides(false)
      showMessage('success', 'Reset to rarity-based defaults.')
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to reset')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteCardSpecific = async (variant: Variant) => {
    if (!confirm(`Delete card-specific variant "${variant.name}"? This cannot be undone.`)) return
    setDeletingId(variant.id)
    try {
      const result = await deleteVariant(variant.id)
      if (result.success) {
        setCardSpecificVariants((prev) => prev.filter((v) => v.id !== variant.id))
        showMessage('success', `"${variant.name}" deleted.`)
      } else {
        showMessage('error', result.error || 'Failed to delete variant')
      }
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to delete variant')
    } finally {
      setDeletingId(null)
    }
  }

  const handleRenameCardSpecific = async (variantId: string) => {
    const trimmedName  = editingCsVariantName.trim()
    const trimmedLabel = editingCsVariantShortLabel.trim()
    const trimmedDesc  = editingCsVariantDescription.trim()
    if (!trimmedName) return
    setSavingRenameId(variantId)
    try {
      const res = await fetch('/api/variants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:          variantId,
          name:        trimmedName,
          short_label: trimmedLabel || null,
          description: trimmedDesc  || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save variant')
      }
      setCardSpecificVariants((prev) =>
        prev.map((v) =>
          v.id === variantId
            ? { ...v, name: trimmedName, short_label: trimmedLabel || null, description: trimmedDesc || null }
            : v
        )
      )
      setEditingCsVariantId(null)
      setEditingCsVariantName('')
      setEditingCsVariantShortLabel('')
      setEditingCsVariantDescription('')
      showMessage('success', `"${trimmedName}" saved.`)
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to save variant')
    } finally {
      setSavingRenameId(null)
    }
  }

  const handlePromoteGlobal = async (variant: Variant) => {
    if (!confirm(
      `"${variant.name}" is a global variant shared across all cards.\n\n` +
      `Creating a card-specific copy lets you customize its short label for this card only, ` +
      `without affecting other cards.\n\n` +
      `Existing collection entries for this card will be migrated to the new copy. Continue?`
    )) return

    setPromotingGlobalId(variant.id)
    try {
      const res = await fetch('/api/admin/promote-global-to-card-specific', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: selectedCard.id, globalVariantId: variant.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Promotion failed')
      }
      const { variant: newVariant } = await res.json()

      // Add the new card-specific clone to the top section
      setCardSpecificVariants((prev) => [...prev, newVariant])
      // Deselect the global variant from availability toggles
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(variant.id)
        return next
      })
      setSavedIds((prev) => {
        const next = new Set(prev)
        next.delete(variant.id)
        return next
      })
      showMessage(
        'success',
        `"${variant.name}" is now a card-specific variant — edit its short label in the top section.`
      )
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to promote variant')
    } finally {
      setPromotingGlobalId(null)
    }
  }

  const handleCreateCardVariant = (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = addForm.name.trim()
    if (!trimmedName) {
      showMessage('error', 'Variant name is required')
      return
    }

    const formData = new FormData()
    formData.append('cardId', selectedCard.id)
    formData.append('name', trimmedName)
    formData.append('color', addForm.color)
    formData.append('shortLabel', addForm.shortLabel.trim())
    formData.append('description', addForm.description.trim())
    formData.append('sortOrder', addForm.sortOrder.toString())
    formData.append('makeDefault', addForm.makeDefault ? 'true' : 'false')

    startCreating(async () => {
      try {
        const result = await createCardSpecificVariant(formData)
        if (result.success && result.data) {
          setCardSpecificVariants((prev) => [...prev, result.data as Variant])
          onCardVariantCreated?.(result.data as Variant)
          // If the user opted to make this the quick-add default, sync state
          // immediately so the global-section radio button reflects it without
          // requiring a separate "Save Changes" click.
          if (result.madeDefault && result.data.id) {
            setDefaultVariantId(result.data.id)
            setSavedDefaultVariantId(result.data.id)
          }
          setAddForm(DEFAULT_FORM)
          setShowAddForm(false)
          showMessage('success', `Card-specific variant "${result.data.name}" created!`)
        } else {
          showMessage('error', result.error || 'Failed to create variant')
        }
      } catch (err: any) {
        showMessage('error', err.message || 'Failed to create variant')
      }
    })
  }

  // Detect unsaved changes in either availability toggles or default variant selection
  const isDirty =
    defaultVariantId !== savedDefaultVariantId ||
    selectedIds.size !== savedIds.size ||
    [...selectedIds].some((id) => !savedIds.has(id))

  const releaseYear = selectedCard.set.release_date
    ? new Date(selectedCard.set.release_date).getFullYear()
    : null

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      {/* Card header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className="w-20 h-28 bg-gray-700 rounded overflow-hidden flex-shrink-0">
            {selectedCard.image_url ? (
              <img
                src={selectedCard.image_url}
                alt={selectedCard.name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                No Image
              </div>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">{selectedCard.name}</h2>
            <div className="flex items-center space-x-2 text-gray-300 mb-2">
              <span className="font-mono">#{selectedCard.number}</span>
              {selectedCard.set.name && <><span>•</span><span>{selectedCard.set.name}</span></>}
              {selectedCard.rarity && (
                <><span>•</span><span className="text-yellow-400">{selectedCard.rarity}</span></>
              )}
            </div>
            <div className="text-sm text-gray-400 space-x-3">
              <span className="font-mono bg-gray-700 px-2 py-1 rounded text-xs">
                ID: {selectedCard.id}
              </span>
              {releaseYear && <span>Released: {releaseYear}</span>}
            </div>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </Button>
        )}
      </div>

      {/* Status badge */}
      <div className="mb-5">
        {isLoading ? (
          <span className="text-gray-400 text-sm">Loading configuration…</span>
        ) : hasOverrides ? (
          <span className="inline-flex items-center gap-1.5 bg-purple-900/50 border border-purple-500 text-purple-200 text-xs font-medium px-3 py-1 rounded-full">
            ✦ Custom override active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 bg-gray-700 text-gray-300 text-xs font-medium px-3 py-1 rounded-full">
            ⊙ Using rarity-based defaults
          </span>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded text-sm ${
          message.type === 'success'
            ? 'bg-green-900/50 border border-green-500 text-green-200'
            : 'bg-red-900/50 border border-red-500 text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-purple-600 border-t-transparent rounded-full mr-3" />
          <span className="text-gray-400">Loading…</span>
        </div>
      ) : (
        <>
          {/* ── Card-Specific Variants Section ─────────────────────────── */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                Card-Specific Variants
              </h3>
              <span className="text-xs text-gray-500">
                {cardSpecificVariants.length} variant{cardSpecificVariants.length !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              These variants are exclusive to this card and always shown to collectors.
            </p>

            {cardSpecificVariants.length === 0 ? (
              <div className="text-xs text-gray-600 italic py-2 px-3 bg-gray-900/40 rounded-lg border border-gray-700/50">
                No card-specific variants yet.
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {cardSpecificVariants.map((variant) => {
                  const isEditingName = editingCsVariantId === variant.id
                  return (
                    <div
                      key={variant.id}
                      className="rounded-lg bg-gray-700/60 border border-gray-600 overflow-hidden"
                    >
                      {isEditingName ? (
                        /* ── Edit mode ── */
                        <div className="flex flex-col gap-2 p-3">
                          {/* Row 1: colour dot + name */}
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: COLOR_HEX[variant.color] ?? '#6b7280' }}
                            />
                            <input
                              autoFocus
                              value={editingCsVariantName}
                              onChange={e => setEditingCsVariantName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  handleRenameCardSpecific(variant.id)
                                if (e.key === 'Escape') {
                                  setEditingCsVariantId(null)
                                  setEditingCsVariantName('')
                                  setEditingCsVariantShortLabel('')
                                  setEditingCsVariantDescription('')
                                }
                              }}
                              placeholder="Variant name"
                              className="flex-1 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-purple-400"
                            />
                          </div>
                          {/* Row 2: short label */}
                          <div className="flex items-center gap-2 pl-5">
                            <span className="text-xs text-gray-500 w-20 flex-shrink-0">Short label</span>
                            <input
                              value={editingCsVariantShortLabel}
                              onChange={e => setEditingCsVariantShortLabel(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  handleRenameCardSpecific(variant.id)
                                if (e.key === 'Escape') {
                                  setEditingCsVariantId(null)
                                  setEditingCsVariantName('')
                                  setEditingCsVariantShortLabel('')
                                  setEditingCsVariantDescription('')
                                }
                              }}
                              placeholder="e.g. 1st, SW"
                              maxLength={10}
                              className="w-28 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm font-mono focus:outline-none focus:border-purple-400"
                            />
                          </div>
                          {/* Row 3: description + save/cancel */}
                          <div className="flex items-center gap-2 pl-5">
                            <span className="text-xs text-gray-500 w-20 flex-shrink-0">Description</span>
                            <input
                              value={editingCsVariantDescription}
                              onChange={e => setEditingCsVariantDescription(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  handleRenameCardSpecific(variant.id)
                                if (e.key === 'Escape') {
                                  setEditingCsVariantId(null)
                                  setEditingCsVariantName('')
                                  setEditingCsVariantShortLabel('')
                                  setEditingCsVariantDescription('')
                                }
                              }}
                              placeholder="Optional short description"
                              className="flex-1 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-purple-400"
                            />
                            <button
                              onClick={() => handleRenameCardSpecific(variant.id)}
                              disabled={savingRenameId === variant.id}
                              className="text-green-400 hover:text-green-300 text-xs px-2 py-1 rounded transition-colors disabled:opacity-50"
                              title="Save"
                            >
                              {savingRenameId === variant.id ? '…' : '✓ Save'}
                            </button>
                            <button
                              onClick={() => {
                                setEditingCsVariantId(null)
                                setEditingCsVariantName('')
                                setEditingCsVariantShortLabel('')
                                setEditingCsVariantDescription('')
                              }}
                              className="text-gray-500 hover:text-gray-300 text-xs px-1.5 py-1 transition-colors"
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── Normal view ── */
                        <div className="flex items-center justify-between p-3">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: COLOR_HEX[variant.color] ?? '#6b7280' }}
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-white font-medium text-sm">{variant.name}</span>
                              {variant.short_label && (
                                <span className="ml-2 text-xs text-gray-400 font-mono bg-gray-700 px-1.5 py-0.5 rounded">
                                  {variant.short_label}
                                </span>
                              )}
                              {variant.description && (
                                <p className="text-gray-500 text-xs mt-0.5">{variant.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            {/* Edit name, short label & description */}
                            <button
                              onClick={() => {
                                setEditingCsVariantId(variant.id)
                                setEditingCsVariantName(variant.name)
                                setEditingCsVariantShortLabel(variant.short_label ?? '')
                                setEditingCsVariantDescription(variant.description ?? '')
                              }}
                              className="text-gray-500 hover:text-gray-300 text-xs p-1 rounded transition-colors"
                              title="Edit name, short label & description"
                            >
                              ✏️
                            </button>
                            {/* Sort order */}
                            <div className="flex items-center gap-1">
                              <label className="text-xs text-gray-500">Order</label>
                              <input
                                type="number"
                                defaultValue={variant.sort_order ?? 0}
                                disabled={savingOrderId === variant.id}
                                onBlur={async (e) => {
                                  const newOrder = parseInt(e.target.value || '0')
                                  if (newOrder === (variant.sort_order ?? 0)) return
                                  setSavingOrderId(variant.id)
                                  try {
                                    const res = await fetch('/api/variants', {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: variant.id, sort_order: newOrder }),
                                    })
                                    if (!res.ok) {
                                      const err = await res.json()
                                      showMessage('error', err.error || 'Failed to save sort order')
                                    } else {
                                      setCardSpecificVariants((prev) =>
                                        prev.map((v) =>
                                          v.id === variant.id ? { ...v, sort_order: newOrder } : v
                                        )
                                      )
                                    }
                                  } catch {
                                    showMessage('error', 'Failed to save sort order')
                                  } finally {
                                    setSavingOrderId(null)
                                  }
                                }}
                                className="w-16 px-1.5 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:border-purple-500 disabled:opacity-50"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              onClick={() => handleDeleteCardSpecific(variant)}
                              disabled={deletingId === variant.id}
                              size="sm"
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            >
                              {deletingId === variant.id ? '…' : 'Delete'}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* ── Variant hover image (read-only — upload via Image Upload tool) ── */}
                      {variantImages[variant.id] && (
                        <div className="border-t border-gray-700/60 px-3 py-1.5 bg-gray-800/20 flex items-center gap-2">
                          <img
                            src={variantImages[variant.id]!}
                            alt={`${variant.name} hover image`}
                            className="w-6 h-[33px] object-cover rounded border border-gray-600 flex-shrink-0"
                          />
                          <span className="text-[10px] text-gray-500">
                            🖼 Hover image set — manage in <em>Image Upload → Variant Images</em>
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add new card variant — toggle button + inline form */}
            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors py-1.5 px-3 rounded-lg border border-dashed border-purple-700/60 hover:border-purple-500 hover:bg-purple-900/10 w-full justify-center"
              >
                <span className="text-lg leading-none">+</span>
                Add new card variant
              </button>
            ) : (
              <div className="border border-purple-700/60 rounded-lg p-4 bg-gray-900/40 mt-2">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-purple-300">New Card-Specific Variant</h4>
                  <button
                    onClick={() => { setShowAddForm(false); setAddForm(DEFAULT_FORM) }}
                    className="text-gray-500 hover:text-gray-300 text-lg leading-none"
                    aria-label="Cancel"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateCardVariant} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Name <span className="text-red-400">*</span>
                      </label>
                      <Input
                        type="text"
                        value={addForm.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setAddForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                        placeholder="e.g. 1st Edition, Shadowless"
                        required
                      />
                    </div>

                    {/* Color */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Color</label>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0 border border-gray-600"
                          style={{ backgroundColor: COLOR_HEX[addForm.color] }}
                        />
                        <select
                          value={addForm.color}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                            setAddForm((prev) => ({ ...prev, color: e.target.value as ColorOption }))
                          }
                          className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                        >
                          {COLOR_OPTIONS.map((c) => (
                            <option key={c} value={c}>
                              {c.charAt(0).toUpperCase() + c.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Short Label */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Short Label</label>
                      <Input
                        type="text"
                        value={addForm.shortLabel}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setAddForm((prev) => ({ ...prev, shortLabel: e.target.value }))
                        }
                        placeholder="e.g. 1st, SW"
                        maxLength={10}
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                      <Input
                        type="text"
                        value={addForm.description}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setAddForm((prev) => ({ ...prev, description: e.target.value }))
                        }
                        placeholder="Optional short description"
                      />
                    </div>

                    {/* Sort Order */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Sort Order</label>
                      <Input
                        type="number"
                        value={addForm.sortOrder}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setAddForm((prev) => ({ ...prev, sortOrder: parseInt(e.target.value || '0') }))
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Make default quick-add */}
                  <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={addForm.makeDefault}
                      onChange={(e) =>
                        setAddForm((prev) => ({ ...prev, makeDefault: e.target.checked }))
                      }
                      className="w-4 h-4 accent-yellow-400 cursor-pointer flex-shrink-0"
                    />
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                      Make this the{' '}
                      <span className="text-yellow-400 font-medium">quick add default</span>
                      {' '}for this card
                    </span>
                  </label>

                  <div className="flex items-center gap-3 pt-1">
                    <Button
                      type="submit"
                      disabled={isCreating || !addForm.name.trim()}
                      className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                    >
                      {isCreating ? 'Creating…' : 'Create Card Variant'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setShowAddForm(false); setAddForm(DEFAULT_FORM) }}
                      className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700 mb-6" />

          {/* ── Global Variant Toggles ──────────────────────────────────── */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
              Global Variant Availability
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Toggle which global variants are available for collectors on this card.
              Unchecked variants will not appear on the set page.
            </p>

            {/* Column headers */}
            <div className="flex items-center justify-between px-3 pb-1 text-xs text-gray-500 font-medium uppercase tracking-wider">
              <span>Variant</span>
              <span title="The variant added to a user's collection when they double-click a card image on the set page">Quick Add (double-click)</span>
            </div>

            <div className="space-y-2">
              {allVariants
                .filter((v) => v.is_official)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((variant) => {
                  const checked = selectedIds.size === 0
                    ? true   // no overrides → all shown; checkboxes are advisory only until saved
                    : selectedIds.has(variant.id)
                  const isCurrentDefault = defaultVariantId === variant.id

                  return (
                    <div
                      key={variant.id}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        checked
                          ? 'bg-gray-700 border border-gray-600'
                          : 'bg-gray-900/40 border border-gray-700/50 opacity-60'
                      }`}
                    >
                      {/* Left: checkbox + colour dot + name */}
                      <label className="flex items-center space-x-3 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            // On first toggle we materialise the full selection from current state
                            if (selectedIds.size === 0) {
                              const all = new Set(
                                allVariants.filter(v => v.is_official).map(v => v.id)
                              )
                              all.delete(variant.id)
                              setSelectedIds(all)
                            } else {
                              toggleVariant(variant.id)
                            }
                          }}
                          className="w-4 h-4 accent-purple-500 cursor-pointer flex-shrink-0"
                        />
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: COLOR_HEX[variant.color] ?? '#6b7280' }}
                        />
                        <div className="min-w-0">
                          <span className="text-white font-medium text-sm">{variant.name}</span>
                          {variant.short_label && (
                            <span className="ml-2 text-xs text-gray-400 font-mono bg-gray-700 px-1.5 py-0.5 rounded">
                              {variant.short_label}
                            </span>
                          )}
                          {variant.description && (
                            <p className="text-gray-500 text-xs mt-0.5 truncate">{variant.description}</p>
                          )}
                        </div>
                      </label>

                      {/* Right: hover image indicator + customize + quick-add badge + default radio */}
                       <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                         {/* Hover image indicator (read-only — upload via Image Upload tool) */}
                         {checked && variantImages[variant.id] && (
                           <span className="text-green-500 text-xs" title="Hover image set — manage via Image Upload → Variant Images">🖼✓</span>
                         )}
                         {/* Customize short label for this card only (enabled variants only) */}
                        {checked && (
                          <button
                            onClick={() => handlePromoteGlobal(variant)}
                            disabled={promotingGlobalId === variant.id}
                            className="text-gray-500 hover:text-purple-300 text-xs px-2 py-0.5 rounded border border-gray-700 hover:border-purple-500 transition-colors disabled:opacity-40"
                            title="Customize short label for this card only — creates a card-specific copy"
                          >
                            {promotingGlobalId === variant.id ? '…' : '✂ Customize'}
                          </button>
                        )}
                        {variant.is_quick_add && (
                          <span className="text-blue-400 bg-blue-900/30 text-xs px-2 py-0.5 rounded-full">
                            quick add
                          </span>
                        )}
                        <label
                          className="flex items-center gap-1.5 cursor-pointer"
                          title="Set as default quick-add variant for this card"
                        >
                          <input
                            type="radio"
                            name={`default-variant-${selectedCard.id}`}
                            checked={isCurrentDefault}
                            onChange={() => setDefaultVariantId(variant.id)}
                            className="w-4 h-4 accent-yellow-400 cursor-pointer"
                          />
                          {isCurrentDefault && (
                            <span className="text-yellow-400 text-xs font-medium">default</span>
                          )}
                        </label>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={handleSave}
              disabled={isSaving || (!isDirty && hasOverrides)}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : isDirty ? 'Save Changes' : 'Saved'}
            </Button>

            {hasOverrides && (
              <Button
                variant="ghost"
                onClick={handleReset}
                disabled={isSaving}
                className="text-gray-400 hover:text-red-300 hover:bg-red-900/20"
              >
                Reset to Defaults
              </Button>
            )}

            {isDirty && !hasOverrides && (
              <span className="text-yellow-400 text-xs">
                ⚠ Saving will create a custom override for this card
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
