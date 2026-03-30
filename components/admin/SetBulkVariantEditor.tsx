'use client'

import { useState, useEffect, useTransition } from 'react'
import { Variant } from '@/types'
import { SetSelector } from './SetSelector'
import { Button } from '@/components/ui/Button'
import { CardVariantEditor } from './CardVariantEditor'
import { SearchCard } from './CardSearch'

// Shape returned by GET /api/cards/[setId]
interface SetCard {
  id: string
  set_id: string
  name: string
  image: string | null
  number: string
  rarity: string
}

interface CardVariantState {
  variants: Variant[]
  hasOverrides: boolean
}

type ColorOption = 'blue' | 'green' | 'purple' | 'red' | 'pink' | 'yellow' | 'gray' | 'orange' | 'teal'

const DEFAULT_ADD_FORM = { name: '', color: 'gray' as ColorOption, shortLabel: '', description: '', sortOrder: 0 }

interface SetBulkVariantEditorProps {
  /** The full catalogue of official global variants (passed from VariantManager) */
  allVariants: Variant[]
  /** Called when a new variant is created here, so the parent can update its list */
  onVariantCreated?: (variant: Variant) => void
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

export function SetBulkVariantEditor({ allVariants, onVariantCreated }: SetBulkVariantEditorProps) {
  // ─── Set selection ────────────────────────────────────────────────────────
  const [selectedSetId,   setSelectedSetId]   = useState<string | null>(null)
  const [selectedSetName, setSelectedSetName] = useState<string>('')
  const [setPickerOpen,   setSetPickerOpen]   = useState(true)

  // ─── Card list state ──────────────────────────────────────────────────────
  const [setCards,        setSetCards]        = useState<SetCard[]>([])
  const [cardVariantMap,  setCardVariantMap]  = useState<Record<string, CardVariantState>>({})
  const [isLoadingCards,  setIsLoadingCards]  = useState(false)
  const [rarityFilter,    setRarityFilter]    = useState<string>('all')
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set())

