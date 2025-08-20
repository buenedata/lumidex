'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { supabase } from '@/lib/supabase'
import MainNavBar from '@/components/navigation/MainNavBar'
import EnhancedMegaMenu from '@/components/navigation/EnhancedMegaMenu'
import { NavigationProvider } from '@/contexts/NavigationContext'
import {
  ArrowLeft,
  Calendar,
  Package,
  TrendingUp,
  Search,
  Filter,
  Grid3X3,
  List,
  X,
  Star,
  Layers
} from 'lucide-react'

interface SeriesData {
  series: string
  setCount: number
  totalCards: number
  firstReleaseDate: string
  lastReleaseDate: string
  sets: {
    id: string
    name: string
    symbol_url?: string | null
    logo_url?: string | null
    release_date: string
    total_cards: number
  }[]
}

function SeriesPageContent() {
  const { user } = useAuth()
  const router = useRouter()

  const [seriesData, setSeriesData] = useState<SeriesData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'name' | 'release_date' | 'set_count' | 'total_cards'>('release_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchSeriesData()
  }, [sortBy, sortOrder])

  const fetchSeriesData = async () => {
    try {
      setLoading(true)

      const { data: sets, error } = await supabase
        .from('sets')
        .select('*')
        .order('release_date', { ascending: false })

      if (error) {
        console.error('Error fetching sets:', error)
        setSeriesData([])
        return
      }

      // Group sets by series
      const seriesMap = new Map<string, SeriesData>()
      
      sets?.forEach(set => {
        const seriesName = set.series
        if (!seriesMap.has(seriesName)) {
          seriesMap.set(seriesName, {
            series: seriesName,
            setCount: 0,
            totalCards: 0,
            firstReleaseDate: set.release_date,
            lastReleaseDate: set.release_date,
            sets: []
          })
        }

        const seriesInfo = seriesMap.get(seriesName)!
        seriesInfo.setCount++
        seriesInfo.totalCards += set.total_cards || 0
        seriesInfo.sets.push({
          id: set.id,
          name: set.name,
          symbol_url: set.symbol_url,
          logo_url: set.logo_url,
          release_date: set.release_date,
          total_cards: set.total_cards
        })

        // Update date range
        if (set.release_date < seriesInfo.firstReleaseDate) {
          seriesInfo.firstReleaseDate = set.release_date
        }
        if (set.release_date > seriesInfo.lastReleaseDate) {
          seriesInfo.lastReleaseDate = set.release_date
        }
      })

      // Convert to array and sort
      let seriesArray = Array.from(seriesMap.values())
      
      // Sort each series' sets by release date
      seriesArray.forEach(series => {
        series.sets.sort((a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime())
      })

      // Sort series based on selected criteria
      seriesArray.sort((a, b) => {
        let aValue: any, bValue: any
        
        switch (sortBy) {
          case 'name':
            aValue = a.series.toLowerCase()
            bValue = b.series.toLowerCase()
            break
          case 'release_date':
            aValue = new Date(a.lastReleaseDate).getTime()
            bValue = new Date(b.lastReleaseDate).getTime()
            break
          case 'set_count':
            aValue = a.setCount
            bValue = b.setCount
            break
          case 'total_cards':
            aValue = a.totalCards
            bValue = b.totalCards
            break
          default:
            return 0
        }
        
        if (sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
        }
      })

      setSeriesData(seriesArray)
    } catch (error) {
      console.error('Error fetching series data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredSeries = seriesData.filter(series =>
    series.series.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const clearFilters = () => {
    setSearchQuery('')
    setSortBy('release_date')
    setSortOrder('desc')
  }

  return (
    <NavigationProvider>
      <div className="min-h-screen bg-pkmn-dark">
        {/* Main Navigation */}
        <MainNavBar />
        
        {/* Enhanced Mega Menu */}
        <div className="relative">
          <EnhancedMegaMenu />
        </div>

        {/* Page Header */}
        <header className="bg-pkmn-card border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Link href="/dashboard" className="flex items-center text-pokemon-gold hover:text-pokemon-gold-hover transition-colors">
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to dashboard
                </Link>
                <div className="h-6 w-px bg-gray-600"></div>
                <div>
                  <h1 className="text-xl font-bold text-white">Pokemon TCG Series</h1>
                  <p className="text-sm text-gray-400">Browse all Pokemon card series</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="text-sm text-gray-400">
                  {filteredSeries.length} series found
                </div>
                
                {/* View Mode Toggle */}
                <div className="flex items-center bg-pkmn-surface rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-pokemon-gold text-black' : 'text-gray-400 hover:text-white'}`}
                    title="Grid view"
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded ${viewMode === 'list' ? 'bg-pokemon-gold text-black' : 'text-gray-400 hover:text-white'}`}
                    title="List view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Search and Filters */}
          <div className="mb-6">
            <div className="flex flex-col lg:flex-row lg:items-start gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search series by name..."
                    className="input-gaming pl-10 w-full"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`btn-secondary flex items-center ${showFilters ? 'bg-pokemon-gold text-black' : ''}`}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </button>
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="card-container mb-6 animate-slide-up">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Filters</h3>
                <div className="flex items-center space-x-2">
                  <button onClick={clearFilters} className="btn-outline btn-sm">
                    Clear All
                  </button>
                  <button onClick={() => setShowFilters(false)} className="p-1 text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Sort By */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="input-gaming"
                  >
                    <option value="release_date">Latest Release</option>
                    <option value="name">Name</option>
                    <option value="set_count">Number of Sets</option>
                    <option value="total_cards">Total Cards</option>
                  </select>
                </div>

                {/* Sort Order */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Order</label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as any)}
                    className="input-gaming"
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Series Display */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-center">
                <div className="text-6xl mb-4 animate-bounce">📚</div>
                <h2 className="text-2xl font-bold text-white mb-4">Loading Series...</h2>
                <p className="text-gray-400">Preparing your series overview</p>
              </div>
            </div>
          ) : filteredSeries.length === 0 ? (
            <div className="card-container text-center py-20">
              <div className="text-4xl mb-4 opacity-50">📚</div>
              <h3 className="text-xl font-semibold text-white mb-2">No series found</h3>
              <p className="text-gray-400 mb-6">Try adjusting your search</p>
              <button onClick={clearFilters} className="btn-gaming">
                Clear Filters
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSeries.map((series) => (
                <Link
                  key={series.series}
                  href={`/sets?series=${encodeURIComponent(series.series)}`}
                  className="relative overflow-hidden rounded-lg border border-gray-700/50 hover:border-pokemon-gold/30 transition-all group bg-pkmn-card"
                >
                  {/* Background Image with Blur */}
                  {series.sets[0]?.logo_url && (
                    <div className="absolute inset-0">
                      <Image
                        src={series.sets[0].logo_url}
                        alt={`${series.series} background`}
                        fill
                        className="object-cover opacity-10 scale-110"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                      <div className="absolute inset-0 bg-pkmn-card/70 backdrop-blur-sm"></div>
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="relative p-6">
                    <div className="flex items-center space-x-4 mb-4">
                      {series.sets[0]?.symbol_url ? (
                        <div className="relative z-10">
                          <Image
                            src={series.sets[0].symbol_url}
                            alt={series.series}
                            width={48}
                            height={48}
                            className="rounded drop-shadow-lg"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-pokemon-gold/20 rounded flex items-center justify-center backdrop-blur-sm border border-pokemon-gold/30">
                          <Layers className="w-6 h-6 text-pokemon-gold" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-white group-hover:text-pokemon-gold transition-colors truncate drop-shadow-sm">
                          {series.series}
                        </h3>
                        <p className="text-sm text-gray-300 drop-shadow-sm">
                          {series.setCount} set{series.setCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-blue-400 drop-shadow-sm" />
                        <span className="text-gray-200 drop-shadow-sm">
                          {new Date(series.firstReleaseDate).getFullYear()} - {new Date(series.lastReleaseDate).getFullYear()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Package className="w-4 h-4 text-green-400 drop-shadow-sm" />
                        <span className="text-gray-200 drop-shadow-sm">{series.totalCards} cards</span>
                      </div>
                    </div>

                    {/* Preview of sets in series */}
                    <div className="border-t border-gray-600/50 pt-3">
                      <p className="text-xs text-gray-400 mb-2">Recent sets:</p>
                      <div className="flex flex-wrap gap-1">
                        {series.sets.slice(0, 3).map((set) => (
                          <span key={set.id} className="text-xs bg-pkmn-surface/50 px-2 py-1 rounded text-gray-300">
                            {set.name}
                          </span>
                        ))}
                        {series.sets.length > 3 && (
                          <span className="text-xs text-pokemon-gold">
                            +{series.sets.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="card-container overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Series</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Sets</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Total Cards</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-medium">Date Range</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSeries.map((series) => (
                    <tr key={series.series} className="border-b border-gray-800 hover:bg-pkmn-surface/30 transition-colors">
                      <td className="py-3 px-4">
                        <Link
                          href={`/sets?series=${encodeURIComponent(series.series)}`}
                          className="flex items-center space-x-3 hover:text-pokemon-gold transition-colors"
                        >
                          {series.sets[0]?.symbol_url ? (
                            <Image
                              src={series.sets[0].symbol_url}
                              alt={series.series}
                              width={32}
                              height={32}
                              className="rounded"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-pokemon-gold/20 rounded flex items-center justify-center">
                              <Layers className="w-4 h-4 text-pokemon-gold" />
                            </div>
                          )}
                          <span className="text-white font-medium">{series.series}</span>
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-300">{series.setCount}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-300">{series.totalCards}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-300">
                          {new Date(series.firstReleaseDate).getFullYear()} - {new Date(series.lastReleaseDate).getFullYear()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </NavigationProvider>
  )
}

export default function SeriesPage() {
  return (
    <ProtectedRoute>
      <SeriesPageContent />
    </ProtectedRoute>
  )
}