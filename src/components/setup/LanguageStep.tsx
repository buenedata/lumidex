'use client'

import React from 'react'
import { Locale } from '@/lib/i18n'
import { userPreferencesService } from '@/lib/user-preferences-service'
import { SetupWizardData } from './SetupWizard'
import { cn } from '@/lib/utils'

interface LanguageStepProps {
  data: SetupWizardData
  updateData: (updates: Partial<SetupWizardData>) => void
  onNext: () => void
  onPrev: () => void
  onComplete: () => void
  onSkip: () => void
  loading: boolean
  error: string | null
}

export default function LanguageStep({ data, updateData, onNext, loading }: LanguageStepProps) {
  const availableLanguages = userPreferencesService.getAvailableLanguages()

  const handleLanguageSelect = (language: Locale) => {
    updateData({ language })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-12 h-12 bg-gradient-to-br from-pokemon-gold to-pokemon-gold-hover rounded-full flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Choose Your Language</h2>
        <p className="text-sm text-gray-300 max-w-md mx-auto">
          Select your preferred language for the interface
        </p>
      </div>

      {/* Language Options - Compact Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {availableLanguages.map((language) => (
          <button
            key={language.code}
            onClick={() => handleLanguageSelect(language.code)}
            disabled={loading}
            className={cn(
              'p-3 rounded-lg border transition-all duration-200 text-center hover:scale-105',
              'focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:ring-offset-2 focus:ring-offset-pkmn-dark',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              data.language === language.code
                ? 'border-pokemon-gold bg-pokemon-gold/10 shadow-lg'
                : 'border-gray-600 hover:border-pokemon-gold/50 bg-pkmn-surface'
            )}
          >
            <div className="space-y-2">
              <span className="text-2xl block">{language.flag}</span>
              <div className={cn(
                'text-sm font-medium',
                data.language === language.code ? 'text-pokemon-gold' : 'text-white'
              )}>
                {language.name}
              </div>
              {data.language === language.code && (
                <svg className="w-4 h-4 text-pokemon-gold mx-auto" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Selected Language Preview - Compact */}
      <div className="bg-pkmn-surface rounded-lg p-3 border border-gray-600 text-center">
        <p className="text-sm text-gray-300">
          Selected: <span className="text-pokemon-gold font-medium">
            {availableLanguages.find(lang => lang.code === data.language)?.name || 'English'}
          </span>
        </p>
      </div>
    </div>
  )
}