  // ─── Inline per-card editor state ────────────────────────────────────────
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)

  // ─── Bulk variant config state ────────────────────────────────────────────
  // undefined = don't change • null = clear the default • 'uuid' = set to this variant
  const [bulkVariantIds,       setBulkVariantIds]       = useState<Set<string>>(new Set())
  const [bulkDefaultVariantId, setBulkDefaultVariantId] = useState<string | null | undefined>(undefined)
  const [isSaving,             setIsSaving]             = useState(false)

  // ─── Set-specific variant creation ───────────────────────────────────────
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm,     setAddForm]     = useState(DEFAULT_ADD_FORM)
  const [isCreating,  setIsCreating]  = useState(false)

  // ─── Message ──────────────────────────────────────────────────────────────
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  // ─── Load cards + variant map when set changes ───────────────────────────
  useEffect(() => {
    if (!selectedSetId) {
      setSetCards([])
      setCardVariantMap({})
      setSelectedCardIds(new Set())
      setExpandedCardId(null)
      return
    }
    loadSetData(selectedSetId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSetId])

  const loadSetData = async (setId: string) => {
    setIsLoadingCards(true)
    setSetCards([])
    setCardVariantMap({})
    setSelectedCardIds(new Set())
    setExpandedCardId(null)

    try {
      const [cardsRes, variantsRes] = await Promise.all([
        fetch(`/api/cards/${setId}`),
        fetch(`/api/card-variant-availability?setId=${setId}`),
      ])

      if (!cardsRes.ok)    throw new Error('Failed to load cards for this set')
      if (!variantsRes.ok) throw new Error('Failed to load variant data for this set')

      const cards: SetCard[] = await cardsRes.json()
      const variantsData: { byCard: Record<string, CardVariantState> } = await variantsRes.json()

      setSetCards(Array.isArray(cards) ? cards : [])
      setCardVariantMap(variantsData.byCard ?? {})
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to load set data')
    } finally {
      setIsLoadingCards(false)
    }
  }

  const refreshVariantMap = async () => {
    if (!selectedSetId) return
    try {
      const res = await fetch(`/api/card-variant-availability?setId=${selectedSetId}`)
      if (res.ok) {
        const data: { byCard: Record<string, CardVariantState> } = await res.json()
        setCardVariantMap(data.byCard ?? {})
      }
    } catch { /* silent */ }
  }

  // ─── Set selection handler ────────────────────────────────────────────────
  const handleSetSelect = (setId: string, setName: string) => {
    setSelectedSetId(setId)
    setSelectedSetName(setName)
    setSetPickerOpen(false)
    setBulkVariantIds(new Set())
    setBulkDefaultVariantId(undefined)
  }

  // ─── Card list helpers ────────────────────────────────────────────────────
  const allRarities = Array.from(new Set(setCards.map(c => c.rarity).filter(Boolean))).sort()

  const filteredCards = rarityFilter === 'all'
    ? setCards
    : setCards.filter(c => c.rarity === rarityFilter)

  const selectAll  = () => setSelectedCardIds(new Set(filteredCards.map(c => c.id)))
  const selectNone = () => setSelectedCardIds(new Set())

  const toggleCard = (cardId: string) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }

  // ─── Bulk variant toggle ──────────────────────────────────────────────────
  const toggleBulkVariant = (variantId: string) => {
    setBulkVariantIds(prev => {
      const next = new Set(prev)
      if (next.has(variantId)) next.delete(variantId)
      else next.add(variantId)
      return next
    })
  }

  // ─── Bulk apply ──────────────────────────────────────────────────────────
  const handleBulkApply = async () => {
    if (selectedCardIds.size === 0) {
      showMessage('error', 'Select at least one card first.')
      return
    }

    const variantLabel =
      bulkVariantIds.size > 0
        ? `${bulkVariantIds.size} variant${bulkVariantIds.size === 1 ? '' : 's'} selected`
        : 'none (reverts selected cards to rarity-based defaults)'

    const confirmed = confirm(
      `Apply variant configuration to ${selectedCardIds.size} card${selectedCardIds.size === 1 ? '' : 's'}?\n\n` +
      `Variants: ${variantLabel}\n\n` +
      `This will replace any existing overrides on the selected cards.`
    )
    if (!confirmed) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/card-variant-availability/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardIds:          Array.from(selectedCardIds),
          variantIds:       Array.from(bulkVariantIds),
          defaultVariantId: bulkDefaultVariantId,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Bulk save failed')
      }

      const result = await res.json()
      showMessage(
        'success',
        `✅ Updated ${result.updatedCount} card${result.updatedCount === 1 ? '' : 's'} successfully!`
      )
      await refreshVariantMap()
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to apply variant configuration')
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Create a card-specific variant for each targeted card ───────────────
  // Card-specific variants share the same name across many cards (e.g. "Holiday Stamp")
  // without the global uniqueness constraint. The target is the selected cards, or
  // all cards in the set if none are selected.
  const handleCreateSetVariant = async () => {
    const trimmedName = addForm.name.trim()
    if (!trimmedName) return

    const targetIds =
      selectedCardIds.size > 0
        ? Array.from(selectedCardIds)
        : setCards.map(c => c.id)

    if (targetIds.length === 0) {
      showMessage('error', 'No cards to apply to — load a set first.')
      return
    }

    setIsCreating(true)
    try {
      const res = await fetch('/api/card-variant-availability/bulk-create-card-specific', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardIds:     targetIds,
          name:        trimmedName,
          color:       addForm.color,
          shortLabel:  addForm.shortLabel.trim(),
          description: addForm.description.trim(),
          sortOrder:   addForm.sortOrder,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create card-specific variants')
      }

      const result = await res.json()
      setShowAddForm(false)
      setAddForm(DEFAULT_ADD_FORM)
      showMessage(
        'success',
        `✅ "${trimmedName}" created on ${result.createdCount} card${result.createdCount === 1 ? '' : 's'}!`
      )
      await refreshVariantMap()
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to create card-specific variants')
    } finally {
      setIsCreating(false)
    }
  }

  // ─── Build a SearchCard-compatible object for CardVariantEditor ───────────
  const toSearchCard = (card: SetCard): SearchCard => ({
    id:                 card.id,
    name:               card.name,
    number:             card.number,
    image_url:          card.image ?? '',
    rarity:             card.rarity ?? null,
    default_variant_id: null,
    set: {
      id:           card.set_id,
      name:         selectedSetName,
      series:       '',
      release_date: '',
    },
  })

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Set picker ────────────────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            {selectedSetId ? (
              <>
                <span className="text-yellow-400">📦 {selectedSetName}</span>
                <span className="text-gray-400 text-sm font-normal ml-2">
                  ({setCards.length} cards)
                </span>
              </>
            ) : (
              'Select a Set'
            )}
          </h2>
          {selectedSetId && (
            <button
              onClick={() => setSetPickerOpen(v => !v)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {setPickerOpen ? '▲ Hide picker' : '▼ Change set'}
            </button>
          )}
        </div>

        {(!selectedSetId || setPickerOpen) && (
          <SetSelector
            onSetSelect={handleSetSelect}
            selectedSetId={selectedSetId}
          />
        )}
      </div>

      {/* ── Message ───────────────────────────────────────────────────── */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-900/50 border border-green-500 text-green-200'
            : 'bg-red-900/50 border border-red-500 text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* ── Main content (only shown once a set is selected) ──────────── */}
      {selectedSetId && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Card list (left, 3 cols) ─────────────────────────────── */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">

              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="text-white font-semibold text-sm">
                  {selectedCardIds.size} / {filteredCards.length} selected
                </span>
                <button
                  onClick={selectAll}
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Select all
                </button>
                <button
                  onClick={selectNone}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Deselect all
                </button>

                {/* Rarity filter */}
                <select
                  value={rarityFilter}
                  onChange={e => { setRarityFilter(e.target.value); setSelectedCardIds(new Set()) }}
                  className="ml-auto text-xs bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All rarities</option>
                  {allRarities.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Card rows */}
              {isLoadingCards ? (
                <div className="text-gray-400 text-center py-10">Loading cards…</div>
              ) : filteredCards.length === 0 ? (
                <div className="text-gray-400 text-center py-10">No cards found.</div>
              ) : (
                <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
                  {filteredCards.map(card => {
                    const state      = cardVariantMap[card.id]
                    const isSelected = selectedCardIds.has(card.id)
                    const isExpanded = expandedCardId === card.id

                    return (
                      <div key={card.id}>
                        {/* Row */}
                        <div
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer select-none ${
                            isSelected
                              ? 'bg-purple-900/40 border border-purple-600'
                              : 'bg-gray-700 hover:bg-gray-650 border border-transparent'
                          }`}
                          onClick={() => toggleCard(card.id)}
                        >
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCard(card.id)}
                            onClick={e => e.stopPropagation()}
                            className="w-4 h-4 accent-purple-500 flex-shrink-0"
                          />

                          {/* Thumbnail */}
                          <div className="w-8 h-11 bg-gray-600 rounded overflow-hidden flex-shrink-0">
                            {card.image ? (
                              <img
                                src={card.image}
                                alt={card.name}
                                className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">?</div>
                            )}
                          </div>

                          {/* Name + number */}
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-sm font-medium truncate">{card.name}</div>
                            <div className="text-gray-500 text-xs">
                              #{card.number}
                              {card.rarity && <span className="ml-2 text-gray-600">{card.rarity}</span>}
                            </div>
                          </div>

                          {/* Override badge */}
                          <div className="flex-shrink-0 flex items-center gap-2">
                            {state?.hasOverrides ? (
                              <span className="text-xs bg-blue-900/60 text-blue-300 border border-blue-700 rounded px-1.5 py-0.5">
                                {state.variants.length}v override
                              </span>
                            ) : (
                              <span className="text-xs text-gray-600">— default</span>
                            )}

                            {/* Expand button */}
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                setExpandedCardId(prev => prev === card.id ? null : card.id)
                              }}
                              className="text-xs text-gray-500 hover:text-white transition-colors ml-1"
                              title="Edit this card's variants individually"
                            >
                              {isExpanded ? '▲' : '✏️'}
                            </button>
                          </div>
                        </div>

                        {/* Inline per-card editor */}
                        {isExpanded && (
                          <div className="mt-2 mb-2">
                            <CardVariantEditor
                              selectedCard={toSearchCard(card)}
                              allVariants={allVariants}
                              onClose={() => setExpandedCardId(null)}
                              onCardVariantCreated={() => refreshVariantMap()}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Variant config panel (right, 2 cols) ─────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-gray-800 rounded-lg p-6 sticky top-4">
              <h3 className="text-lg font-bold text-white mb-1">Bulk Variant Config</h3>
              <p className="text-gray-400 text-sm mb-5">
                Toggle variants then apply to all selected cards. Replaces existing overrides.
              </p>

              {allVariants.length === 0 ? (
                <p className="text-gray-500 text-sm">No global variants defined yet.</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {allVariants.map(variant => {
                    const isActive = bulkVariantIds.has(variant.id)
                    const hex = COLOR_HEX[variant.color] ?? COLOR_HEX.gray
                    return (
                      <button
                        key={variant.id}
                        onClick={() => toggleBulkVariant(variant.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all ${
                          isActive
                            ? 'border-opacity-80 bg-opacity-20'
                            : 'border-gray-600 bg-gray-700 hover:bg-gray-650'
                        }`}
                        style={isActive ? {
                          borderColor: hex,
                          backgroundColor: `${hex}22`,
                        } : {}}
                      >
                        {/* Color dot */}
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: isActive ? hex : '#4b5563' }}
                        />
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-400'}`}>
                            {variant.name}
                          </span>
                          {variant.short_label && (
                            <span className="ml-2 text-xs text-gray-500">[{variant.short_label}]</span>
                          )}
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isActive ? 'border-white bg-white' : 'border-gray-500'
                        }`}>
                          {isActive && <div className="w-2 h-2 rounded-full bg-gray-900" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Add set-specific variant button / inline form */}
              {!showAddForm ? (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 mb-4 rounded-lg border border-dashed border-gray-600 text-gray-400 hover:border-purple-500 hover:text-purple-400 text-sm transition-colors"
                >
                  ➕ Add set specific variant
                </button>
              ) : (
                <div className="bg-gray-700 rounded-lg p-4 mb-4 space-y-3">
                  <div>
                    <h4 className="text-white text-sm font-semibold">New Card-Specific Variant</h4>
                    <p className="text-gray-400 text-xs mt-0.5">
                      Will be created on{' '}
                      <span className="text-purple-300 font-medium">
                        {selectedCardIds.size > 0
                          ? `${selectedCardIds.size} selected card${selectedCardIds.size === 1 ? '' : 's'}`
                          : `all ${setCards.length} cards in the set`}
                      </span>
                      . Same name allowed across multiple sets.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Name *</label>
                    <input
                      type="text"
                      value={addForm.name}
                      onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleCreateSetVariant()}
                      placeholder="e.g., 1st Edition, Reverse Holo"
                      autoFocus
                      className="w-full px-2 py-1.5 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Color</label>
                      <select
                        value={addForm.color}
                        onChange={e => setAddForm(prev => ({ ...prev, color: e.target.value as ColorOption }))}
                        className="w-full px-2 py-1.5 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none"
                      >
                        <option value="blue">Blue</option>
                        <option value="green">Green</option>
                        <option value="purple">Purple</option>
                        <option value="red">Red</option>
                        <option value="pink">Pink</option>
                        <option value="yellow">Yellow</option>
                        <option value="gray">Gray</option>
                        <option value="orange">Orange</option>
                        <option value="teal">Teal</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Short Label</label>
                      <input
                        type="text"
                        value={addForm.shortLabel}
                        onChange={e => setAddForm(prev => ({ ...prev, shortLabel: e.target.value }))}
                        placeholder="e.g., 1st"
                        maxLength={8}
                        className="w-full px-2 py-1.5 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Description</label>
                    <textarea
                      value={addForm.description}
                      onChange={e => setAddForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Optional description of this variant"
                      rows={2}
                      className="w-full px-2 py-1.5 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:border-purple-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Sort Order</label>
                    <input
                      type="number"
                      value={addForm.sortOrder}
                      onChange={e => setAddForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value || '0') }))}
                      placeholder="0"
                      className="w-full px-2 py-1.5 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateSetVariant}
                      disabled={isCreating || !addForm.name.trim()}
                      className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded transition-colors"
                    >
                      {isCreating ? 'Creating…' : 'Create & Add'}
                    </button>
                    <button
                      onClick={() => { setShowAddForm(false); setAddForm(DEFAULT_ADD_FORM) }}
                      className="flex-1 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Default variant picker */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Default Variant
                  <span className="text-gray-500 font-normal ml-1">(optional)</span>
                </label>
                <select
                  value={
                    bulkDefaultVariantId === undefined ? ''
                    : bulkDefaultVariantId === null    ? '__clear'
                    : bulkDefaultVariantId
                  }
                  onChange={e => {
                    const val = e.target.value
                    if      (val === '')        setBulkDefaultVariantId(undefined)
                    else if (val === '__clear') setBulkDefaultVariantId(null)
                    else                        setBulkDefaultVariantId(val)
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="">— don't change —</option>
                  <option value="__clear">Clear (no default)</option>
                  {allVariants.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              {/* Selection summary */}
              <div className="rounded-lg bg-gray-700/50 border border-gray-600 px-4 py-3 mb-4 text-sm">
                <div className="flex justify-between text-gray-300">
                  <span>Cards selected</span>
                  <span className="font-semibold text-white">{selectedCardIds.size}</span>
                </div>
                <div className="flex justify-between text-gray-300 mt-1">
                  <span>Variants to apply</span>
                  <span className="font-semibold text-white">
                    {bulkVariantIds.size > 0 ? bulkVariantIds.size : 'none (clears overrides)'}
                  </span>
                </div>
              </div>

              {/* Apply button */}
              <Button
                onClick={handleBulkApply}
                disabled={isSaving || selectedCardIds.size === 0 || isLoadingCards}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
              >
                {isSaving
                  ? 'Saving…'
                  : selectedCardIds.size === 0
                    ? 'Select cards to apply'
                    : `Apply to ${selectedCardIds.size} card${selectedCardIds.size === 1 ? '' : 's'}`}
              </Button>

              {selectedCardIds.size > 0 && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  This replaces existing overrides on the selected cards.
                </p>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
