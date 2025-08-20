import { supabase } from './supabase'
import { Locale, locales, setLocale as persistLocale } from './i18n'
import { SupportedCurrency, supportedCurrencies } from './currency-service'

export type PriceSource = 'cardmarket' | 'tcgplayer'

export interface UserPreferences {
  preferred_language: Locale
  preferred_currency: SupportedCurrency
  preferred_price_source: PriceSource
}

export interface UserPreferencesUpdate {
  preferred_language?: Locale
  preferred_currency?: SupportedCurrency
  preferred_price_source?: PriceSource
}

class UserPreferencesService {
  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<{ success: boolean; error?: string; data?: UserPreferences }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferred_language, preferred_currency, preferred_price_source')
        .eq('id', userId)
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      // Type assertion to handle Supabase type inference issues
      const profileData = data as any

      // Validate and sanitize the preferences
      const preferences: UserPreferences = {
        preferred_language: this.validateLocale(profileData?.preferred_language || 'en'),
        preferred_currency: this.validateCurrency(profileData?.preferred_currency || 'EUR'),
        preferred_price_source: this.validatePriceSource(profileData?.preferred_price_source || 'cardmarket')
      }

      return { success: true, data: preferences }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: UserPreferencesUpdate
  ): Promise<{ success: boolean; error?: string; data?: UserPreferences }> {
    try {
      // Validate preferences before updating
      const updates: Partial<UserPreferences> = {}
      
      if (preferences.preferred_language !== undefined) {
        updates.preferred_language = this.validateLocale(preferences.preferred_language)
      }
      
      if (preferences.preferred_currency !== undefined) {
        updates.preferred_currency = this.validateCurrency(preferences.preferred_currency)
      }
      
      if (preferences.preferred_price_source !== undefined) {
        updates.preferred_price_source = this.validatePriceSource(preferences.preferred_price_source)
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select('preferred_language, preferred_currency, preferred_price_source')
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      // Apply language preference immediately to local storage
      if (updates.preferred_language) {
        persistLocale(updates.preferred_language)
      }

      // Type assertion to handle Supabase type inference issues
      const profileData = data as any

      const updatedPreferences: UserPreferences = {
        preferred_language: this.validateLocale(profileData?.preferred_language || 'en'),
        preferred_currency: this.validateCurrency(profileData?.preferred_currency || 'EUR'),
        preferred_price_source: this.validatePriceSource(profileData?.preferred_price_source || 'cardmarket')
      }

      return { success: true, data: updatedPreferences }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Update language preference only
   */
  async updateLanguagePreference(
    userId: string,
    language: Locale
  ): Promise<{ success: boolean; error?: string; data?: Locale }> {
    try {
      const validatedLanguage = this.validateLocale(language)
      
      const { error } = await supabase
        .from('profiles')
        .update({
          preferred_language: validatedLanguage,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        return { success: false, error: error.message }
      }

      // Apply language preference immediately
      persistLocale(validatedLanguage)

      return { success: true, data: validatedLanguage }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Update currency preference only
   */
  async updateCurrencyPreference(
    userId: string,
    currency: SupportedCurrency
  ): Promise<{ success: boolean; error?: string; data?: SupportedCurrency }> {
    try {
      const validatedCurrency = this.validateCurrency(currency)
      
      const { error } = await supabase
        .from('profiles')
        .update({
          preferred_currency: validatedCurrency,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: validatedCurrency }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Update price source preference only
   */
  async updatePriceSourcePreference(
    userId: string,
    priceSource: PriceSource
  ): Promise<{ success: boolean; error?: string; data?: PriceSource }> {
    try {
      const validatedPriceSource = this.validatePriceSource(priceSource)
      
      const { error } = await supabase
        .from('profiles')
        .update({
          preferred_price_source: validatedPriceSource,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: validatedPriceSource }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Validate locale and return default if invalid
   */
  private validateLocale(locale: string): Locale {
    if (locales.includes(locale as Locale)) {
      return locale as Locale
    }
    return 'en' // Default fallback
  }

  /**
   * Validate currency and return default if invalid
   */
  private validateCurrency(currency: string): SupportedCurrency {
    if (supportedCurrencies.includes(currency as SupportedCurrency)) {
      return currency as SupportedCurrency
    }
    return 'EUR' // Default fallback
  }

  /**
   * Validate price source and return default if invalid
   */
  private validatePriceSource(priceSource: string): PriceSource {
    if (priceSource === 'cardmarket' || priceSource === 'tcgplayer') {
      return priceSource as PriceSource
    }
    return 'cardmarket' // Default fallback
  }

  /**
   * Get available language options
   */
  getAvailableLanguages(): Array<{ code: Locale; name: string; flag: string }> {
    const flags: Record<Locale, string> = {
      'en': '🇬🇧',
      'de': '🇩🇪',
      'fr': '🇫🇷',
      'es': '🇪🇸',
      'it': '🇮🇹',
      'nl': '🇳🇱',
      'pt': '🇵🇹',
      'no': '🇳🇴'
    }

    const names: Record<Locale, string> = {
      'en': 'English',
      'de': 'Deutsch',
      'fr': 'Français',
      'es': 'Español',
      'it': 'Italiano',
      'nl': 'Nederlands',
      'pt': 'Português',
      'no': 'Norsk'
    }

    return locales.map(locale => ({
      code: locale,
      name: names[locale],
      flag: flags[locale] || '🌍'
    }))
  }

  /**
   * Get available currency options
   */
  getAvailableCurrencies(): Array<{ code: SupportedCurrency; name: string; symbol: string }> {
    const currencyNames: Record<SupportedCurrency, string> = {
      'EUR': 'Euro',
      'USD': 'US Dollar',
      'GBP': 'British Pound',
      'CHF': 'Swiss Franc',
      'SEK': 'Swedish Krona',
      'NOK': 'Norwegian Krone',
      'DKK': 'Danish Krone',
      'PLN': 'Polish Złoty',
      'CZK': 'Czech Koruna',
      'HUF': 'Hungarian Forint'
    }

    const currencySymbols: Record<SupportedCurrency, string> = {
      'EUR': '€',
      'USD': '$',
      'GBP': '£',
      'CHF': 'CHF',
      'SEK': 'kr',
      'NOK': 'kr',
      'DKK': 'kr',
      'PLN': 'zł',
      'CZK': 'Kč',
      'HUF': 'Ft'
    }

    return supportedCurrencies.map(currency => ({
      code: currency,
      name: currencyNames[currency],
      symbol: currencySymbols[currency]
    }))
  }

  /**
   * Get available price source options
   */
  getAvailablePriceSources(): Array<{ code: PriceSource; name: string; description: string; region: string }> {
    return [
      {
        code: 'cardmarket',
        name: 'CardMarket',
        description: 'European market pricing (EUR)',
        region: 'Europe'
      },
      {
        code: 'tcgplayer',
        name: 'TCGPlayer',
        description: 'US market pricing (USD)',
        region: 'United States'
      }
    ]
  }
}

export const userPreferencesService = new UserPreferencesService()
export default userPreferencesService