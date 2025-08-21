'use client'

import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { profileService, ProfileData } from '@/lib/profile-service'
import { Profile } from '@/types'

interface ProfileContextType {
  profile: Profile | null
  profileData: ProfileData | null
  loading: boolean
  error: string | null
  refreshProfile: () => Promise<void>
  updateProfileData: (updates: Partial<Profile>) => void
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load profile data when user changes
  const loadProfile = useCallback(async () => {
    if (!user || authLoading) return

    setLoading(true)
    setError(null)

    try {
      // Set a timeout for profile loading
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Profile loading timeout')), 8000)
      })

      const profilePromise = profileService.getProfileData(user.id, user.email)
      
      const result = await Promise.race([profilePromise, timeoutPromise]) as any
      
      if (result.success && result.data) {
        setProfileData(result.data)
        setProfile(result.data.profile)
      } else {
        throw new Error(result.error || 'Failed to load profile')
      }
    } catch (err) {
      console.error('Profile loading error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load profile')
      
      // Create a minimal fallback profile if loading fails
      if (user) {
        const fallbackProfile: Profile = {
          id: user.id,
          username: user.email?.split('@')[0] || 'user',
          display_name: user.email?.split('@')[0] || 'User',
          avatar_url: undefined,
          privacy_level: 'public',
          show_collection_value: true,
          preferred_currency: 'EUR',
          preferred_language: 'en',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        const fallbackProfileData: ProfileData = {
          profile: fallbackProfile,
          collectionStats: null,
          achievementStats: null,
          friends: [],
          friendRequests: [],
          recentActivity: [],
          wishlistItems: [],
          wishlistStats: null
        }
        
        setProfile(fallbackProfile)
        setProfileData(fallbackProfileData)
      }
    } finally {
      setLoading(false)
    }
  }, [user, authLoading])

  // Load profile on mount and when user changes
  useEffect(() => {
    if (user && !authLoading) {
      loadProfile()
    } else if (!user) {
      // Clear profile data when user logs out
      setProfile(null)
      setProfileData(null)
      setError(null)
      setLoading(false)
    }
  }, [user, authLoading, loadProfile])

  // Refresh profile data
  const refreshProfile = useCallback(async () => {
    await loadProfile()
  }, [loadProfile])

  // Update profile data optimistically
  const updateProfileData = useCallback((updates: Partial<Profile>) => {
    if (profile) {
      const updatedProfile = { ...profile, ...updates }
      setProfile(updatedProfile)
      
      if (profileData) {
        setProfileData({
          ...profileData,
          profile: updatedProfile
        })
      }
    }
  }, [profile, profileData])

  const value = useMemo(() => ({
    profile,
    profileData,
    loading,
    error,
    refreshProfile,
    updateProfileData
  }), [profile, profileData, loading, error, refreshProfile, updateProfileData])

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return context
}