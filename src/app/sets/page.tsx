'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
  Grid3X3,
  X,
  Star
} from 'lucide-react'

interface SetData {
  id: string
  name: string
  series: string
  total_cards: number
  release_date: string
  symbol_url?: string | null
  logo_url?: string | null
  ptcgo_code?: string | null
}

function SetsPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const seriesFilter = searchParams.get('series')

  const [sets, setSets] = useState<SetData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSeries, setSelectedSeries] = useState(seriesFilter || '')
  const [availableSeries, setAvailableSeries] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'grid'>('grid')
  const [sortBy, setSortBy] = useState<'name' | 'release_date' | 'total_cards'>('release_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    fetchSets()
    fetchAvailableSeries()
  }, [selectedSeries, sortBy, sortOrder])

  const fetchSets = async () => {
    try {
      setLoading(true)

      let query = supabase
        .from('sets')
        .select('*')

      if (selectedSeries) {
        query = query.eq('series', selectedSeries)
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })

      const { data, error } = await query

      if (error) {
        console.error('Error fetching sets:', error)
        setSets([])
      } else {
        setSets(data || [])
      }
    } catch (error) {
      console.error('Error fetching sets:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableSeries = async () => {
    try {
      const { data, error } = await supabase
        .from('sets')
        .select('series')

      if (error) {
        console.error('Error fetching series:', error)
      } else {
        const uniqueSeries = new Set(data?.map(set => set.series) || [])
        const seriesArray = Array.from(uniqueSeries).sort()
        setAvailableSeries(seriesArray)
      }
    } catch (error) {
      console.error('Error fetching series:', error)
    }
  }

  const filteredSets = sets.filter(set =>
    set.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    set.series.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedSeries('')
    setSortBy('release_date')
    setSortOrder('desc')
    router.push('/sets')
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
          <div className="flex justify-between items-center h-16 relative">
            <div className="flex items-center space-x-4">
              <Link href="/series" className="flex items-center text-white hover:text-pokemon-gold transition-colors">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Series
              </Link>
              {!selectedSeries && (
                <>
                  <div className="h-6 w-px bg-gray-600"></div>
                  <div>
                    <h1 className="text-xl font-bold text-white">All Sets</h1>
                  </div>
                </>
              )}
            </div>
            
            {selectedSeries && (
              <div className="absolute left-1/2 transform -translate-x-1/2 text-center">
                <h1 className="text-xl font-bold text-white">
                  {selectedSeries} Sets
                </h1>
                <p className="text-sm text-gray-400">Browse sets in {selectedSeries}</p>
              </div>
            )}
            
            <div className="flex items-center space-x-3">
              <div className="text-sm text-gray-400">
                {filteredSets.length} sets found
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
                  placeholder="Search sets by name or series..."
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

          </div>
        </div>


        {/* Sets Display */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <div className="text-6xl mb-4 animate-bounce">📦</div>
              <h2 className="text-2xl font-bold text-white mb-4">Loading Sets...</h2>
              <p className="text-gray-400">Preparing your sets</p>
            </div>
          </div>
        ) : filteredSets.length === 0 ? (
          <div className="card-container text-center py-20">
            <div className="text-4xl mb-4 opacity-50">📦</div>
            <h3 className="text-xl font-semibold text-white mb-2">No sets found</h3>
            <p className="text-gray-400 mb-6">Try adjusting your search or filters</p>
            <button onClick={clearFilters} className="btn-gaming">
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredSets.map((set) => (
              <Link
                key={set.id}
                href={`/sets/${set.id}`}
                className="relative overflow-hidden rounded-lg border border-gray-700/50 hover:border-yellow-400/30 transition-all group bg-pkmn-card"
              >
                {/* Background Image with Blur */}
                {set.logo_url && (
                  <div className="absolute inset-0">
                    <Image
                      src={set.logo_url}
                      alt={`${set.name} background`}
                      fill
                      className="object-cover opacity-15 scale-110"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    />
                    <div className="absolute inset-0 bg-pkmn-card/60 backdrop-blur-[2px]"></div>
                  </div>
                )}
                
                {/* Content */}
                <div className="relative p-6">
                  <div className="flex items-center space-x-4 mb-4">
                    {set.symbol_url ? (
                      <div className="relative z-10">
                        <Image
                          src={set.symbol_url}
                          alt={set.name}
                          width={48}
                          height={48}
                          className="rounded drop-shadow-lg"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-pokemon-gold/20 rounded flex items-center justify-center backdrop-blur-sm border border-pokemon-gold/30">
                        <Package className="w-6 h-6 text-pokemon-gold" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white group-hover:text-yellow-400 transition-colors truncate drop-shadow-sm">
                        {set.name}
                      </h3>
                      <p className="text-sm text-gray-300 drop-shadow-sm">{set.series}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-blue-400 drop-shadow-sm" />
                      <span className="text-gray-200 drop-shadow-sm">
                        {new Date(set.release_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Package className="w-4 h-4 text-green-400 drop-shadow-sm" />
                      <span className="text-gray-200 drop-shadow-sm">{set.total_cards} cards</span>
                    </div>
                  </div>

                  {set.ptcgo_code && (
                    <div className="mt-3 flex items-center space-x-2">
                      <Star className="w-4 h-4 text-yellow-400 drop-shadow-sm" />
                      <span className="text-sm text-gray-200 drop-shadow-sm">PTCGO: {set.ptcgo_code}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
        </div>
      </div>
    </NavigationProvider>
  )
}

export default function SetsPage() {
  return (
    <ProtectedRoute>
      <SetsPageContent />
    </ProtectedRoute>
  )
}