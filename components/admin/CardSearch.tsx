'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/Input'

export interface SearchCard {
  id: string
  name: string
  number: string
  image_url: string
  rarity: string | null
  /** FK → variants.id — the variant that is added on double-click quick-add */
  default_variant_id: string | null
  set: {
    id: string
    name: string
    series: string
    release_date: string
  }
}

interface SearchResponse {
  cards: SearchCard[]
  total: number
  hasMore: boolean
  query: string
  error?: string
}

interface CardSearchProps {
  onCardSelect: (card: SearchCard) => void
  placeholder?: string
  showVariantCount?: boolean
  className?: string
}

export function CardSearch({ 
  onCardSelect, 
  placeholder = "Search cards by name or number (e.g., 'Charmander 34', '54', 'Pikachu')", 
  showVariantCount = false,
  className = "" 
}: CardSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchCard[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [error, setError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Debounced search function
  const debouncedSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/cards/search?q=${encodeURIComponent(searchQuery)}&limit=10`)
      
      if (!response.ok) {
        throw new Error('Search failed')
      }

      const raw = await response.json()

      // Defensive: handle both legacy array shape and current SearchResponse object shape
      const data: SearchResponse = Array.isArray(raw)
        ? { cards: raw, total: raw.length, hasMore: false, query: searchQuery }
        : raw

      if (data.error) {
        throw new Error(data.error)
      }

      const cards = data.cards ?? []
      setResults(cards)
      setIsOpen(cards.length > 0)
      setSelectedIndex(-1)
    } catch (err) {
      console.error('Search error:', err)
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Set new debounce
    debounceRef.current = setTimeout(() => {
      debouncedSearch(value)
    }, 300)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : results.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) {
          selectCard(results[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  // Handle card selection
  const selectCard = (card: SearchCard) => {
    setQuery(`${card.name} #${card.number} (${card.set.name})`)
    setIsOpen(false)
    setSelectedIndex(-1)
    onCardSelect(card)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <Input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (results.length > 0) setIsOpen(true)
        }}
        placeholder={placeholder}
        className="w-full"
      />

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin h-4 w-4 border-2 border-purple-600 border-t-transparent rounded-full"></div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm z-50">
          {error}
        </div>
      )}

      {/* Dropdown with results */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
          {results.map((card, index) => (
            <div
              key={card.id}
              className={`flex items-center p-3 cursor-pointer transition-colors ${
                index === selectedIndex 
                  ? 'bg-purple-600/30' 
                  : 'hover:bg-gray-700'
              } ${index === 0 ? 'rounded-t-lg' : ''} ${
                index === results.length - 1 ? 'rounded-b-lg' : 'border-b border-gray-700'
              }`}
              onClick={() => selectCard(card)}
            >
              {/* Card Image */}
              <div className="w-12 h-16 bg-gray-700 rounded overflow-hidden flex-shrink-0 mr-3">
                {card.image_url ? (
                  <img
                    src={card.image_url}
                    alt={card.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                    No Image
                  </div>
                )}
              </div>

              {/* Card Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-white truncate">{card.name}</h3>
                  <span className="text-purple-400 font-mono text-sm">#{card.number}</span>
                </div>
                
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-gray-400 text-sm truncate">{card.set.name}</span>
                  {card.rarity && (
                    <>
                      <span className="text-gray-500">•</span>
                      <span className="text-yellow-400 text-sm">{card.rarity}</span>
                    </>
                  )}
                </div>
                
                <div className="text-gray-500 text-xs mt-1">
                  {card.set.series} • {new Date(card.set.release_date).getFullYear()}
                </div>
              </div>

              {/* Variant Count (if enabled) */}
              {showVariantCount && (
                <div className="flex-shrink-0 ml-2">
                  <div className="bg-gray-700 rounded-full px-2 py-1">
                    <span className="text-xs text-gray-300">0 variants</span>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {/* Show more indicator */}
          {results.length >= 10 && (
            <div className="p-3 text-center text-gray-400 text-sm border-t border-gray-700">
              Keep typing to narrow down results...
            </div>
          )}
        </div>
      )}

      {/* No results message */}
      {isOpen && !isLoading && results.length === 0 && query.trim() && !error && (
        <div className="absolute top-full left-0 right-0 mt-1 p-4 bg-gray-800 border border-gray-600 rounded-lg text-center text-gray-400 text-sm z-50">
          No cards found for "{query}"
          <br />
          <span className="text-xs text-gray-500">Try searching by name, number, or both (e.g., "Pikachu 25")</span>
        </div>
      )}
    </div>
  )
}