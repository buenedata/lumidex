'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Locale, defaultLocale, detectLocale, setLocale as persistLocale } from '@/lib/i18n'
import { en } from '@/locales/en'
import { de } from '@/locales/de'

// Import other translations as they are created
const translations: Record<string, typeof en> = {
  en,
  de,
  // Add other languages here:
  // fr,
  // es,
  // it,
  // nl,
  // pt
}

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
  isLoading: boolean
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

interface I18nProviderProps {
  children: ReactNode
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Detect and set initial locale
    const detectedLocale = detectLocale()
    setLocaleState(detectedLocale)
    setIsLoading(false)
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    persistLocale(newLocale)
  }

  // Translation function with nested key support
  const t = (key: string): string => {
    const currentTranslations = translations[locale] || translations[defaultLocale] || en
    
    try {
      const keys = key.split('.')
      let value: any = currentTranslations
      
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k]
        } else {
          // Fallback to English if key not found
          const fallbackTranslations = translations[defaultLocale] || en
          let fallbackValue: any = fallbackTranslations
          
          for (const fk of keys) {
            if (fallbackValue && typeof fallbackValue === 'object' && fk in fallbackValue) {
              fallbackValue = fallbackValue[fk]
            } else {
              return key // Return key if not found in fallback either
            }
          }
          
          return typeof fallbackValue === 'string' ? fallbackValue : key
        }
      }
      
      return typeof value === 'string' ? value : key
    } catch (error) {
      console.warn(`Translation key not found: ${key}`)
      return key
    }
  }

  const value: I18nContextType = {
    locale,
    setLocale,
    t,
    isLoading
  }

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}

// Convenience hook for just the translation function
export function useTranslation() {
  const { t, locale } = useI18n()
  return { t, locale }
}

// HOC for components that need translations
export function withTranslation<P extends object>(
  Component: React.ComponentType<P & { t: (key: string) => string }>
) {
  return function WrappedComponent(props: P) {
    const { t } = useTranslation()
    return <Component {...props} t={t} />
  }
}