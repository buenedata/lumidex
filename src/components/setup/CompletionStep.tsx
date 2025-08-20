'use client'

import React from 'react'
import { SetupWizardData } from './SetupWizard'
import { userPreferencesService } from '@/lib/user-preferences-service'

interface CompletionStepProps {
  data: SetupWizardData
  updateData: (updates: Partial<SetupWizardData>) => void
  onNext: () => void
  onPrev: () => void
  onComplete: () => void
  onSkip: () => void
  loading: boolean
  error: string | null
}

export default function CompletionStep({ data, onComplete, loading }: CompletionStepProps) {
  const availableLanguages = userPreferencesService.getAvailableLanguages()
  const availableCurrencies = userPreferencesService.getAvailableCurrencies()
  const availablePriceSources = userPreferencesService.getAvailablePriceSources()

  const selectedLanguage = availableLanguages.find(lang => lang.code === data.language)
  const selectedCurrency = availableCurrencies.find(curr => curr.code === data.currency)
  const selectedPriceSource = availablePriceSources.find(source => source.code === data.priceSource)

  return (
    <div className="text-center space-y-6">
      {/* Success Animation */}
      <div className="flex justify-center">
        <div className="relative">
          <div className="w-16 h-16 bg-gradient-to-br from-pokemon-gold to-pokemon-gold-hover rounded-full flex items-center justify-center animate-pulse hover-glow">
            <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          {/* Celebration particles */}
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-pokemon-gold rounded-full animate-bounce"></div>
          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-pokemon-gold-hover rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>

      {/* Completion Message */}
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-pokemon-gold">
          🎉 Setup Complete!
        </h1>
        <p className="text-body max-w-lg mx-auto">
          Perfect! Your Lumidex collection is now personalized. You can change these settings anytime in your profile.
        </p>
      </div>

      {/* Settings Summary - Compact */}
      <div className="bg-pkmn-surface rounded-lg p-4 border border-gray-600">
        <h3 className="text-sm font-semibold text-white mb-4">Your Preferences</h3>
        
        <div className="grid grid-cols-3 gap-4">
          {/* Language */}
          <div className="text-center space-y-2">
            <div className="w-8 h-8 bg-pokemon-gold/20 rounded-lg flex items-center justify-center mx-auto">
              <span className="text-lg">{selectedLanguage?.flag}</span>
            </div>
            <div>
              <p className="text-xs text-gray-400">Language</p>
              <p className="text-sm font-medium text-white">{selectedLanguage?.name}</p>
            </div>
          </div>

          {/* Currency */}
          <div className="text-center space-y-2">
            <div className="w-8 h-8 bg-pokemon-gold/20 rounded-lg flex items-center justify-center mx-auto">
              <span className="text-lg font-bold text-pokemon-gold">{selectedCurrency?.symbol}</span>
            </div>
            <div>
              <p className="text-xs text-gray-400">Currency</p>
              <p className="text-sm font-medium text-white">{selectedCurrency?.code}</p>
            </div>
          </div>

          {/* Price Source */}
          <div className="text-center space-y-2">
            <div className="w-8 h-8 bg-pokemon-gold/20 rounded-lg flex items-center justify-center mx-auto">
              <svg className="w-4 h-4 text-pokemon-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-400">Price Source</p>
              <p className="text-sm font-medium text-white">{selectedPriceSource?.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Next Steps - Compact */}
      <div className="bg-pkmn-card rounded-lg p-4 border border-gray-700">
        <h3 className="text-sm font-semibold text-white mb-3">What's Next?</h3>
        
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-pokemon-gold/20 rounded flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-pokemon-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.168 18.477 18.582 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-white">Build Collection</p>
              <p className="text-xs text-gray-400">Browse & add cards</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-pokemon-gold/20 rounded flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-pokemon-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-white">Connect Friends</p>
              <p className="text-xs text-gray-400">Compare collections</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-pokemon-gold/20 rounded flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-pokemon-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-white">Track Progress</p>
              <p className="text-xs text-gray-400">Monitor achievements</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-pokemon-gold/20 rounded flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-pokemon-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-white">Explore Features</p>
              <p className="text-xs text-gray-400">Trading & wishlists</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Button */}
      <div className="text-center">
        <button
          onClick={onComplete}
          disabled={loading}
          className="btn-gaming px-8 py-3 text-lg font-semibold"
        >
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              <span>Loading...</span>
            </div>
          ) : (
            'Go to Dashboard'
          )}
        </button>
        <p className="text-caption mt-3">
          Ready to start building your collection!
        </p>
      </div>
    </div>
  )
}