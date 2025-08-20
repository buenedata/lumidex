'use client'

import { useState, Fragment } from 'react'
import { AchievementStats, AchievementProgress } from '@/lib/achievement-service'
import { Tab, Disclosure, Transition } from '@headlessui/react'
import {
  Trophy,
  Star,
  Users,
  ArrowLeftRight,
  Zap,
  Target,
  ChevronRight,
  Lock,
  CheckCircle,
  ChevronDown,
  Sparkles
} from 'lucide-react'

interface AchievementsCardProps {
  stats: AchievementStats
  progress: AchievementProgress[]
  loading?: boolean
}

// Helper function to format progress values with appropriate decimal places
const formatProgressValue = (value: number): string => {
  if (value === Math.floor(value)) {
    // If it's a whole number, show no decimals
    return value.toString()
  } else if (value >= 10) {
    // For values >= 10, show 1 decimal place max
    return value.toFixed(1).replace(/\.0$/, '')
  } else {
    // For values < 10, show 2 decimal places max
    return value.toFixed(2).replace(/\.?0+$/, '')
  }
}

export function AchievementsCard({ stats, progress, loading = false }: AchievementsCardProps) {
  if (loading) {
    return (
      <div className="bg-pkmn-card rounded-xl p-4 md:p-6 border border-gray-700/50 shadow-xl">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded mb-4 w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-pkmn-surface/50 rounded-lg p-4">
                <div className="h-8 bg-gray-700 rounded mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-2/3"></div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'collection': return Trophy
      case 'social': return Users
      case 'trading': return ArrowLeftRight
      case 'special': return Star
      default: return Target
    }
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'text-gray-400 bg-gray-500/20 border-gray-500/30'
      case 'rare': return 'text-blue-400 bg-blue-500/20 border-blue-500/30'
      case 'epic': return 'text-purple-400 bg-purple-500/20 border-purple-500/30'
      case 'legendary': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30'
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'collection': return {
        text: 'text-blue-400',
        bg: 'bg-blue-500/20',
        border: 'border-blue-500/30',
        gradient: 'from-blue-400 to-blue-500'
      }
      case 'social': return {
        text: 'text-purple-400',
        bg: 'bg-purple-500/20',
        border: 'border-purple-500/30',
        gradient: 'from-purple-400 to-purple-500'
      }
      case 'trading': return {
        text: 'text-green-400',
        bg: 'bg-green-500/20',
        border: 'border-green-500/30',
        gradient: 'from-green-400 to-green-500'
      }
      case 'special': return {
        text: 'text-yellow-400',
        bg: 'bg-yellow-500/20',
        border: 'border-yellow-500/30',
        gradient: 'from-yellow-400 to-yellow-500'
      }
      default: return {
        text: 'text-pokemon-gold',
        bg: 'bg-pokemon-gold/20',
        border: 'border-pokemon-gold/30',
        gradient: 'from-pokemon-gold to-pokemon-gold-hover'
      }
    }
  }

  const categories = [
    { key: 'all', label: 'All', icon: Target },
    { key: 'collection', label: 'Collection', icon: Trophy },
    { key: 'social', label: 'Social', icon: Users },
    { key: 'trading', label: 'Trading', icon: ArrowLeftRight },
    { key: 'special', label: 'Special', icon: Star }
  ]

  const AchievementItem = ({ achievement }: { achievement: AchievementProgress }) => {
    const Icon = getCategoryIcon(achievement.definition.category)
    const rarityClasses = getRarityColor(achievement.definition.rarity)
    const categoryColors = getCategoryColor(achievement.definition.category)

    return (
      <div className={`rounded-lg p-3 border transition-all duration-200 ${
        achievement.unlocked
          ? `${categoryColors.border} ${categoryColors.bg}`
          : 'bg-pkmn-surface/30 border-gray-700/50 hover:border-gray-600'
      }`}>
        <div className="flex items-start space-x-3">
          {/* Achievement Icon */}
          <div className={`p-2 rounded-lg flex-shrink-0 ${
            achievement.unlocked
              ? `${categoryColors.bg} ${categoryColors.text}`
              : 'bg-gray-700/50 text-gray-500'
          }`}>
            {achievement.unlocked ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <Lock className="w-5 h-5" />
            )}
          </div>

          {/* Achievement Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1 flex-wrap">
              <h4 className={`font-medium text-sm ${
                achievement.unlocked ? categoryColors.text : 'text-gray-300'
              }`}>
                {achievement.definition.name}
              </h4>
              <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${rarityClasses}`}>
                {achievement.definition.rarity.charAt(0).toUpperCase() + achievement.definition.rarity.slice(1)}
              </span>
              <Icon className="w-3 h-3 text-gray-400" />
            </div>
            
            <p className="text-xs text-gray-400 mb-2 line-clamp-2">
              {achievement.definition.description}
            </p>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">
                  {formatProgressValue(achievement.current)}/{formatProgressValue(achievement.required)}
                </span>
                <span className="font-medium text-white">
                  {achievement.percentage.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-700/50 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    achievement.unlocked
                      ? `bg-gradient-to-r ${categoryColors.gradient} opacity-90`
                      : 'bg-gradient-to-r from-pokemon-gold/80 to-pokemon-gold-hover/80'
                  }`}
                  style={{ width: `${Math.min(achievement.percentage, 100)}%` }}
                />
              </div>
            </div>

            {/* Points */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center space-x-1">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span className="text-xs text-yellow-400 font-medium">
                  {achievement.definition.points} pts
                </span>
              </div>
              {achievement.unlocked && (
                <div className={`text-xs font-medium ${categoryColors.text}`}>
                  ✓ Unlocked
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-pkmn-card rounded-xl p-4 border border-gray-700/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-white flex items-center">
          <Trophy className="w-5 h-5 mr-2 text-pokemon-gold" />
          Achievements
        </h3>
        <div className="text-sm text-gray-400">
          {stats.unlockedAchievements}/{stats.totalAchievements} unlocked
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-gradient-to-br from-pkmn-surface to-pkmn-dark rounded-lg p-2 border border-gray-700/30">
          <div className="flex items-center justify-between mb-1">
            <Trophy className="w-4 h-4 text-pokemon-gold" />
          </div>
          <div className="text-lg font-bold text-pokemon-gold mb-0.5">
            {stats.unlockedAchievements}
          </div>
          <div className="text-xs text-gray-400">Unlocked</div>
          <div className="text-xs text-gray-500">
            {stats.completionPercentage.toFixed(0)}% complete
          </div>
        </div>

        <div className="bg-gradient-to-br from-pkmn-surface to-pkmn-dark rounded-lg p-2 border border-gray-700/30">
          <div className="flex items-center justify-between mb-1">
            <Zap className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-lg font-bold text-yellow-400 mb-0.5">
            {stats.totalPoints}
          </div>
          <div className="text-xs text-gray-400">Points</div>
        </div>

        <div className="bg-gradient-to-br from-pkmn-surface to-pkmn-dark rounded-lg p-2 border border-gray-700/30">
          <div className="flex items-center justify-between mb-1">
            <Trophy className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-lg font-bold text-blue-400 mb-0.5">
            {stats.categoryStats.collection.unlocked}/{stats.categoryStats.collection.total}
          </div>
          <div className="text-xs text-gray-400">Collection</div>
        </div>

        <div className="bg-gradient-to-br from-pkmn-surface to-pkmn-dark rounded-lg p-2 border border-gray-700/30">
          <div className="flex items-center justify-between mb-1">
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-purple-400 mb-0.5">
            {stats.categoryStats.social.unlocked}/{stats.categoryStats.social.total}
          </div>
          <div className="text-xs text-gray-400">Social</div>
        </div>
      </div>

      {/* Category Filter */}
      <Tab.Group>
        <Tab.List className="flex space-x-1 rounded-xl bg-pkmn-surface p-1 mb-4">
          {categories.map(({ key, label, icon: Icon }) => (
            <Tab
              key={key}
              className={({ selected }) =>
                `w-full rounded-lg py-2 px-2 text-xs font-medium leading-5 transition-all duration-200 focus:outline-none ${
                  selected
                    ? 'bg-pokemon-gold text-white'
                    : 'text-gray-300 hover:bg-gray-600/50 hover:text-white'
                }`
              }
            >
              <div className="flex items-center justify-center space-x-1">
                <Icon className="w-3 h-3" />
                <span className="text-xs">{label}</span>
                {key !== 'all' && (
                  <span className="px-1 py-0.5 text-xs rounded-full bg-black/20 min-w-[16px] text-center">
                    {stats.categoryStats[key as keyof typeof stats.categoryStats]?.unlocked || 0}
                  </span>
                )}
              </div>
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels>
          {categories.map(({ key }) => {
            const filteredProgress = key === 'all'
              ? progress
              : progress.filter(p => p.definition.category === key)

            return (
              <Tab.Panel key={key} className="focus:outline-none">
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {filteredProgress.length > 0 ? (
                    filteredProgress
                      .sort((a: AchievementProgress, b: AchievementProgress) => {
                        // Sort by unlocked status first, then by progress
                        if (a.unlocked !== b.unlocked) {
                          return a.unlocked ? -1 : 1
                        }
                        return b.percentage - a.percentage
                      })
                      .map((achievement: AchievementProgress) => (
                        <AchievementItem
                          key={achievement.achievement_type}
                          achievement={achievement}
                        />
                      ))
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No achievements in this category</p>
                    </div>
                  )}
                </div>
              </Tab.Panel>
            )
          })}
        </Tab.Panels>
      </Tab.Group>

      {/* Recent Achievements */}
      {stats.recentAchievements.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-700">
          <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
            <Star className="w-4 h-4 mr-2 text-pokemon-gold" />
            Recent Achievements
          </h4>
          <div className="space-y-2">
            {stats.recentAchievements.slice(0, 3).map((achievement) => {
              const definition = progress.find(p => p.achievement_type === achievement.achievement_type)?.definition
              if (!definition) return null

              return (
                <div key={achievement.id} className="flex items-center space-x-3 bg-pkmn-surface/20 rounded-lg p-3">
                  <div className="p-2 bg-pokemon-gold/20 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-pokemon-gold" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">
                      {definition.name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(achievement.unlocked_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-xs text-yellow-400 font-medium">
                    +{definition.points} pts
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}