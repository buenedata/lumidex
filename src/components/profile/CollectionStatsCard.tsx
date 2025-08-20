'use client'

import { useState, Fragment, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CollectionStats } from '@/lib/collection-stats-service'
import { PriceGraph } from '@/components/pokemon/PriceGraph'
import { usePreferredCurrency } from '@/contexts/UserPreferencesContext'
import { currencyService, convertFromEuros, SupportedCurrency } from '@/lib/currency-service'
import { useI18n } from '@/contexts/I18nContext'
import { Tab } from '@headlessui/react'
import {
  BarChart3,
  TrendingUp,
  Trophy,
  Target,
  Calendar,
  Star,
  ChevronRight,
  PieChart,
  Activity,
  Sparkles,
  Eye
} from 'lucide-react'

interface CollectionStatsCardProps {
  stats: CollectionStats
  loading?: boolean
  onViewDetails?: (cardId: string) => void
}

export function CollectionStatsCard({ stats, loading = false, onViewDetails }: CollectionStatsCardProps) {
  const router = useRouter()
  const preferredCurrency = usePreferredCurrency()
  const { locale } = useI18n()
  const [convertedStats, setConvertedStats] = useState<CollectionStats | null>(null)

  const handleCardClick = (cardId: string, setId: string) => {
    router.push(`/sets/${setId}?cardId=${cardId}`)
  }

  // Convert EUR values to user's preferred currency
  useEffect(() => {
    const convertStats = async () => {
      if (!stats || preferredCurrency === 'EUR') {
        setConvertedStats(stats)
        return
      }

      try {
        // Convert main values
        const totalValue = await convertFromEuros(stats.totalValueEur, preferredCurrency as SupportedCurrency)
        const averageCardValue = await convertFromEuros(stats.averageCardValue, preferredCurrency as SupportedCurrency)

        // Convert rarity breakdown values
        const convertedRarityBreakdown: typeof stats.rarityBreakdown = {}
        for (const [rarity, data] of Object.entries(stats.rarityBreakdown)) {
          convertedRarityBreakdown[rarity] = {
            ...data,
            totalValue: await convertFromEuros(data.totalValue, preferredCurrency as SupportedCurrency)
          }
        }

        // Convert set progress values
        const convertedSetProgress = await Promise.all(
          stats.setProgress.map(async (set) => ({
            ...set,
            totalValue: await convertFromEuros(set.totalValue, preferredCurrency as SupportedCurrency)
          }))
        )

        // Convert recent additions values
        const convertedRecentAdditions = await Promise.all(
          stats.recentAdditions.map(async (card) => ({
            ...card,
            estimatedValue: await convertFromEuros(card.estimatedValue, preferredCurrency as SupportedCurrency)
          }))
        )

        // Convert top value cards
        const convertedTopValueCards = await Promise.all(
          stats.topValueCards.map(async (card) => ({
            ...card,
            unitValue: await convertFromEuros(card.unitValue, preferredCurrency as SupportedCurrency),
            totalValue: await convertFromEuros(card.totalValue, preferredCurrency as SupportedCurrency)
          }))
        )

        // Convert collection growth values
        const convertedCollectionGrowth = await Promise.all(
          stats.collectionGrowth.map(async (growth) => ({
            ...growth,
            totalValue: await convertFromEuros(growth.totalValue, preferredCurrency as SupportedCurrency)
          }))
        )

        setConvertedStats({
          ...stats,
          totalValueEur: totalValue, // Keep the field name for compatibility
          averageCardValue,
          rarityBreakdown: convertedRarityBreakdown,
          setProgress: convertedSetProgress,
          recentAdditions: convertedRecentAdditions,
          topValueCards: convertedTopValueCards,
          collectionGrowth: convertedCollectionGrowth
        })
      } catch (error) {
        console.error('Error converting currency:', error)
        setConvertedStats(stats) // Fallback to original stats
      }
    }

    convertStats()
  }, [stats, preferredCurrency])

  if (loading || !convertedStats) {
    return (
      <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded mb-4 w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-pkmn-surface/50 rounded-lg p-4">
                <div className="h-8 bg-gray-700 rounded mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const formatCurrency = (value: number) => {
    return currencyService.formatCurrency(value, preferredCurrency, locale)
  }

  const StatCard = ({
    icon: Icon,
    label,
    value,
    subValue,
    color = 'text-pokemon-gold',
    trend,
    gradient = 'from-pokemon-gold/10 to-pokemon-gold/5',
    onClick
  }: {
    icon: any
    label: string
    value: string | number
    subValue?: string
    color?: string
    trend?: 'up' | 'down' | 'stable'
    gradient?: string
    onClick?: () => void
  }) => (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${gradient} backdrop-blur-sm rounded-lg p-3 border border-gray-700/30 hover:border-pokemon-gold/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-pokemon-gold/10 min-h-[90px] flex flex-col group ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Animated Border Glow */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-pokemon-gold/20 via-transparent to-pokemon-gold/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
      
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between mb-2">
          <div className={`p-1.5 rounded bg-gradient-to-br from-pkmn-surface/80 to-pkmn-dark/80 border border-gray-600/30 group-hover:border-pokemon-gold/30 transition-colors duration-300`}>
            <Icon className={`w-4 h-4 ${color} flex-shrink-0 group-hover:scale-110 transition-transform duration-300`} />
          </div>
          {trend && (
            <div className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium backdrop-blur-sm border transition-all duration-300 ${
              trend === 'up' ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30' :
              trend === 'down' ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30' :
              'bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30'
            }`}>
              {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}
            </div>
          )}
        </div>
        
        <div className={`text-lg font-bold ${color} mb-1 leading-tight group-hover:scale-105 transition-transform duration-300`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        
        <div className="text-sm font-medium text-gray-300 mb-1 leading-tight">{label}</div>
        
        {subValue && (
          <div className="text-xs text-gray-500 leading-tight mt-auto bg-pkmn-dark/30 rounded px-1.5 py-0.5 border border-gray-700/30">
            {subValue}
          </div>
        )}
      </div>
    </div>
  )

  const OverviewView = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={BarChart3}
          label="Total Cards"
          value={convertedStats.totalCards}
          subValue={`${convertedStats.uniqueCards} unique`}
          color="text-pokemon-gold"
          gradient="from-pokemon-gold/15 via-pokemon-gold/10 to-pokemon-gold/5"
          trend="up"
        />
        <StatCard
          icon={TrendingUp}
          label="Collection Value"
          value={formatCurrency(convertedStats.totalValueEur)}
          subValue={`${formatCurrency(convertedStats.averageCardValue)} avg`}
          color="text-green-400"
          gradient="from-green-500/15 via-green-500/10 to-green-500/5"
          trend="up"
        />
        <StatCard
          icon={Star}
          label="Unique Cards"
          value={convertedStats.uniqueCards}
          subValue={`From ${convertedStats.setsWithCards} sets`}
          color="text-purple-400"
          gradient="from-purple-500/15 via-purple-500/10 to-purple-500/5"
        />
        <StatCard
          icon={Trophy}
          label="Most Valuable"
          value={formatCurrency(convertedStats.topValueCards[0]?.unitValue || 0)}
          subValue={convertedStats.topValueCards[0] ? `${convertedStats.topValueCards[0].cardName} (${convertedStats.topValueCards[0].setName})` : 'No cards'}
          color="text-yellow-400"
          gradient="from-yellow-500/15 via-yellow-500/10 to-yellow-500/5"
          onClick={convertedStats.topValueCards[0] && onViewDetails ? () => onViewDetails(convertedStats.topValueCards[0].cardId) : undefined}
        />
      </div>

      {/* Recent Additions */}
      {convertedStats.recentAdditions.length > 0 && (
        <div className="relative overflow-hidden bg-gradient-to-br from-pkmn-surface/30 via-pkmn-surface/20 to-pkmn-dark/30 rounded-lg p-3 border border-gray-700/30 backdrop-blur-sm">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-radial from-pokemon-gold/5 to-transparent opacity-50 blur-lg" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-gradient-to-br from-pokemon-gold/20 to-pokemon-gold/10 rounded border border-pokemon-gold/20 backdrop-blur-sm">
                  <Calendar className="w-4 h-4 text-pokemon-gold" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Recent Additions</h4>
                  <p className="text-xs text-gray-400">Latest cards added to your collection</p>
                </div>
              </div>
              <button className="group flex items-center space-x-1 text-xs font-medium text-white hover:text-gray-200 transition-all duration-200 bg-pokemon-gold/10 hover:bg-pokemon-gold/20 px-2 py-1 rounded border border-pokemon-gold/20 hover:border-pokemon-gold/40">
                <span>View All</span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform duration-200" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {convertedStats.recentAdditions.slice(0, 5).map((card, index) => (
                <div
                  key={`${card.cardId}-${index}`}
                  className="group relative overflow-hidden bg-gradient-to-br from-pkmn-surface/40 to-pkmn-dark/40 rounded p-2 text-center hover:from-pkmn-surface/60 hover:to-pkmn-dark/60 hover:scale-105 transition-all duration-300 cursor-pointer border border-gray-700/30 hover:border-pokemon-gold/40 hover:shadow-lg hover:shadow-pokemon-gold/10 backdrop-blur-sm"
                  onClick={() => handleCardClick(card.cardId, card.setId)}
                  title={`View ${card.cardName} details`}
                >
                  {/* Hover glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-pokemon-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  <div className="relative z-10">
                    <div className="relative mb-1">
                      <img
                        src={card.imageSmall}
                        alt={card.cardName}
                        className="w-full h-14 md:h-16 object-contain rounded shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:scale-105"
                      />
                      <div className="absolute -top-0.5 -right-0.5 bg-gradient-to-r from-pokemon-gold to-pokemon-gold-hover text-black text-xs font-bold px-1 py-0.5 rounded-full shadow border border-pokemon-gold-dark">
                        x{card.quantity}
                      </div>
                    </div>
                    <div className="text-xs text-white font-semibold truncate mb-0.5 group-hover:text-white transition-colors duration-300">
                      {card.cardName}
                    </div>
                    <div className="text-xs text-gray-400 truncate bg-pkmn-dark/30 rounded px-1 py-0.5">
                      {card.setName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const GrowthView = () => (
    <div className="space-y-6">
      <div className="bg-pkmn-surface/30 rounded-lg p-4">
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Activity className="w-4 h-4 mr-2 text-pokemon-gold" />
          Collection Growth
        </h4>
        {convertedStats.collectionGrowth.length > 0 ? (
          <PriceGraph
            cardId="collection-value"
            currentPrice={convertedStats.totalValueEur}
            cardName="Collection Value"
            isCollectionValue={true}
          />
        ) : (
          <div className="text-center py-8 text-gray-400">
            <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Not enough data to show growth trends</p>
          </div>
        )}
      </div>
    </div>
  )

  const SetsView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-white flex items-center">
          <Target className="w-4 h-4 mr-2 text-pokemon-gold" />
          Set Progress
        </h4>
        <div className="text-sm text-gray-400 bg-pkmn-surface/30 px-3 py-1 rounded-full">
          Optional: For set completionists
        </div>
      </div>
      <div className="bg-pkmn-surface/20 rounded-lg p-4 mb-4">
        <div className="text-sm text-gray-300 mb-2">
          <strong>Note:</strong> This view is designed for collectors focused on completing entire sets.
          Many collectors prefer focusing on specific cards, themes, or favorite Pokémon rather than set completion.
        </div>
        <div className="text-xs text-gray-400">
          Overall completion: {convertedStats.completionPercentage.toFixed(1)}% across all sets
        </div>
      </div>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {convertedStats.setProgress.slice(0, 10).map((set) => (
          <div key={set.setId} className="bg-pkmn-surface/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                {set.setSymbolUrl && (
                  <img
                    src={set.setSymbolUrl}
                    alt={set.setName}
                    className="w-6 h-6"
                  />
                )}
                <div>
                  <div className="text-white font-medium">{set.setName}</div>
                  <div className="text-xs text-gray-400">
                    {set.ownedCards}/{set.totalCards} cards
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-white font-bold">
                  {set.completionPercentage.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-400">
                  {formatCurrency(set.totalValue)}
                </div>
              </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-pokemon-gold to-pokemon-gold-hover h-2 rounded-full transition-all duration-300"
                style={{ width: `${set.completionPercentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const RarityView = () => (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
        <Star className="w-4 h-4 mr-2 text-pokemon-gold" />
        Rarity Breakdown
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          {Object.entries(convertedStats.rarityBreakdown)
            .sort(([,a], [,b]) => b.count - a.count)
            .map(([rarity, data]) => (
              <div key={rarity} className="bg-pkmn-surface/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium capitalize">{rarity}</span>
                  <span className="text-pokemon-gold font-bold">{data.count}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <span>{data.percentage.toFixed(1)}% of collection</span>
                  <span>{formatCurrency(data.totalValue)}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 rounded-full"
                    style={{ width: `${data.percentage}%` }}
                  />
                </div>
              </div>
            ))}
        </div>
        <div className="bg-pkmn-surface/30 rounded-lg p-4">
          <h5 className="text-white font-medium mb-3">Most Valuable Cards</h5>
          <div className="space-y-2">
            {convertedStats.topValueCards.slice(0, 5).map((card, index) => (
              <div
                key={`${card.cardId}-${index}`}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-pkmn-surface/50 transition-all duration-200 cursor-pointer"
                onClick={() => handleCardClick(card.cardId, card.setId)}
                title={`View ${card.cardName} details`}
              >
                <img
                  src={card.imageSmall}
                  alt={card.cardName}
                  className="w-8 h-10 object-contain rounded"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {card.cardName}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {card.setName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-400">
                    {formatCurrency(card.unitValue)}
                  </div>
                  <div className="text-xs text-gray-400">
                    x{card.quantity}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-pkmn-card via-pkmn-card to-pkmn-surface rounded-lg p-4 border border-gray-700/30 shadow-lg shadow-black/10">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-pokemon-gold/2 via-transparent to-purple-500/2 opacity-50" />
      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-radial from-pokemon-gold/5 to-transparent opacity-30 blur-xl" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-gradient-to-br from-pokemon-gold/20 to-pokemon-gold/10 rounded border border-pokemon-gold/20 backdrop-blur-sm">
              <BarChart3 className="w-4 h-4 text-pokemon-gold" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Collection Statistics
              </h3>
              <p className="text-xs text-gray-400">
                Track your collection progress and value
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Last updated</div>
            <div className="text-xs text-gray-300 font-medium bg-pkmn-surface/50 px-2 py-0.5 rounded border border-gray-600/30">
              {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>

        <Tab.Group>
          <Tab.List className="flex space-x-1 rounded-lg bg-gradient-to-r from-pkmn-surface/80 to-pkmn-dark/80 p-1 mb-4 backdrop-blur-sm border border-gray-600/30">
            {[
              { key: 'overview', label: 'Overview', icon: BarChart3, color: 'text-pokemon-gold' },
              { key: 'rarity', label: 'Rarity', icon: Star, color: 'text-purple-400' },
              { key: 'growth', label: 'Growth', icon: TrendingUp, color: 'text-green-400' },
              { key: 'sets', label: 'Set Progress', icon: Target, color: 'text-blue-400' }
            ].map(({ key, label, icon: Icon, color }) => (
              <Tab
                key={key}
                className={({ selected }) =>
                  `relative w-full rounded-lg py-2 px-3 text-sm font-semibold leading-5 transition-all duration-300 focus:outline-none group ${
                    selected
                      ? 'bg-gradient-to-r from-pokemon-gold to-pokemon-gold-hover text-black shadow-md shadow-pokemon-gold/20 transform scale-102'
                      : 'text-gray-300 hover:bg-gray-600/30 hover:text-white hover:scale-101'
                  }`
                }
              >
                {({ selected }) => (
                  <>
                    {selected && (
                      <div className="absolute inset-0 bg-gradient-to-r from-pokemon-gold/15 to-pokemon-gold-hover/15 rounded-lg blur-sm" />
                    )}
                    <div className="relative flex items-center justify-center space-x-1.5">
                      <Icon className={`w-4 h-4 transition-transform duration-300 ${selected ? 'text-black scale-105' : `${color} group-hover:scale-105`}`} />
                      <span className="hidden sm:inline text-xs">{label}</span>
                    </div>
                  </>
                )}
              </Tab>
            ))}
          </Tab.List>

          <Tab.Panels>
            <Tab.Panel className="focus:outline-none">
              <OverviewView />
            </Tab.Panel>
            <Tab.Panel className="focus:outline-none">
              <RarityView />
            </Tab.Panel>
            <Tab.Panel className="focus:outline-none">
              <GrowthView />
            </Tab.Panel>
            <Tab.Panel className="focus:outline-none">
              <SetsView />
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>
    </div>
  )
}