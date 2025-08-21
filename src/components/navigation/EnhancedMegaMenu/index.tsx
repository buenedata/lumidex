'use client'

import React, { useState, useEffect, useRef, Fragment } from 'react'
import { Popover, Transition, Disclosure, Combobox } from '@headlessui/react'
import Link from 'next/link'
import Image from 'next/image'
import { useNavigation } from '@/contexts/NavigationContext'
import { useMenuSets } from '@/hooks/useSimpleData'
import {
  Search,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Calendar,
  TrendingUp,
  Star,
  Zap,
  ArrowRight,
  Loader2,
  X
} from 'lucide-react'
import LoadingSkeleton from './LoadingSkeleton'
import MobileMegaMenu from './MobileMegaMenu'
import './styles.css'

// Enhanced data types
interface EnhancedSet {
  id: string
  name: string
  series: string
  seriesId: string
  totalCards: number
  releaseDate: string
  symbolUrl?: string
  logoUrl?: string
  isLatest: boolean
  isPopular: boolean
  averagePrice?: number
  userCompletionPercentage?: number
}

interface EnhancedSeries {
  id: string
  name: string
  displayName: string
  description?: string
  releaseYear: number
  totalSets: number
  totalCards: number
  isPopular: boolean
  isFeatured: boolean
  sets: EnhancedSet[]
  thumbnail?: string
}

interface QuickAccessItem {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  count?: number
}

interface TypeFilter {
  name: string
  emoji: string
  color: string
  href: string
  count?: number
}

interface FeaturedContent {
  type: 'set' | 'series' | 'promotion'
  title: string
  subtitle?: string
  href: string
  imageUrl?: string
  badge?: string
  isNew?: boolean
}

interface MegaMenuData {
  quickAccess: QuickAccessItem[]
  typeFilters: TypeFilter[]
  series: EnhancedSeries[]
  featuredContent: FeaturedContent[]
  statistics: {
    totalCards: number
    totalSets: number
    totalSeries: number
    averagePrice: number
    lastUpdated: string
  }
}

interface EnhancedMegaMenuProps {
  className?: string
}

