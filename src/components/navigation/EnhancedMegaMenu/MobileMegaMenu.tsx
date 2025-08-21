'use client'

import React, { useState, useEffect, Fragment } from 'react'
import { Dialog, Transition, Disclosure, Combobox } from '@headlessui/react'
import Link from 'next/link'
import Image from 'next/image'
import { useNavigation } from '@/contexts/NavigationContext'
import {
  Search,
  ChevronRight,
  Sparkles,
  Calendar,
  TrendingUp,
  Star,
  Zap,
  ArrowRight,
  X,
  ArrowLeft
} from 'lucide-react'

interface MobileMegaMenuProps {
  isOpen: boolean
  onClose: () => void
  megaMenuData: any
  loading: boolean
}

export default function MobileMegaMenu({ 
  isOpen, 
  onClose, 
  megaMenuData, 
  loading 
}: MobileMegaMenuProps) {
  const [currentView, setCurrentView] = useState<'main' | 'series' | 'search'>('main')
  const [selectedSeries, setSelectedSeries] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  // Pre-define icon components to avoid temporal dead zone issues
  const SparklesIcon = Sparkles
  const CalendarIcon = Calendar
  const TrendingUpIcon = TrendingUp
  const StarIcon = Star
  const ZapIcon = Zap
  const ArrowRightIcon = ArrowRight

  // Quick access items for mobile
  const quickAccessItems = [
    { id: 'all-cards', label: 'All Cards', href: '/cards', icon: SparklesIcon },
    { id: 'new-releases', label: 'New Releases', href: '/cards?sort=release_date&order=desc', icon: CalendarIcon },
    { id: 'popular', label: 'Popular Cards', href: '/cards?sort=popularity', icon: TrendingUpIcon },
    { id: 'high-value', label: 'High Value Cards', href: '/cards?sort=price&order=desc', icon: StarIcon },
    { id: 'promos', label: 'Promo Cards', href: '/cards?rarity=Promo', icon: ZapIcon }
  ]


  const handleSearch = (query: string) => {
    setSearchQuery(query)
    
    if (!query.trim() || !megaMenuData) {
      setSearchResults([])
      return
    }

    const results: any[] = []
    
    // Search in series and sets
    megaMenuData.series?.forEach((series: any) => {
      if (series.name.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          type: 'series',
          id: series.id,
          title: series.name,
          subtitle: `${series.totalSets} sets`,
          href: `/sets?series=${encodeURIComponent(series.name)}`
        })
      }
      
      series.sets?.forEach((set: any) => {
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

    setSearchResults(results.slice(0, 10))
  }

  const handleSeriesSelect = (series: any) => {
    setSelectedSeries(series)
    setCurrentView('series')
  }

  const handleBackToMain = () => {
    setCurrentView('main')
    setSelectedSeries(null)
  }

  const handleLinkClick = () => {
    onClose()
    setCurrentView('main')
    setSelectedSeries(null)
    setSearchQuery('')
    setSearchResults([])
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-75" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-start justify-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden bg-pkmn-card text-left align-middle shadow-xl transition-all">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                  {currentView !== 'main' && (
                    <button
                      onClick={handleBackToMain}
                      className="flex items-center text-pokemon-gold hover:text-pokemon-gold-hover transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5 mr-2" />
                      Back
                    </button>
                  )}
                  <Dialog.Title className="text-lg font-semibold text-white">
                    {currentView === 'main' && 'Browse Cards'}
                    {currentView === 'series' && selectedSeries?.name}
                    {currentView === 'search' && 'Search Results'}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="max-h-[80vh] overflow-y-auto">
                  
                  {/* Main View */}
                  {currentView === 'main' && (
                    <div className="p-4 space-y-6">
                      
                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => handleSearch(e.target.value)}
                          placeholder="Search series and sets..."
                          className="w-full pl-10 pr-4 py-3 bg-pkmn-surface border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-pokemon-gold focus:ring-2 focus:ring-pokemon-gold/20 transition-all duration-200"
                        />
                      </div>

                      {/* Search Results */}
                      {searchResults.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                            Search Results
                          </h3>
                          {searchResults.map((result) => (
                            <Link
                              key={`${result.type}-${result.id}`}
                              href={result.href}
                              className="block p-3 rounded-lg bg-pkmn-surface hover:bg-gray-600 transition-colors"
                              onClick={handleLinkClick}
                            >
                              <div className="font-medium text-white">{result.title}</div>
                              <div className="text-sm text-gray-400">{result.subtitle}</div>
                            </Link>
                          ))}
                        </div>
                      )}

                      {/* Quick Access */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                          Quick Access
                        </h3>
                        <div className="space-y-2">
                          {quickAccessItems.map((item) => {
                            const Icon = item.icon
                            return (
                              <Link
                                key={item.id}
                                href={item.href}
                                className="flex items-center space-x-3 p-3 rounded-lg bg-pkmn-surface hover:bg-gray-600 transition-colors"
                                onClick={handleLinkClick}
                              >
                                <Icon className="w-5 h-5 text-pokemon-gold" />
                                <span className="text-white font-medium">{item.label}</span>
                              </Link>
                            )
                          })}
                        </div>
                      </div>


                      {/* Series List */}
                      {!loading && megaMenuData?.series && (
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                            Browse by Series
                          </h3>
                          <div className="space-y-2">
                            {megaMenuData.series.slice(0, 8).map((series: any) => (
                              <button
                                key={series.id}
                                onClick={() => handleSeriesSelect(series)}
                                className="w-full flex items-center justify-between p-3 rounded-lg bg-pkmn-surface hover:bg-gray-600 transition-colors text-left"
                              >
                                <div>
                                  <div className="text-white font-medium">{series.name}</div>
                                  <div className="text-sm text-gray-400">
                                    {series.totalSets} sets • {series.totalCards} cards
                                  </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Series Detail View */}
                  {currentView === 'series' && selectedSeries && (
                    <div className="p-4 space-y-4">
                      <div className="text-center py-4">
                        <h2 className="text-xl font-bold text-white">{selectedSeries.name}</h2>
                        <p className="text-gray-400">
                          {selectedSeries.totalSets} sets • {selectedSeries.totalCards} cards
                        </p>
                      </div>

                      <div className="space-y-2">
                        {selectedSeries.sets?.map((set: any) => (
                          <Link
                            key={set.id}
                            href={`/sets/${set.id}`}
                            className="flex items-center space-x-3 p-3 rounded-lg bg-pkmn-surface hover:bg-gray-600 transition-colors"
                            onClick={handleLinkClick}
                          >
                            {set.symbolUrl ? (
                              <Image
                                src={set.symbolUrl}
                                alt={set.name}
                                width={32}
                                height={32}
                                className="rounded"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-pokemon-gold/20 rounded flex items-center justify-center">
                                <span className="text-pokemon-gold text-sm">🃏</span>
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="text-white font-medium">{set.name}</div>
                              <div className="text-sm text-gray-400">{set.totalCards} cards</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}