'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Combobox, Transition } from '@headlessui/react'
import { supabase } from '@/lib/supabase'
import { usePreferredCurrency } from '@/contexts/UserPreferencesContext'
import { useI18n } from '@/contexts/I18nContext'
import { currencyService } from '@/lib/currency-service'
import {
  Search,
  Package,
  CreditCard,
  ChevronsUpDown,
  Check,
  Clock,
  TrendingUp,
  Star,
  ExternalLink
} from 'lucide-react'
import { Fragment } from 'react'

interface SearchResult {
  id: string
  type: 'card' | 'set'
  title: string
  subtitle: string
  description?: string
  image?: string
  metadata?: any
  url: string
}

interface DashboardSearchProps {
  className?: string
  placeholder?: string
  showCategories?: boolean
}

export function DashboardSearch({
  className = '',
  placeholder = "Search cards and sets...",
  showCategories = true
}: DashboardSearchProps) {
  const router = useRouter()
  const preferredCurrency = usePreferredCurrency()
  const { locale } = useI18n()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([])

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dashboard-recent-searches')
      if (stored) {
        try {
          setRecentSearches(JSON.parse(stored))
        } catch (error) {
          console.error('Error loading recent searches:', error)
        }
      }
    }
  }, [])

  // Save recent searches to localStorage
  const saveRecentSearch = useCallback((result: SearchResult) => {
    if (typeof window !== 'undefined') {
      const newRecent = [result, ...recentSearches.filter(r => r.id !== result.id)].slice(0, 5)
      setRecentSearches(newRecent)
      localStorage.setItem('dashboard-recent-searches', JSON.stringify(newRecent))
    }
  }, [recentSearches])

  // Debounced search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const searchResults: SearchResult[] = []

      // Search cards
      const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select(`
          id,
          name,
          number,
          rarity,
          image_small,
          cardmarket_avg_sell_price,
          set_id,
          sets(name, symbol_url)
        `)
        .or(`name.ilike.%${searchQuery}%,number.ilike.%${searchQuery}%`)
        .limit(8)

      if (!cardsError && cards) {
        cards.forEach(card => {
          searchResults.push({
            id: card.id,
            type: 'card',
            title: card.name,
            subtitle: `${card.sets?.[0]?.name || 'Unknown Set'} #${card.number}`,
            description: card.rarity,
            image: card.image_small,
            metadata: {
              price: card.cardmarket_avg_sell_price,
              setSymbol: card.sets?.[0]?.symbol_url,
              rarity: card.rarity,
              setId: card.set_id
            },
            url: `/sets/${card.set_id}?card=${card.id}`
          })
        })
      }

      // Search sets
      const { data: sets, error: setsError } = await supabase
        .from('sets')
        .select(`
          id,
          name,
          series,
          total_cards,
          release_date,
          symbol_url,
          logo_url
        `)
        .or(`name.ilike.%${searchQuery}%,series.ilike.%${searchQuery}%`)
        .limit(6)

      if (!setsError && sets) {
        sets.forEach(set => {
          searchResults.push({
            id: set.id,
            type: 'set',
            title: set.name,
            subtitle: set.series,
            description: `${set.total_cards} cards • Released ${new Date(set.release_date).toLocaleDateString()}`,
            image: set.symbol_url || set.logo_url || undefined,
            metadata: {
              totalCards: set.total_cards,
              releaseDate: set.release_date,
              series: set.series
            },
            url: `/sets/${set.id}`
          })
        })
      }

      setResults(searchResults)
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce the search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(query)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, performSearch])

  // Handle selection
  const handleSelect = useCallback((result: SearchResult | null) => {
    if (result) {
      setSelected(result)
      saveRecentSearch(result)
      router.push(result.url)
      setQuery('')
      setSelected(null)
    }
  }, [router, saveRecentSearch])

  // Get icon for result type
  const getResultIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'card':
        return <CreditCard className="w-4 h-4" />
      case 'set':
        return <Package className="w-4 h-4" />
    }
  }

  // Get result type label
  const getResultTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'card':
        return 'Card'
      case 'set':
        return 'Set'
    }
  }

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups = {
      card: results.filter(r => r.type === 'card'),
      set: results.filter(r => r.type === 'set')
    }
    return groups
  }, [results])

  const hasResults = results.length > 0
  const showRecent = query.length < 2 && recentSearches.length > 0

  return (
    <div className={`relative ${className}`}>
      <Combobox value={selected} onChange={handleSelect}>
        <div className="relative">
          <div className="relative">
            <Combobox.Input
              className="input-gaming w-full pl-10 pr-10"
              placeholder={placeholder}
              onChange={(event) => setQuery(event.target.value)}
              displayValue={() => query}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3">
              <ChevronsUpDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </Combobox.Button>
          </div>

          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            afterLeave={() => setQuery('')}
          >
            <Combobox.Options className="absolute z-50 mt-1 max-h-96 w-full overflow-auto card-container bg-pkmn-card animate-slide-up focus:outline-none">
              {loading && (
                <div className="px-4 py-3 text-sm text-gray-400 flex items-center">
                  <div className="spinner mr-2"></div>
                  Searching...
                </div>
              )}

              {!loading && query.length >= 2 && !hasResults && (
                <div className="px-4 py-3 text-sm text-gray-400">
                  No results found for "{query}"
                </div>
              )}

              {!loading && showRecent && (
                <div className="p-2">
                  <div className="px-2 py-1 text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center border-b border-gray-700/50 mb-2 pb-2">
                    <Clock className="w-3 h-3 mr-1" />
                    Recent Searches
                  </div>
                  {recentSearches.map((result) => (
                    <Combobox.Option
                      key={`recent-${result.id}`}
                      className={({ active }) =>
                        `relative cursor-pointer select-none py-2 pl-3 pr-4 rounded-md transition-all duration-200 ${
                          active ? 'bg-pokemon-gold/10 text-white hover-lift' : 'text-gray-300'
                        }`
                      }
                      value={result}
                    >
                      {({ selected, active }) => (
                        <div className="flex items-center space-x-3">
                          <div className={`flex-shrink-0 p-1 rounded ${
                            result.type === 'card' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                          }`}>
                            {getResultIcon(result.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{result.title}</div>
                            <div className="text-xs text-gray-400 truncate">{result.subtitle}</div>
                          </div>
                          <div className="text-xs text-gray-500">{getResultTypeLabel(result.type)}</div>
                        </div>
                      )}
                    </Combobox.Option>
                  ))}
                </div>
              )}

              {!loading && hasResults && showCategories && (
                <div className="p-2 space-y-3">
                  {/* Cards Section */}
                  {groupedResults.card.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-xs font-medium text-blue-400 uppercase tracking-wide flex items-center border-b border-gray-700/50 mb-2 pb-2">
                        <CreditCard className="w-3 h-3 mr-1" />
                        Cards ({groupedResults.card.length})
                      </div>
                      {groupedResults.card.map((result) => (
                        <Combobox.Option
                          key={result.id}
                          className={({ active }) =>
                            `relative cursor-pointer select-none py-2 pl-3 pr-4 rounded-md ${
                              active ? 'bg-pokemon-gold/10 text-white' : 'text-gray-300'
                            }`
                          }
                          value={result}
                        >
                          {({ selected, active }) => (
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                {result.image ? (
                                  <img
                                    src={result.image}
                                    alt={result.title}
                                    className="w-8 h-11 object-cover rounded"
                                  />
                                ) : (
                                  <div className="w-8 h-11 bg-pkmn-surface rounded flex items-center justify-center">
                                    <CreditCard className="w-4 h-4 text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{result.title}</div>
                                <div className="text-xs text-gray-400 truncate">{result.subtitle}</div>
                                {result.description && (
                                  <div className="text-xs text-gray-500 truncate">{result.description}</div>
                                )}
                              </div>
                              {result.metadata?.price && (
                                <div className="text-xs text-green-400 font-medium">
                                  {currencyService.formatCurrency(result.metadata.price, preferredCurrency || 'EUR', locale)}
                                </div>
                              )}
                              {selected && (
                                <Check className="h-4 w-4 text-pokemon-gold" aria-hidden="true" />
                              )}
                            </div>
                          )}
                        </Combobox.Option>
                      ))}
                    </div>
                  )}

                  {/* Sets Section */}
                  {groupedResults.set.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-xs font-medium text-green-400 uppercase tracking-wide flex items-center">
                        <Package className="w-3 h-3 mr-1" />
                        Sets ({groupedResults.set.length})
                      </div>
                      {groupedResults.set.map((result) => (
                        <Combobox.Option
                          key={result.id}
                          className={({ active }) =>
                            `relative cursor-pointer select-none py-2 pl-3 pr-4 rounded-md ${
                              active ? 'bg-pokemon-gold/10 text-white' : 'text-gray-300'
                            }`
                          }
                          value={result}
                        >
                          {({ selected, active }) => (
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                {result.image ? (
                                  <img
                                    src={result.image}
                                    alt={result.title}
                                    className="w-8 h-8 object-contain rounded"
                                  />
                                ) : (
                                  <div className="w-8 h-8 bg-pkmn-surface rounded flex items-center justify-center">
                                    <Package className="w-4 h-4 text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{result.title}</div>
                                <div className="text-xs text-gray-400 truncate">{result.subtitle}</div>
                                {result.description && (
                                  <div className="text-xs text-gray-500 truncate">{result.description}</div>
                                )}
                              </div>
                              {selected && (
                                <Check className="h-4 w-4 text-pokemon-gold" aria-hidden="true" />
                              )}
                            </div>
                          )}
                        </Combobox.Option>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!loading && hasResults && !showCategories && (
                <div className="p-2">
                  {results.map((result) => (
                    <Combobox.Option
                      key={result.id}
                      className={({ active }) =>
                        `relative cursor-pointer select-none py-2 pl-3 pr-4 rounded-md ${
                          active ? 'bg-pokemon-gold/10 text-white' : 'text-gray-300'
                        }`
                      }
                      value={result}
                    >
                      {({ selected, active }) => (
                        <div className="flex items-center space-x-3">
                          <div className={`flex-shrink-0 p-1 rounded ${
                            result.type === 'card' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                          }`}>
                            {getResultIcon(result.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{result.title}</div>
                            <div className="text-xs text-gray-400 truncate">{result.subtitle}</div>
                            {result.description && (
                              <div className="text-xs text-gray-500 truncate">{result.description}</div>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{getResultTypeLabel(result.type)}</div>
                          {selected && (
                            <Check className="h-4 w-4 text-pokemon-gold" aria-hidden="true" />
                          )}
                        </div>
                      )}
                    </Combobox.Option>
                  ))}
                </div>
              )}

              {/* Show All Results Footer */}
              {!loading && hasResults && query.length >= 2 && (
                <div className="border-t border-gray-700/50 p-2">
                  <button
                    onClick={() => {
                      router.push(`/cards?search=${encodeURIComponent(query)}`)
                      setQuery('')
                    }}
                    className="w-full flex items-center justify-center px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-pkmn-surface/50 rounded-md transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View all results for "{query}"
                  </button>
                </div>
              )}
            </Combobox.Options>
          </Transition>
        </div>
      </Combobox>
    </div>
  )
}