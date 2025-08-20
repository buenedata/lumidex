'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { userPreferencesService, UserPreferences, PriceSource } from '@/lib/user-preferences-service'
import { SupportedCurrency } from '@/lib/currency-service'
import { Locale } from '@/lib/i18n'

interface UserPreferencesContextType {
  preferences: UserPreferences | null
  loading: boolean
  updateLanguage: (language: Locale) => Promise<void>
  updateCurrency: (currency: SupportedCurrency) => Promise<void>
  updatePriceSource: (priceSource: PriceSource) => Promise<void>
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>
  refreshPreferences: () => Promise<void>
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined)

interface UserPreferencesProviderProps {
  children: ReactNode
}

export function UserPreferencesProvider({ children }: UserPreferencesProviderProps) {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      loadPreferences()
    } else {
      setPreferences(null)
    }
  }, [user])

  const loadPreferences = async () => {
    if (!user) return

    setLoading(true)
    try {
      const result = await userPreferencesService.getUserPreferences(user.id)
      if (result.success && result.data) {
        setPreferences(result.data)
      }
    } catch (error) {
      console.error('Error loading user preferences:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateLanguage = async (language: Locale) => {
    if (!user) return

    try {
      const result = await userPreferencesService.updateLanguagePreference(user.id, language)
      if (result.success) {
        setPreferences(prev => prev ? { ...prev, preferred_language: language } : null)
      }
    } catch (error) {
      console.error('Error updating language preference:', error)
      throw error
    }
  }

  const updateCurrency = async (currency: SupportedCurrency) => {
    if (!user) return

    try {
      const result = await userPreferencesService.updateCurrencyPreference(user.id, currency)
      if (result.success) {
        setPreferences(prev => prev ? { ...prev, preferred_currency: currency } : null)
      }
    } catch (error) {
      console.error('Error updating currency preference:', error)
      throw error
    }
  }

  const updatePriceSource = async (priceSource: PriceSource) => {
    if (!user) return

    try {
      const result = await userPreferencesService.updatePriceSourcePreference(user.id, priceSource)
      if (result.success) {
        setPreferences(prev => prev ? { ...prev, preferred_price_source: priceSource } : null)
      }
    } catch (error) {
      console.error('Error updating price source preference:', error)
      throw error
    }
  }

  const updatePreferences = async (prefs: Partial<UserPreferences>) => {
    if (!user) return

    try {
      const result = await userPreferencesService.updateUserPreferences(user.id, prefs)
      if (result.success && result.data) {
        setPreferences(result.data)
      }
    } catch (error) {
      console.error('Error updating preferences:', error)
      throw error
    }
  }

  const refreshPreferences = async () => {
    await loadPreferences()
  }

  const value: UserPreferencesContextType = {
    preferences,
    loading,
    updateLanguage,
    updateCurrency,
    updatePriceSource,
    updatePreferences,
    refreshPreferences
  }

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  )
}

export function useUserPreferences(): UserPreferencesContextType {
  const context = useContext(UserPreferencesContext)
  if (context === undefined) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider')
  }
  return context
}

// Hook to get just the preferred currency
export function usePreferredCurrency(): SupportedCurrency {
  const { preferences } = useUserPreferences()
  return preferences?.preferred_currency || 'EUR'
}

// Hook to get just the preferred language
export function usePreferredLanguage(): Locale {
  const { preferences } = useUserPreferences()
  return preferences?.preferred_language || 'en'
}

// Hook to get just the preferred price source
export function usePreferredPriceSource(): PriceSource {
  const { preferences } = useUserPreferences()
  return preferences?.preferred_price_source || 'cardmarket'
}