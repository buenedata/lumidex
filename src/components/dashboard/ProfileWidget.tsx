'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { profileService, ProfileData } from '@/lib/profile-service'
import {
  User,
  ArrowRight,
  TrendingUp,
  Trophy,
  Star,
  BarChart3,
  Eye,
  Settings,
  ChevronRight
} from 'lucide-react'

interface ProfileWidgetProps {
  className?: string
}

export function ProfileWidget({ className = '' }: ProfileWidgetProps) {
  const { user } = useAuth()
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfileData = useCallback(async () => {
    if (!user) return

    try {
      const result = await profileService.getProfileData(user.id)
      if (result.success && result.data) {
        setProfileData(result.data)
      }
    } catch (error) {
      console.error('Error loading profile data:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadProfileData()
    }
  }, [user, loadProfileData])

  if (!user || loading) {
    return (
      <div className={`bg-pkmn-card rounded-xl p-6 border border-gray-700/50 ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 bg-gray-700 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-12 bg-gray-700 rounded"></div>
            <div className="h-12 bg-gray-700 rounded"></div>
            <div className="h-12 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  const stats = useMemo(() => profileData?.collectionStats, [profileData?.collectionStats])
  const achievements = useMemo(() => profileData?.achievementStats, [profileData?.achievementStats])

  const displayName = useMemo(() =>
    profileData?.profile.display_name || profileData?.profile.username || user?.email?.split('@')[0],
    [profileData?.profile.display_name, profileData?.profile.username, user?.email]
  )

  const username = useMemo(() =>
    profileData?.profile.username || user?.email?.split('@')[0],
    [profileData?.profile.username, user?.email]
  )

  return (
    <div className={`group profile-widget-hover bg-gradient-to-br from-pkmn-card to-pkmn-surface rounded-xl p-6 border border-gray-700/50 hover:border-pokemon-gold/30 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <User className="w-5 h-5 mr-2 text-pokemon-gold" />
          Your Profile
        </h3>
        <Link
          href="/profile"
          className="text-gray-400 hover:text-pokemon-gold transition-colors p-1 rounded-lg hover:bg-pkmn-surface/50"
        >
          <Settings className="w-4 h-4" />
        </Link>
      </div>

      {/* Profile Summary */}
      <div className="flex items-center space-x-4 mb-6">
        <div className="relative">
          <div 
            className="w-16 h-16 rounded-full border-2 border-pokemon-gold/30 bg-pkmn-surface flex items-center justify-center overflow-hidden group-hover:border-pokemon-gold/60 transition-colors duration-300"
            style={{
              backgroundImage: profileData?.profile.avatar_url ? `url(${profileData.profile.avatar_url})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {!profileData?.profile.avatar_url && (
              <User className="w-8 h-8 text-gray-400" />
            )}
          </div>
          {/* Online indicator */}
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-pkmn-card"></div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-semibold truncate">
            {displayName}
          </h4>
          <p className="text-gray-400 text-sm truncate">
            @{username}
          </p>
          {achievements && achievements.unlockedAchievements > 5 && (
            <div className="flex items-center mt-1">
              <Star className="w-3 h-3 text-pokemon-gold mr-1" />
              <span className="text-pokemon-gold text-xs font-medium">Active Collector</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="profile-stat-card bg-pkmn-surface/50 rounded-lg p-3 text-center cursor-pointer">
          <div className="text-lg font-bold text-pokemon-gold">
            {stats?.totalCards || 0}
          </div>
          <div className="text-xs text-gray-400">Cards</div>
        </div>
        <div className="profile-stat-card bg-pkmn-surface/50 rounded-lg p-3 text-center cursor-pointer">
          <div className="text-lg font-bold text-green-400">
            €{(stats?.totalValueEur || 0).toFixed(0)}
          </div>
          <div className="text-xs text-gray-400">Value</div>
        </div>
        <div className="profile-stat-card bg-pkmn-surface/50 rounded-lg p-3 text-center cursor-pointer">
          <div className="text-lg font-bold text-purple-400">
            {achievements?.unlockedAchievements || 0}
          </div>
          <div className="text-xs text-gray-400">Badges</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <Link
          href="/profile"
          className="dropdown-item-enhanced flex items-center justify-between w-full p-3 rounded-lg bg-pkmn-surface/30 hover:bg-pokemon-gold/10 border border-transparent transition-all duration-200 group/link"
        >
          <div className="flex items-center">
            <Eye className="w-4 h-4 text-gray-400 mr-3 group-hover/link:text-pokemon-gold transition-colors" />
            <div>
              <span className="text-white text-sm font-medium group-hover/link:text-pokemon-gold transition-colors block">
                View Full Profile
              </span>
              <span className="text-gray-500 text-xs">Complete profile overview</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover/link:text-pokemon-gold group-hover/link:translate-x-1 transition-all duration-200" />
        </Link>

        <Link
          href="/profile?tab=collection"
          className="dropdown-item-enhanced flex items-center justify-between w-full p-3 rounded-lg bg-pkmn-surface/30 hover:bg-pokemon-gold/10 border border-transparent transition-all duration-200 group/link"
        >
          <div className="flex items-center">
            <BarChart3 className="w-4 h-4 text-gray-400 mr-3 group-hover/link:text-pokemon-gold transition-colors" />
            <div>
              <span className="text-white text-sm font-medium group-hover/link:text-pokemon-gold transition-colors block">
                Collection Stats
              </span>
              <span className="text-gray-500 text-xs">Detailed analytics</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover/link:text-pokemon-gold group-hover/link:translate-x-1 transition-all duration-200" />
        </Link>

        <Link
          href="/profile?tab=achievements"
          className="dropdown-item-enhanced flex items-center justify-between w-full p-3 rounded-lg bg-pkmn-surface/30 hover:bg-pokemon-gold/10 border border-transparent transition-all duration-200 group/link"
        >
          <div className="flex items-center">
            <Trophy className="w-4 h-4 text-gray-400 mr-3 group-hover/link:text-pokemon-gold transition-colors" />
            <div>
              <span className="text-white text-sm font-medium group-hover/link:text-pokemon-gold transition-colors block">
                Achievements
              </span>
              <span className="text-gray-500 text-xs">Your milestones</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover/link:text-pokemon-gold group-hover/link:translate-x-1 transition-all duration-200" />
        </Link>
      </div>

      {/* Progress Indicator */}
      {stats && stats.totalCards > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>Collection Progress</span>
            <span>{Math.min(100, Math.round((stats.totalCards / 1000) * 100))}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-pokemon-gold to-pokemon-gold-hover h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (stats.totalCards / 1000) * 100)}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  )
}