export default function EnhancedMegaMenu({ className = '' }: EnhancedMegaMenuProps) {
  const { state, toggleMegaMenu } = useNavigation()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const megaMenuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Use new simplified data hook
  const {
    data: setsData,
    loading,
    error: setsError,
    fromCache
  } = useMenuSets()

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Process sets data into mega menu format
  const megaMenuData = React.useMemo(() => {
    if (!setsData) return null

    // Group by series
    const seriesMap = new Map<string, EnhancedSeries>()
    
    setsData.forEach((set) => {
      if (!seriesMap.has(set.series)) {
        seriesMap.set(set.series, {
          id: set.series.toLowerCase().replace(/\s+/g, '-'),
          name: set.series,
          displayName: set.series,
          releaseYear: new Date(set.release_date).getFullYear(),
          totalSets: 0,
          totalCards: 0,
          isPopular: false,
          isFeatured: false,
          sets: []
        })
      }

      const series = seriesMap.get(set.series)!
      series.sets.push({
        id: set.id,
        name: set.name,
        series: set.series,
        seriesId: series.id,
        totalCards: set.total_cards,
        releaseDate: set.release_date,
        symbolUrl: set.symbol_url || undefined,
        logoUrl: undefined,
        isLatest: false,
        isPopular: false,
        averagePrice: 0
      })
      series.totalSets++
      series.totalCards += set.total_cards
    })

    // Convert to array and sort
    const seriesArray = Array.from(seriesMap.values())
      .sort((a, b) => {
        if (a.name === 'Other') return 1
        if (b.name === 'Other') return -1
        return b.releaseYear - a.releaseYear
      })
      .map((series, index) => ({
        ...series,
        isPopular: index < 6,
        isFeatured: index < 3
      }))

    const totalCards = seriesArray.reduce((sum, series) => sum + series.totalCards, 0)
    const totalSets = seriesArray.reduce((sum, series) => sum + series.totalSets, 0)

    // Static quick access items (no circular dependency)
    const quickAccessItems: QuickAccessItem[] = [
      {
        id: 'all-cards',
        label: 'All Cards',
        href: '/cards',
        icon: Sparkles,
        description: 'Browse entire collection',
        count: totalCards
      },
      {
        id: 'new-releases',
        label: 'New Releases',
        href: '/cards?sort=release_date&order=desc',
        icon: Calendar,
        description: 'Latest card releases'
      },
      {
        id: 'popular',
        label: 'Popular Cards',
        href: '/cards?sort=popularity',
        icon: TrendingUp,
        description: 'Community favorites'
      },
      {
        id: 'high-value',
        label: 'High Value Cards',
        href: '/cards?sort=price&order=desc',
        icon: Star,
        description: 'Premium collectibles'
      },
      {
        id: 'promos',
        label: 'Promo Cards',
        href: '/cards?rarity=Promo',
        icon: Zap,
        description: 'Special promotional cards'
      }
    ]

    return {
      quickAccess: quickAccessItems,
      typeFilters,
      series: seriesArray,
      featuredContent: [
        {
          type: 'set' as const,
          title: setsData?.[0]?.name || 'Latest Release',
          subtitle: 'New Set Available',
          href: `/sets/${setsData?.[0]?.id}`,
          badge: 'New',
          isNew: true
        },
        {
          type: 'series' as const,
          title: 'Popular Series',
          subtitle: 'Most collected',
          href: '/cards?sort=popularity',
          badge: 'Trending'
        }
      ],
      statistics: {
        totalCards,
        totalSets,
        totalSeries: seriesArray.length,
        averagePrice: 2.50,
        lastUpdated: new Date().toISOString()
      }
    }
  }, [setsData])

  // Pokemon type filters
  const typeFilters: TypeFilter[] = [
    { name: 'Electric', emoji: '⚡', color: 'text-yellow-400', href: '/cards?types=Lightning' },
    { name: 'Fire', emoji: '🔥', color: 'text-red-400', href: '/cards?types=Fire' },
    { name: 'Water', emoji: '💧', color: 'text-blue-400', href: '/cards?types=Water' },
    { name: 'Grass', emoji: '🌿', color: 'text-green-400', href: '/cards?types=Grass' },
    { name: 'Psychic', emoji: '🔮', color: 'text-purple-400', href: '/cards?types=Psychic' },
    { name: 'Fighting', emoji: '👊', color: 'text-orange-400', href: '/cards?types=Fighting' },
    { name: 'Darkness', emoji: '🌙', color: 'text-gray-400', href: '/cards?types=Darkness' },
    { name: 'Metal', emoji: '⚙️', color: 'text-gray-300', href: '/cards?types=Metal' }
  ]

  // Handle click outside to close mega menu - improved version
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element
      
      // Don't close if clicking within the menu
      if (megaMenuRef.current?.contains(target)) {
        return
      }
      
      // Don't close if clicking on navigation trigger elements
      if (target.closest('[data-megamenu-trigger]') || target.closest('[data-megamenu-content]')) {
        return
      }
      
      toggleMegaMenu(false)
    }

    if (state.megaMenuOpen) {
      // Small delay to prevent immediate closing when opening
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 100)
      
      return () => {
        clearTimeout(timer)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [state.megaMenuOpen, toggleMegaMenu])

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!state.megaMenuOpen) return

      switch (event.key) {
        case 'Escape':
          toggleMegaMenu(false)
          break
        case '/':
        case 'k':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            searchInputRef.current?.focus()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [state.megaMenuOpen, toggleMegaMenu])

  // Search functionality

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    
    if (!query || !query.trim() || !megaMenuData) {
      setSearchResults([])
      return
    }

    const results: any[] = []
    
    // Search in series
    megaMenuData.series.forEach(series => {
      if (series.name.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          type: 'series',
          id: series.id,
          title: series.name,
          subtitle: `${series.totalSets} sets`,
          href: `/sets?series=${encodeURIComponent(series.name)}`
        })
      }
      
      // Search in sets
      series.sets.forEach(set => {
        if (set.name.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            type: 'set',
            id: set.id,
            title: set.name,
            subtitle: series.name,
            href: `/sets/${set.id}`
          })
        }
      })
    })

    setSearchResults(results.slice(0, 8)) // Limit to 8 results
  }

  // Remove the custom toggle function - let Headless UI handle disclosure state

  // Handle navigation link clicks
  const handleNavigationClick = (event: React.MouseEvent) => {
    // Don't prevent default - let the navigation happen
    // Close menu after a short delay to allow navigation
    setTimeout(() => {
      toggleMegaMenu(false)
    }, 100)
  }

  // Handle mouse leave with delay
  const handleMouseLeave = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
    }
    
    closeTimeoutRef.current = setTimeout(() => {
      toggleMegaMenu(false)
    }, 300) // 300ms delay before closing
  }

  // Handle mouse enter to cancel close
  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  if (!state.megaMenuOpen) return null

  // Use mobile version on smaller screens
  if (isMobile) {
    return (
      <MobileMegaMenu
        isOpen={state.megaMenuOpen}
        onClose={() => toggleMegaMenu(false)}
        megaMenuData={megaMenuData}
        loading={loading}
      />
    )
  }

  return (
    <div className={`fixed top-16 left-0 right-0 z-40 ${className}`}>
      <Transition
        show={state.megaMenuOpen}
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <div
          ref={megaMenuRef}
          className="bg-pkmn-card border border-gray-700/50 rounded-b-xl shadow-2xl"
          data-megamenu-content="true"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="max-w-7xl mx-auto p-6">
            {/* Error indicator */}
            {setsError && (
              <div className="mb-4 bg-red-900/50 border border-red-700 rounded-lg p-3">
                <div className="text-red-400 text-sm">
                  Failed to load menu data: {setsError}
                </div>
              </div>
            )}

            {/* Cache indicator */}
            {fromCache && (
              <div className="mb-4 bg-blue-500/20 border border-blue-500/30 rounded-lg p-3">
                <div className="text-blue-400 text-sm">
                  Menu data loaded from cache
                </div>
              </div>
            )}

            {loading ? (
              <LoadingSkeleton />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Quick Access Panel - Left Column */}
                <div className="lg:col-span-1">
                  <div className="space-y-6">
                    
                    {/* Quick Access Links */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <Zap className="w-5 h-5 mr-2 text-pokemon-gold" />
                        Quick Access
                      </h3>
                      <div className="space-y-2">
                        {megaMenuData?.quickAccess.map((item) => {
                          const Icon = item.icon
                          return (
                            <Link
                              key={item.id}
                              href={item.href}
                              className="mega-menu-interactive flex items-center space-x-3 px-3 py-2.5 text-sm text-gray-300 hover:text-yellow-400 hover:bg-pkmn-surface/30 rounded-lg transition-all duration-200"
                              onClick={handleNavigationClick}
                            >
                              <Icon className="w-4 h-4 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium">{item.label}</div>
                                <div className="text-xs text-gray-500 truncate">{item.description}</div>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Series Navigator - Center Column */}
                <div className="lg:col-span-1">
                  <div className="space-y-4">
                    
                    {/* Search Bar */}
                    <div className="relative">
                      <Combobox value={searchQuery} onChange={handleSearch}>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                          <Combobox.Input
                            ref={searchInputRef}
                            className="w-full pl-10 pr-4 py-3 bg-pkmn-surface border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-pokemon-gold focus:ring-2 focus:ring-pokemon-gold/20 transition-all duration-200"
                            placeholder="Search series and sets... (Ctrl+K)"
                            onChange={(event) => handleSearch(event.target.value)}
                          />
                          {searchQuery && (
                            <button
                              onClick={() => handleSearch('')}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        
                        {searchResults.length > 0 && (
                          <Transition
                            as={Fragment}
                            leave="transition ease-in duration-100"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                          >
                            <Combobox.Options className="absolute z-10 w-full mt-1 bg-pkmn-card border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                              {searchResults.map((result) => (
                                <Combobox.Option
                                  key={`${result.type}-${result.id}`}
                                  value={result}
                                  className={({ active }) =>
                                    `relative cursor-pointer select-none py-2 pl-3 pr-9 ${
                                      active ? 'bg-pkmn-surface text-pokemon-gold' : 'text-gray-300'
                                    }`
                                  }
                                >
                                  <Link 
                                    href={result.href}
                                    onClick={handleNavigationClick}
                                    className="block"
                                  >
                                    <div className="flex items-center">
                                      <span className="block truncate font-medium">{result.title}</span>
                                      <span className="ml-2 text-xs text-gray-500">{result.subtitle}</span>
                                    </div>
                                  </Link>
                                </Combobox.Option>
                              ))}
                            </Combobox.Options>
                          </Transition>
                        )}
                      </Combobox>
                    </div>

                    {/* Series List */}
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {megaMenuData?.series.map((series) => (
                        <Disclosure key={series.id} defaultOpen={false}>
                          {({ open }) => (
                            <div className="mega-menu-card">
                              <Disclosure.Button
                                className="flex w-full items-center justify-between p-4 text-left hover:bg-pkmn-surface/30 transition-colors duration-200"
                              >
                                <div className="flex items-center space-x-3">
                                  <div>
                                    <h4 className="font-semibold text-white">{series.displayName}</h4>
                                    <p className="text-sm text-gray-400">
                                      {series.totalSets} sets • {series.totalCards} cards
                                    </p>
                                  </div>
                                  {series.isPopular && (
                                    <span className="mega-menu-badge mega-menu-badge-popular">Popular</span>
                                  )}
                                </div>
                                <ChevronDown
                                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                                    open ? 'rotate-180' : ''
                                  }`}
                                />
                              </Disclosure.Button>
                              
                              <Transition
                                enter="transition duration-100 ease-out"
                                enterFrom="transform scale-95 opacity-0"
                                enterTo="transform scale-100 opacity-100"
                                leave="transition duration-75 ease-out"
                                leaveFrom="transform scale-100 opacity-100"
                                leaveTo="transform scale-95 opacity-0"
                              >
                                <Disclosure.Panel className="px-4 pb-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {series.sets.slice(0, 6).map((set) => (
                                      <Link
                                        key={set.id}
                                        href={`/sets/${set.id}`}
                                        className="mega-menu-interactive flex items-center space-x-3 p-2 rounded-lg hover:bg-pkmn-surface/30 transition-all duration-200"
                                        onClick={handleNavigationClick}
                                      >
                                        {set.symbolUrl ? (
                                          <Image
                                            src={set.symbolUrl}
                                            alt={set.name}
                                            width={24}
                                            height={24}
                                            className="rounded"
                                          />
                                        ) : (
                                          <div className="w-6 h-6 bg-pokemon-gold/20 rounded flex items-center justify-center">
                                            <span className="text-pokemon-gold text-xs">🃏</span>
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-medium text-white truncate">{set.name}</div>
                                          <div className="text-xs text-gray-400">{set.totalCards} cards</div>
                                        </div>
                                      </Link>
                                    ))}
                                    {series.sets.length > 6 && (
                                      <Link
                                        href={`/sets?series=${encodeURIComponent(series.name)}`}
                                        className="mega-menu-interactive flex items-center justify-center p-2 text-sm text-pokemon-gold hover:bg-pkmn-surface/30 rounded-lg transition-all duration-200"
                                        onClick={handleNavigationClick}
                                      >
                                        View all {series.sets.length} sets
                                        <ArrowRight className="w-4 h-4 ml-1" />
                                      </Link>
                                    )}
                                  </div>
                                </Disclosure.Panel>
                              </Transition>
                            </div>
                          )}
                        </Disclosure>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Featured Content - Right Column */}
                <div className="lg:col-span-1">
                  <div className="space-y-6">
                    
                    {/* Featured Content */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <Star className="w-5 h-5 mr-2 text-pokemon-gold" />
                        Featured
                      </h3>
                      <div className="space-y-3">
                        {megaMenuData?.featuredContent.map((item, index) => (
                          <Link
                            key={index}
                            href={item.href}
                            className="mega-menu-card mega-menu-interactive block p-4 hover:border-pokemon-gold/30 transition-all duration-200"
                            onClick={handleNavigationClick}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-medium text-white">{item.title}</h4>
                              {item.badge && (
                                <span className={`mega-menu-badge ${
                                  item.isNew ? 'mega-menu-badge-new' :
                                  item.badge === 'Trending' ? 'mega-menu-badge-trending' :
                                  'mega-menu-badge-featured'
                                }`}>
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            {item.subtitle && (
                              <p className="text-sm text-gray-400">{item.subtitle}</p>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Transition>
    </div>
  )
}