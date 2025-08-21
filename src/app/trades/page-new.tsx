'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navigation from '@/components/navigation/Navigation'
import { Tab } from '@headlessui/react'
import Link from 'next/link'
import Image from 'next/image'
import { useTradeCounts, useTradesChunk } from '@/hooks/useSimpleData'
import {
  Users,
  Heart,
  TrendingUp,
  Filter,
  Trophy,
  Target,
  Gift,
  MessageCircle,
  ArrowRightLeft,
  ShoppingCart,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Package
} from 'lucide-react'

function TradingContent() {
  const { user } = useAuth()
  const [selectedTab, setSelectedTab] = useState(0)

  // Use new simplified data hooks
  const { 
    data: tradeCounts, 
    loading: countsLoading, 
    error: countsError,
    fromCache: countsFromCache
  } = useTradeCounts(user?.id || null)

  const { 
    data: activeTrades, 
    loading: activeLoading, 
    error: activeError
  } = useTradesChunk(user?.id || null, { 
    status: selectedTab === 0 ? undefined : (selectedTab === 1 ? 'pending' : 'accepted'),
    limit: 20 
  })

  const { 
    data: tradeHistory, 
    loading: historyLoading 
  } = useTradesChunk(user?.id || null, { 
    status: 'completed',
    limit: 10 
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'declined':
        return <XCircle className="w-4 h-4 text-red-400" />
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-gray-400" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-400'
      case 'accepted':
        return 'text-green-400'
      case 'completed':
        return 'text-green-400'
      case 'declined':
        return 'text-red-400'
      case 'cancelled':
        return 'text-gray-400'
      default:
        return 'text-gray-400'
    }
  }

  const isLoading = countsLoading || activeLoading

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
          <ArrowRightLeft className="w-8 h-8 mr-3 text-pokemon-gold" />
          Trading Center
        </h1>
        <p className="text-gray-400 text-lg">
          Manage your trades and discover trading opportunities
        </p>
      </div>

      {/* Cache and Error Indicators */}
      {countsFromCache && (
        <div className="mb-4 text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm">
            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></span>
            Trade data loaded from cache - refreshing in background
          </div>
        </div>
      )}

      {(countsError || activeError) && (
        <div className="mb-6 bg-red-900/50 border border-red-700 rounded-xl p-4">
          <div className="flex items-center">
            <div className="text-red-400 mr-3">⚠️</div>
            <div>
              <h3 className="text-sm font-medium text-red-300">Loading Error</h3>
              <div className="mt-1 text-sm text-red-400">
                {countsError || activeError}
              </div>
              <div className="mt-2 text-xs text-red-300">Showing fallback data</div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-pkmn-card rounded-xl p-4 border border-gray-700/50 animate-pulse">
                <div className="h-8 bg-gray-700 rounded mb-2"></div>
                <div className="h-4 bg-gray-700 rounded"></div>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="bg-gradient-to-br from-pkmn-card to-pkmn-surface rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-pokemon-gold">
                    {tradeCounts?.total || 0}
                  </div>
                  <div className="text-sm text-gray-400">Total Trades</div>
                </div>
                <ArrowRightLeft className="w-8 h-8 text-pokemon-gold/60" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-pkmn-card to-pkmn-surface rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {tradeCounts?.pending || 0}
                  </div>
                  <div className="text-sm text-gray-400">Pending</div>
                </div>
                <Clock className="w-8 h-8 text-yellow-400/60" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-pkmn-card to-pkmn-surface rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-blue-400">
                    {tradeCounts?.active || 0}
                  </div>
                  <div className="text-sm text-gray-400">Active</div>
                </div>
                <Package className="w-8 h-8 text-blue-400/60" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-pkmn-card to-pkmn-surface rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-400">
                    {tradeCounts?.completed || 0}
                  </div>
                  <div className="text-sm text-gray-400">Completed</div>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400/60" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
        <Tab.List className="flex space-x-1 rounded-xl bg-pkmn-surface p-1 mb-8">
          <Tab
            className={({ selected }) =>
              `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all duration-200 ${
                selected
                  ? 'bg-pokemon-gold text-white shadow'
                  : 'text-gray-400 hover:bg-pkmn-card hover:text-white'
              }`
            }
          >
            <div className="flex items-center justify-center space-x-2">
              <Heart className="w-4 h-4" />
              <span>Discover</span>
            </div>
          </Tab>
          <Tab
            className={({ selected }) =>
              `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all duration-200 ${
                selected
                  ? 'bg-pokemon-gold text-white shadow'
                  : 'text-gray-400 hover:bg-pkmn-card hover:text-white'
              }`
            }
          >
            <div className="flex items-center justify-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Active Trades</span>
              {tradeCounts && tradeCounts.active > 0 && (
                <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {tradeCounts.active}
                </span>
              )}
            </div>
          </Tab>
          <Tab
            className={({ selected }) =>
              `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all duration-200 ${
                selected
                  ? 'bg-pokemon-gold text-white shadow'
                  : 'text-gray-400 hover:bg-pkmn-card hover:text-white'
              }`
            }
          >
            <div className="flex items-center justify-center space-x-2">
              <RefreshCw className="w-4 h-4" />
              <span>History</span>
              {tradeCounts && tradeCounts.completed > 0 && (
                <span className="bg-gray-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {tradeCounts.completed}
                </span>
              )}
            </div>
          </Tab>
        </Tab.List>

        <Tab.Panels>
          {/* Discover Panel */}
          <Tab.Panel>
            <div className="text-center py-12">
              <div className="text-6xl mb-4 opacity-50">💝</div>
              <h3 className="text-xl font-medium text-gray-300 mb-2">Trading Discovery Coming Soon</h3>
              <p className="text-gray-500 mb-4">Enhanced wishlist matching and trading opportunities will be available soon!</p>
              <div className="flex justify-center space-x-4">
                <Link href="/wishlist" className="btn-gaming">
                  Manage Wishlist
                </Link>
                <Link href="/friends" className="btn-gaming-outline">
                  Find Friends
                </Link>
              </div>
            </div>
          </Tab.Panel>

          {/* Active Trades Panel */}
          <Tab.Panel>
            <div className="space-y-6">
              {activeLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50 animate-pulse">
                      <div className="h-6 bg-gray-700 rounded mb-4"></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-700 rounded"></div>
                          <div className="h-16 bg-gray-700 rounded"></div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-700 rounded"></div>
                          <div className="h-16 bg-gray-700 rounded"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : activeTrades && activeTrades.length > 0 ? (
                <div className="space-y-4">
                  {activeTrades.map((trade: any) => (
                    <div key={trade.id} className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(trade.status)}
                            <span className={`text-sm font-medium ${getStatusColor(trade.status)}`}>
                              {trade.status.charAt(0).toUpperCase() + trade.status.slice(1)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-400">
                            {new Date(trade.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-sm text-gray-400">
                          Trade #{trade.id.slice(0, 8)}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-2">
                            Initiator: {trade.initiator?.display_name || trade.initiator?.username || 'Unknown'}
                          </h4>
                          <div className="bg-pkmn-surface/30 rounded-lg p-3">
                            <div className="text-sm text-gray-400">Trade details...</div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-2">
                            Recipient: {trade.recipient?.display_name || trade.recipient?.username || 'Unknown'}
                          </h4>
                          <div className="bg-pkmn-surface/30 rounded-lg p-3">
                            <div className="text-sm text-gray-400">Trade details...</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4 opacity-50">⏳</div>
                  <h3 className="text-xl font-medium text-gray-300 mb-2">No active trades</h3>
                  <p className="text-gray-500">You don't have any pending or accepted trades.</p>
                </div>
              )}
            </div>
          </Tab.Panel>

          {/* History Panel */}
          <Tab.Panel>
            <div className="space-y-6">
              {historyLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50 animate-pulse opacity-75">
                      <div className="h-6 bg-gray-700 rounded mb-4"></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-700 rounded"></div>
                          <div className="h-16 bg-gray-700 rounded"></div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-700 rounded"></div>
                          <div className="h-16 bg-gray-700 rounded"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : tradeHistory && tradeHistory.length > 0 ? (
                <div className="space-y-4">
                  {tradeHistory.map((trade: any) => (
                    <div key={trade.id} className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50 opacity-75">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(trade.status)}
                            <span className={`text-sm font-medium ${getStatusColor(trade.status)}`}>
                              {trade.status.charAt(0).toUpperCase() + trade.status.slice(1)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-400">
                            {new Date(trade.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-sm text-gray-400">
                          Trade #{trade.id.slice(0, 8)}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-2">
                            {trade.initiator_id === user?.id ? 'You offered' : `${trade.initiator?.display_name || trade.initiator?.username} offered`}
                          </h4>
                          <div className="bg-pkmn-surface/20 rounded-lg p-3">
                            <div className="text-sm text-gray-400">Trade history details...</div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-2">
                            {trade.recipient_id === user?.id ? 'You traded away' : `${trade.recipient?.display_name || trade.recipient?.username} traded away`}
                          </h4>
                          <div className="bg-pkmn-surface/20 rounded-lg p-3">
                            <div className="text-sm text-gray-400">Trade history details...</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4 opacity-50">📜</div>
                  <h3 className="text-xl font-medium text-gray-300 mb-2">No trade history</h3>
                  <p className="text-gray-500">You haven't completed any trades yet.</p>
                </div>
              )}
            </div>
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  )
}

export default function TradingPage() {
  return (
    <ProtectedRoute>
      <Navigation>
        <TradingContent />
      </Navigation>
    </ProtectedRoute>
  )
}
