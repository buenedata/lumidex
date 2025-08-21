'use client'

import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Profile } from '@/types'

interface ProfileData {
  profile: Profile
  collections: any[]
  achievements: any[]
  stats: any
}

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

      const profilePromise = async () => {
        // Get basic profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileError) {
          throw new Error(`Profile error: ${profileError.message}`)
        }

        // Create minimal profile data structure
        const result: ProfileData = {
          profile: profileData,
          collections: [],
          achievements: [],
          stats: {
            totalCards: 0,
            totalValue: 0,
            completionRate: 0
          }
        }

        return result
      }

      const result = await Promise.race([profilePromise(), timeoutPromise]) as ProfileData
      
      setProfileData(result)
      setProfile(result.profile)
    } catch (err) {
      console.error('Profile loading error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load profile')
      
      // Create a minimal profile if loading fails
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
        setProfile(fallbackProfile)
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