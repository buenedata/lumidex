'use client'

import React, { useState, useRef, Fragment } from 'react'
import { CollectionStats } from '@/lib/collection-stats-service'
import { AchievementStats } from '@/lib/achievement-service'
import { Profile } from '@/types'
import { TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Menu, Transition, Disclosure } from '@headlessui/react'
import {
  Camera,
  MapPin,
  Calendar,
  Globe,
  Trophy,
  Star,
  TrendingUp,
  Users,
  Share2,
  Settings,
  MoreHorizontal,
  ChevronDown,
  UserPlus,
  UserCheck,
  UserX
} from 'lucide-react'

interface ProfileHeaderProps {
  profile: Profile
  collectionStats?: CollectionStats | null
  achievementStats?: AchievementStats | null
  isOwnProfile?: boolean
  onAvatarChange?: (file: File) => void
  onBannerChange?: (file: File) => void
  onOpenSettings?: () => void
  activeTab?: string
  onTabChange?: (tab: string) => void
  friendshipStatus?: 'none' | 'pending' | 'friends' | 'blocked'
  onFriendAction?: () => void
  friendActionLoading?: boolean
}

export function ProfileHeader({
  profile,
  collectionStats,
  achievementStats,
  isOwnProfile = false,
  onAvatarChange,
  onBannerChange,
  onOpenSettings,
  activeTab = 'overview',
  onTabChange,
  friendshipStatus = 'none',
  onFriendAction,
  friendActionLoading = false
}: ProfileHeaderProps) {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      onAvatarChange?.(file)
    }
  }

  // Clear avatar preview when profile avatar_url changes (successful upload)
  React.useEffect(() => {
    if (profile.avatar_url && avatarPreview) {
      // Clear preview after a short delay to allow the new image to load
      const timer = setTimeout(() => {
        setAvatarPreview(null)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [profile.avatar_url, avatarPreview])

  const handleBannerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setBannerPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      onBannerChange?.(file)
    }
  }

  const formatCurrency = (value: number) => `€${value.toFixed(2)}`

  const renderFriendButton = () => {
    if (isOwnProfile) return null

    switch (friendshipStatus) {
      case 'friends':
        return (
          <button
            onClick={onFriendAction}
            disabled={friendActionLoading}
            className="btn-gaming bg-red-600 hover:bg-red-700 btn-sm flex items-center disabled:opacity-50"
          >
            <UserX className="w-4 h-4 mr-2" />
            {friendActionLoading ? 'Removing...' : 'Remove Friend'}
          </button>
        )
      case 'pending':
        return (
          <button
            disabled={true}
            className="btn-gaming bg-yellow-600 opacity-50 btn-sm flex items-center"
          >
            <UserCheck className="w-4 h-4 mr-2" />
            Request Sent
          </button>
        )
      default:
        return (
          <button
            onClick={onFriendAction}
            disabled={friendActionLoading}
            className="btn-gaming btn-sm flex items-center disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            {friendActionLoading ? 'Sending...' : 'Add Friend'}
          </button>
        )
    }
  }

  return (
    <div className="bg-pkmn-card rounded-xl overflow-hidden border border-gray-700/50 mb-6 shadow-2xl">
      {/* Enhanced Banner Section */}
      <div className="relative">
        <div
          className="h-48 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 relative overflow-hidden"
          style={{
            backgroundImage: bannerPreview ? `url(${bannerPreview})` : profile.banner_url ? `url(${profile.banner_url})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {/* Simple Banner Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Banner Edit Button */}
          {isOwnProfile && (
            <button
              onClick={() => bannerInputRef.current?.click()}
              className="absolute top-4 right-4 p-2 bg-black/50 rounded-lg hover:bg-black/70 transition-colors"
            >
              <Camera className="w-5 h-5 text-white" />
            </button>
          )}
          
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            onChange={handleBannerChange}
            className="hidden"
          />
        </div>

        {/* Avatar */}
        <div className="absolute -bottom-16 left-6">
          <div className="relative">
            <div
              className="w-32 h-32 rounded-full border-4 border-pkmn-card bg-pkmn-surface flex items-center justify-center overflow-hidden"
              style={{
                backgroundImage: avatarPreview || profile.avatar_url ? `url(${avatarPreview || profile.avatar_url})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              {!avatarPreview && !profile.avatar_url && (
                <div className="text-4xl">👤</div>
              )}
            </div>
            
            {/* Online Status Indicator */}
            <div className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 rounded-full border-4 border-pkmn-card"></div>
            
            {/* Avatar Edit Button */}
            {isOwnProfile && (
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 bg-pokemon-gold rounded-full hover:bg-pokemon-gold-hover transition-colors"
              >
                <Camera className="w-4 h-4 text-black" />
              </button>
            )}
            
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="pt-20 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-2xl font-bold text-white">
                {profile.display_name || profile.username}
              </h1>
              {achievementStats && achievementStats.unlockedAchievements > 10 && (
                <div className="flex items-center space-x-1 px-2 py-1 bg-pokemon-gold/20 rounded-full">
                  <Star className="w-4 h-4 text-pokemon-gold" />
                  <span className="text-pokemon-gold text-sm font-medium">Collector</span>
                </div>
              )}
            </div>
            
            <div className="text-gray-400 mb-2">@{profile.username}</div>
            
            {profile.bio && (
              <p className="text-gray-300 mb-3 max-w-2xl">{profile.bio}</p>
            )}
            
            {/* Profile Details */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
              {profile.location && (
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  {profile.location}
                </div>
              )}
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                Joined {new Date(profile.created_at).toLocaleDateString()}
              </div>
              {profile.last_active && (
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Last active {new Date(profile.last_active).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            {isOwnProfile ? (
              <>
                <button
                  onClick={onOpenSettings}
                  className="btn-secondary btn-sm flex items-center"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </button>
              </>
            ) : (
              <>
                {renderFriendButton()}
                <button className="btn-outline btn-sm flex items-center">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </button>
              </>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-6 border-t border-gray-700/50 pt-4">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7 gap-1 bg-transparent border-0 p-0 h-auto">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-pokemon-gold data-[state=active]:text-black py-3 px-4 rounded-lg"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="collection"
              className="data-[state=active]:bg-pokemon-gold data-[state=active]:text-black py-3 px-4 rounded-lg"
            >
              Collection
            </TabsTrigger>
            <TabsTrigger
              value="wishlist"
              className="data-[state=active]:bg-pokemon-gold data-[state=active]:text-black py-3 px-4 rounded-lg"
            >
              Wishlist
            </TabsTrigger>
            <TabsTrigger
              value="achievements"
              className="data-[state=active]:bg-pokemon-gold data-[state=active]:text-black py-3 px-4 rounded-lg"
            >
              Achievements
            </TabsTrigger>
            <TabsTrigger
              value="social"
              className="data-[state=active]:bg-pokemon-gold data-[state=active]:text-black py-3 px-4 rounded-lg"
            >
              Friends
            </TabsTrigger>
            <TabsTrigger
              value="compare"
              className="data-[state=active]:bg-pokemon-gold data-[state=active]:text-black py-3 px-4 rounded-lg"
            >
              Compare
            </TabsTrigger>
            <TabsTrigger
              value="share"
              className="data-[state=active]:bg-pokemon-gold data-[state=active]:text-black py-3 px-4 rounded-lg"
            >
              Share
            </TabsTrigger>
          </TabsList>
        </div>
      </div>
    </div>
  )
}