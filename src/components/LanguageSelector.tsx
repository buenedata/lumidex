'use client'

import React, { useState } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import { locales, localeNames, Locale } from '@/lib/i18n'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

interface LanguageSelectorProps {
  variant?: 'dropdown' | 'inline'
  className?: string
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'dropdown',
  className
}) => {
  const { locale, setLocale } = useI18n()
  const [isOpen, setIsOpen] = useState(false)

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale)
    setIsOpen(false)
  }

  if (variant === 'inline') {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            className={cn(
              'px-3 py-1 text-sm rounded-md transition-colors',
              locale === loc
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            {localeNames[loc]}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2"
      >
        <span className="text-lg">🌍</span>
        <span>{localeNames[locale]}</span>
        <svg
          className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-20">
            <div className="py-1">
              {locales.map((loc) => (
                <button
                  key={loc}
                  onClick={() => handleLocaleChange(loc)}
                  className={cn(
                    'w-full text-left px-4 py-2 text-sm transition-colors flex items-center space-x-3',
                    locale === loc
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <span className="text-lg">{getFlagEmoji(loc)}</span>
                  <span>{localeNames[loc]}</span>
                  {locale === loc && (
                    <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Helper function to get flag emoji for each locale
function getFlagEmoji(locale: Locale): string {
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
  return flags[locale] || '🌍'
}

// Compact version for mobile/small spaces
export const CompactLanguageSelector: React.FC<{ className?: string }> = ({ className }) => {
  const { locale, setLocale } = useI18n()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        title={`Current language: ${localeNames[locale]}`}
      >
        <span className="text-lg">{getFlagEmoji(locale)}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          <div className="absolute right-0 mt-2 bg-white rounded-md shadow-lg border border-gray-200 z-20">
            <div className="py-1">
              {locales.map((loc) => (
                <button
                  key={loc}
                  onClick={() => {
                    setLocale(loc)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm transition-colors flex items-center space-x-2',
                    locale === loc
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <span>{getFlagEmoji(loc)}</span>
                  <span className="whitespace-nowrap">{localeNames[loc]}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}