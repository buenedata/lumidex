'use client'

import Image from 'next/image'
import { BarChart3, Package2, Coins, Star, Calendar } from 'lucide-react'
import type { CollectionStats } from '@/types/domains/collection'
import { PriceDisplay } from '@/components/PriceDisplay'

interface CollectionStatisticsPanelProps {
  stats: CollectionStats | null
  preferredCurrency: string
  locale: string
  onViewDetails: (cardId: string) => void
}

export function CollectionStatisticsPanel({
  stats,
  preferredCurrency,
  locale,
  onViewDetails
}: CollectionStatisticsPanelProps) {
  const formatPrice = (price: number | null | undefined) => {
    if (!price) return 'N/A'
    
    return (
      <PriceDisplay
        amount={price}
        currency="EUR"
        showConversion={true}
        showOriginal={false}
        size="lg"
        className="text-green-400 font-bold"
      />
    )
  }

  if (!stats) {
    return (
      <div className="bg-pkmn-card rounded-xl p-8 border border-gray-700/50 text-center">
        <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
        <h3 className="text-xl font-semibold text-gray-400 mb-2">No Statistics Available</h3>
        <p className="text-gray-500">Start adding cards to see your collection statistics.</p>
      </div>
    )
  }

  return (
    <>
      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-400">Total Cards</h3>
              <div className="text-2xl font-bold text-white">{stats.totalCards}</div>
              <p className="text-xs text-gray-500">{stats.uniqueCards} unique cards</p>
            </div>
            <Package2 className="w-8 h-8 text-pokemon-gold" />
          </div>
        </div>

        <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-400">Collection Value</h3>
              <div className="text-2xl font-bold text-green-400">
                {formatPrice(stats.totalValueEur)}
              </div>
              <p className="text-xs text-gray-500">Market prices</p>
            </div>
            <Coins className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-400">Rarity Breakdown</h3>
              <div className="space-y-1 mt-2">
                {Object.entries(stats.rarityBreakdown).slice(0, 3).map(([rarity, count]) => (
                  <div key={rarity} className="flex justify-between text-sm">
                    <span className="capitalize text-gray-300">{rarity}</span>
                    <span className="text-white">{(count as any).count || count}</span>
                  </div>
                ))}
              </div>
            </div>
            <Star className="w-8 h-8 text-purple-400" />
          </div>
        </div>

        <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-400">Recent Additions</h3>
              <div className="text-2xl font-bold text-blue-400">{stats.recentAdditions.length}</div>
              <p className="text-xs text-gray-500">Last 10 cards added</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-semibold text-white mb-4">Collection Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Rarity Distribution */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-3">Rarity Distribution</h4>
            <div className="space-y-2">
              {Object.entries(stats.rarityBreakdown).map(([rarity, count]) => {
                const countValue = (count as any).count || (count as unknown as number);
                return (
                  <div key={rarity} className="flex items-center justify-between">
                    <span className="capitalize text-gray-300">{rarity}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-pokemon-gold h-2 rounded-full"
                          style={{ width: `${(countValue / stats.totalCards) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-white text-sm w-8 text-right">{countValue}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-3">Recent Activity</h4>
            <div className="space-y-2">
              {stats.recentAdditions.slice(0, 5).map((addition: any, index) => (
                <div key={index} className="flex items-center space-x-3 p-2 bg-pkmn-surface rounded-lg hover:bg-pkmn-card transition-colors">
                  {/* Card Image */}
                  {addition.card?.imageSmall && (
                    <div className="flex-shrink-0">
                      <Image
                        src={addition.card.imageSmall}
                        alt={addition.card.name || 'Card'}
                        width={32}
                        height={44}
                        className="rounded border border-gray-600"
                      />
                    </div>
                  )}
                  
                  {/* Card Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col">
                      <button
                        onClick={() => addition.cardId && onViewDetails(addition.cardId)}
                        className="text-left text-sm text-white hover:text-yellow-400 transition-colors truncate"
                      >
                        {addition.card?.name || 'Unknown Card'}
                      </button>
                      <button
                        onClick={() => addition.cardId && onViewDetails(addition.cardId)}
                        className="text-left text-xs text-gray-400 hover:text-yellow-400 transition-colors truncate"
                      >
                        {addition.card?.setName || 'Unknown Set'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Date */}
                  <span className="text-gray-500 text-xs flex-shrink-0">
                    {addition.dateAdded ?
                      new Date(addition.dateAdded).toLocaleDateString() :
                      'Unknown date'
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}