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
      const result = await profileService.getProfileData(user.id, user.email)
      if (result.success && result.data) {
        setProfileData(result.data)
        setProfile(result.data.profile)
      } else {
        setError(result.error || 'Failed to load profile')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
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