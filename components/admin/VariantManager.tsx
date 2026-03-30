'use client'

import { useState, useTransition } from 'react'
import { Variant, VariantSuggestion } from '@/types'
import { createVariant, deleteVariant, renameVariant, approveVariantSuggestion, rejectVariantSuggestion } from '@/app/admin/variants/actions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CardSearch, SearchCard } from './CardSearch'
import { CardVariantEditor } from './CardVariantEditor'
import { SetBulkVariantEditor } from './SetBulkVariantEditor'
// VariantManager intentionally does NOT import createCardSpecificVariant —
// that action is called directly inside CardVariantEditor.

interface VariantSuggestionWithUser extends VariantSuggestion {
  // Aligns with VariantSuggestion.users: { username: string } | null
  // plus optional extra fields the admin UI may read
  users: { username: string; id?: string; email?: string } | null
}

interface VariantManagerProps {
  initialVariants: Variant[]
  initialSuggestions: VariantSuggestionWithUser[]
  onVariantsChange?: (variants: Variant[]) => void
  onSuggestionsChange?: (suggestions: VariantSuggestionWithUser[]) => void
}

export function VariantManager({ initialVariants, initialSuggestions, onVariantsChange, onSuggestionsChange }: VariantManagerProps) {
  const [variants, setVariants] = useState(initialVariants)
  const [suggestions, setSuggestions] = useState(initialSuggestions)
  const [isPending, startTransition] = useTransition()
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  // Inline rename state
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // Card selection state
  const [selectedCard, setSelectedCard] = useState<SearchCard | null>(null)
  const [currentView, setCurrentView] = useState<'search' | 'legacy' | 'suggestions' | 'set-bulk'>('search')

  // Form state for creating new variants (legacy mode)
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    color: 'blue' as 'green' | 'blue' | 'purple' | 'red' | 'pink' | 'yellow' | 'gray' | 'orange' | 'teal',
    shortLabel: '',
    isQuickAdd: false,
    sortOrder: 0
  })

  const setLoading = (key: string, loading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: loading }))
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!createForm.name.trim()) {
      showMessage('error', 'Variant name is required')
      return
    }

    setLoading('create', true)
    
    const formData = new FormData()
    formData.append('name', createForm.name.trim())
    formData.append('description', createForm.description.trim())
    formData.append('color', createForm.color)
    formData.append('shortLabel', createForm.shortLabel.trim())
    formData.append('isQuickAdd', createForm.isQuickAdd.toString())
    formData.append('sortOrder', createForm.sortOrder.toString())

    startTransition(async () => {
      try {
        const result = await createVariant(formData)
        
        if (result.success) {
          showMessage('success', 'Variant created successfully!')
          const updatedVariants = [...variants, result.data]
          setVariants(updatedVariants)
          onVariantsChange?.(updatedVariants)
          setCreateForm({
            name: '',
            description: '',
            color: 'blue',
            shortLabel: '',
            isQuickAdd: false,
            sortOrder: 0
          })
        } else {
          showMessage('error', result.error)
        }
      } catch (error: any) {
        showMessage('error', error.message || 'Failed to create variant')
      } finally {
        setLoading('create', false)
      }
    })
  }

  const handleDeleteVariant = async (variantId: string, variantName: string) => {
    if (!confirm(`Are you sure you want to delete the variant "${variantName}"? This cannot be undone.`)) {
      return
    }

    setLoading(`delete-${variantId}`, true)

    startTransition(async () => {
      try {
        const result = await deleteVariant(variantId)
        
        if (result.success) {
          showMessage('success', result.message || 'Variant deleted successfully')
          const updatedVariants = variants.filter(v => v.id !== variantId)
          setVariants(updatedVariants)
          onVariantsChange?.(updatedVariants)
        } else {
          showMessage('error', result.error)
        }
      } catch (error: any) {
        showMessage('error', error.message || 'Failed to delete variant')
      } finally {
        setLoading(`delete-${variantId}`, false)
      }
    })
  }

  const handleStartRename = (variant: Variant) => {
    setEditingVariantId(variant.id)
    setEditingName(variant.name)
  }

  const handleCancelRename = () => {
    setEditingVariantId(null)
    setEditingName('')
  }

  const handleSaveRename = async (variantId: string) => {
    if (!editingName.trim()) {
      showMessage('error', 'Variant name cannot be empty')
      return
    }

    setLoading(`rename-${variantId}`, true)

    startTransition(async () => {
      try {
        const result = await renameVariant(variantId, editingName)

        if (result.success) {
          showMessage('success', result.message || 'Variant renamed successfully')
          const updatedVariants = variants.map(v =>
            v.id === variantId ? { ...v, name: result.data.name } : v
          )
          setVariants(updatedVariants)
          onVariantsChange?.(updatedVariants)
          setEditingVariantId(null)
          setEditingName('')
        } else {
          showMessage('error', result.error)
        }
      } catch (error: any) {
        showMessage('error', error.message || 'Failed to rename variant')
      } finally {
        setLoading(`rename-${variantId}`, false)
      }
    })
  }

  const handleApproveSuggestion = async (suggestionId: string) => {
    setLoading(`approve-${suggestionId}`, true)

    startTransition(async () => {
      try {
        const result = await approveVariantSuggestion(suggestionId)
        
        if (result.success) {
          showMessage('success', result.message || 'Suggestion approved successfully')
          const updatedSuggestions = suggestions.filter(s => s.id !== suggestionId)
          setSuggestions(updatedSuggestions)
          onSuggestionsChange?.(updatedSuggestions)
          if (result.data) {
            const updatedVariants = [...variants, result.data]
            setVariants(updatedVariants)
            onVariantsChange?.(updatedVariants)
          }
        } else {
          showMessage('error', result.error)
        }
      } catch (error: any) {
        showMessage('error', error.message || 'Failed to approve suggestion')
      } finally {
        setLoading(`approve-${suggestionId}`, false)
      }
    })
  }

  const handleRejectSuggestion = async (suggestionId: string) => {
    setLoading(`reject-${suggestionId}`, true)

    startTransition(async () => {
      try {
        const result = await rejectVariantSuggestion(suggestionId)
        
        if (result.success) {
          showMessage('success', result.message || 'Suggestion rejected successfully')
          const updatedSuggestions = suggestions.filter(s => s.id !== suggestionId)
          setSuggestions(updatedSuggestions)
          onSuggestionsChange?.(updatedSuggestions)
        } else {
          showMessage('error', result.error)
        }
      } catch (error: any) {
        showMessage('error', error.message || 'Failed to reject suggestion')
      } finally {
        setLoading(`reject-${suggestionId}`, false)
      }
    })
  }

  const GLOBAL_KEY = '__global__'

  const getVariantsByCard = () => {
    const grouped = variants.reduce((acc, variant) => {
      // Global variants (card_id = null) are grouped under a synthetic key so
      // they are visible and editable in the overview instead of being skipped.
      const key = variant.card_id ?? GLOBAL_KEY
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(variant)
      return acc
    }, {} as Record<string, Variant[]>)

    return Object.entries(grouped).sort(([a], [b]) => {
      // Always show global variants first
      if (a === GLOBAL_KEY) return -1
      if (b === GLOBAL_KEY) return 1
      return a.localeCompare(b)
    })
  }

  // All official global variants — passed to CardVariantEditor for the toggle UI
  const officialVariants = variants.filter(v => v.is_official)

  // Handle card selection from search
  const handleCardSelect = (card: SearchCard) => {
    setSelectedCard(card)
    setCurrentView('search')
  }

  return (
    <div className="space-y-6">
      {/* Live Stats Strip */}
      <div className="flex flex-wrap gap-4">
        <div className="bg-gray-800 rounded-lg px-4 py-2">
          <div className="text-2xl font-bold text-white">{variants.length}</div>
          <div className="text-sm text-gray-400">Active Variants</div>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-2">
          <div className="text-2xl font-bold text-yellow-400">{suggestions.length}</div>
          <div className="text-sm text-gray-400">Pending Suggestions</div>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-900/50 border border-green-500 text-green-200' :
          'bg-red-900/50 border border-red-500 text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* View Toggle */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center space-x-1 bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setCurrentView('search')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              currentView === 'search'
                ? 'bg-purple-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            🔍 Search & Manage
          </button>
          <button
            onClick={() => setCurrentView('legacy')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              currentView === 'legacy'
                ? 'bg-purple-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            ✏️ Manual Entry
          </button>
          <button
            onClick={() => setCurrentView('suggestions')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              currentView === 'suggestions'
                ? 'bg-purple-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            💡 Suggestions ({suggestions.length})
          </button>
          <button
            onClick={() => setCurrentView('set-bulk')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              currentView === 'set-bulk'
                ? 'bg-purple-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            📦 By Set
          </button>
        </div>
      </div>

      {/* Search & Card Management View */}
      {currentView === 'search' && (
        <div className="space-y-6">
          {/* Card Search */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Search Cards</h2>
            <p className="text-gray-400 mb-6">
              Search for cards by name, number, or both (e.g., "Charmander 34", "54", "Pikachu")
            </p>
            <CardSearch
              onCardSelect={handleCardSelect}
              placeholder="Search cards to manage variants..."
              showVariantCount={true}
            />
          </div>

          {/* Selected Card Variant Editor */}
          {selectedCard && (
            <CardVariantEditor
              selectedCard={selectedCard}
              allVariants={officialVariants}
              onClose={() => setSelectedCard(null)}
              onCardVariantCreated={(newVariant) => {
                // Keep the live stats strip count accurate
                const updatedVariants = [...variants, newVariant]
                setVariants(updatedVariants)
                onVariantsChange?.(updatedVariants)
              }}
            />
          )}

        </div>
      )}

      {/* Legacy Manual Entry View */}
      {currentView === 'legacy' && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-6">Manual Variant Creation</h2>
          <p className="text-gray-400 mb-6">
            Create a new global variant that applies across all cards.
          </p>
          
          <form onSubmit={handleCreateVariant} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Variant Name *
                </label>
                <Input
                  type="text"
                  value={createForm.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Holo Rare, First Edition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Color
                </label>
                <select
                  value={createForm.color}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCreateForm(prev => ({ ...prev, color: e.target.value as 'green' | 'blue' | 'purple' | 'red' | 'pink' | 'yellow' | 'gray' | 'orange' | 'teal' }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
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
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Sort Order
                </label>
                <Input
                  type="number"
                  value={createForm.sortOrder}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Short Label
                </label>
                <Input
                  type="text"
                  value={createForm.shortLabel}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm(prev => ({ ...prev, shortLabel: e.target.value }))}
                  placeholder="e.g., H, 1st"
                />
              </div>

              <div className="flex items-center space-x-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={createForm.isQuickAdd}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm(prev => ({ ...prev, isQuickAdd: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-300">Quick Add Enabled</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={createForm.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description of this variant"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white h-20 resize-none"
              />
            </div>

            <Button
              type="submit"
              disabled={loadingStates.create || isPending}
              className="w-full md:w-auto"
            >
              {loadingStates.create ? 'Creating...' : 'Create Variant'}
            </Button>
          </form>
        </div>
      )}

      {/* Set Bulk Variant Editor View */}
      {currentView === 'set-bulk' && (
        <SetBulkVariantEditor
          allVariants={officialVariants}
          onVariantCreated={(newVariant) => {
            const updatedVariants = [...variants, newVariant]
            setVariants(updatedVariants)
            onVariantsChange?.(updatedVariants)
          }}
        />
      )}

      {/* Suggestions View */}
      {currentView === 'suggestions' && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-6">Pending Suggestions ({suggestions.length})</h2>
          
          {suggestions.length === 0 ? (
            <div className="text-gray-400 text-center py-12">
              <div className="text-4xl mb-4">🎉</div>
              <h3 className="text-lg font-medium mb-2">All caught up!</h3>
              <p>No pending suggestions to review.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-semibold text-white">{suggestion.name}</h3>
                        <span className="text-sm text-gray-400">for {suggestion.card_id}</span>
                      </div>
                      
                      {suggestion.description && (
                        <p className="text-gray-300 mb-2">{suggestion.description}</p>
                      )}
                      
                      <div className="text-sm text-gray-400">
                        Suggested by: {suggestion.users?.username || suggestion.users?.email || 'Unknown User'}
                        <span className="mx-2">•</span>
                        {new Date(suggestion.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex space-x-2 ml-4">
                      <Button
                        onClick={() => handleApproveSuggestion(suggestion.id)}
                        disabled={loadingStates[`approve-${suggestion.id}`] || isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {loadingStates[`approve-${suggestion.id}`] ? 'Approving...' : 'Approve'}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        onClick={() => handleRejectSuggestion(suggestion.id)}
                        disabled={loadingStates[`reject-${suggestion.id}`] || isPending}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        {loadingStates[`reject-${suggestion.id}`] ? 'Rejecting...' : 'Reject'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Variants Overview (always visible at bottom) */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">All Variants Overview ({variants.length})</h2>
          <div className="text-sm text-gray-400">
            {variants.filter(v => v.card_id).length > 0
              ? `${new Set(variants.filter(v => v.card_id).map(v => v.card_id)).size} cards have card-specific variants`
              : `${variants.filter(v => !v.card_id).length} global variants`}
          </div>
        </div>
        
        {variants.length === 0 ? (
          <div className="text-gray-400 text-center py-12">
            <div className="text-4xl mb-4">📦</div>
            <h3 className="text-lg font-medium mb-2">No variants yet</h3>
            <p>Use the search above to find cards and create their first variants.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {getVariantsByCard().slice(0, 10).map(([cardId, cardVariants]) => (
              <div key={cardId} className="border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">
                    {cardId === GLOBAL_KEY ? '🌐 Global Variants' : `Card: ${cardId}`}
                  </h3>
                  <span className="text-sm text-gray-400">{cardVariants.length} variants</span>
                </div>
                <div className="space-y-2">
                  {cardVariants.map((variant) => (
                    <div key={variant.id} className="flex items-center justify-between bg-gray-700 rounded p-3">
                      <div className="flex items-center space-x-4 flex-1 min-w-0">
                        <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: {
                          green: '#10b981',
                          blue: '#3b82f6',
                          purple: '#8b5cf6',
                          red: '#ef4444',
                          pink: '#ec4899',
                          yellow: '#eab308',
                          gray: '#6b7280',
                          orange: '#f97316',
                          teal: '#14b8a6',
                        }[variant.color] }}></div>

                        <div className="flex-1 min-w-0">
                          {editingVariantId === variant.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="text"
                                value={editingName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingName(e.target.value)}
                                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                  if (e.key === 'Enter') handleSaveRename(variant.id)
                                  if (e.key === 'Escape') handleCancelRename()
                                }}
                                className="h-8 text-sm py-1"
                                autoFocus
                                disabled={loadingStates[`rename-${variant.id}`] || isPending}
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSaveRename(variant.id)}
                                disabled={loadingStates[`rename-${variant.id}`] || isPending}
                                className="bg-green-600 hover:bg-green-700 flex-shrink-0"
                              >
                                {loadingStates[`rename-${variant.id}`] ? '...' : 'Save'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCancelRename}
                                disabled={loadingStates[`rename-${variant.id}`] || isPending}
                                className="text-gray-400 hover:text-gray-200 flex-shrink-0"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 group">
                              <div className="text-white font-medium">{variant.name}</div>
                              <button
                                onClick={() => handleStartRename(variant)}
                                title="Rename variant"
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-yellow-400 focus:opacity-100 focus:text-yellow-400 p-0.5 rounded"
                              >
                                ✏️
                              </button>
                            </div>
                          )}
                          {variant.description && (
                            <div className="text-gray-400 text-sm">{variant.description}</div>
                          )}
                          <div className="text-gray-500 text-xs">
                            Order: {variant.sort_order} • Quick Add: {variant.is_quick_add ? 'Yes' : 'No'}
                            {variant.short_label && ` • Label: ${variant.short_label}`}
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        onClick={() => handleDeleteVariant(variant.id, variant.name)}
                        disabled={loadingStates[`delete-${variant.id}`] || isPending || editingVariantId === variant.id}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20 flex-shrink-0 ml-2"
                        size="sm"
                      >
                        {loadingStates[`delete-${variant.id}`] ? '...' : 'Delete'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {getVariantsByCard().length > 10 && (
              <div className="text-center py-4">
                <div className="text-gray-400 text-sm">
                  Showing 10 of {getVariantsByCard().length} cards with variants.
                  <br />
                  Use search above to find specific cards.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}