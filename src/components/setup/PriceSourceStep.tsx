'use client'

import React from 'react'
import { PriceSource } from '@/lib/user-preferences-service'
import { userPreferencesService } from '@/lib/user-preferences-service'
import { SetupWizardData } from './SetupWizard'
import { cn } from '@/lib/utils'

interface PriceSourceStepProps {
  data: SetupWizardData
  updateData: (updates: Partial<SetupWizardData>) => void
  onNext: () => void
  onPrev: () => void
  onComplete: () => void
  onSkip: () => void
  loading: boolean
  error: string | null
}

export default function PriceSourceStep({ data, updateData, onNext, loading }: PriceSourceStepProps) {
  const availablePriceSources = userPreferencesService.getAvailablePriceSources()

  const handlePriceSourceSelect = (priceSource: PriceSource) => {
    updateData({ priceSource })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-12 h-12 bg-gradient-to-br from-pokemon-gold to-pokemon-gold-hover rounded-full flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Choose Your Price Source</h2>
        <p className="text-sm text-gray-300 max-w-md mx-auto">
          Select your preferred marketplace for card pricing
        </p>
      </div>

      {/* Price Source Options - Compact */}
      <div className="space-y-3">
        {availablePriceSources.map((source) => (
          <button
            key={source.code}
            onClick={() => handlePriceSourceSelect(source.code)}
            disabled={loading}
            className={cn(
              'w-full p-4 rounded-lg border transition-all duration-200 text-left hover:scale-[1.02]',
              'focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:ring-offset-2 focus:ring-offset-pkmn-dark',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              data.priceSource === source.code
                ? 'border-pokemon-gold bg-pokemon-gold/10 shadow-lg'
                : 'border-gray-600 hover:border-pokemon-gold/50 bg-pkmn-surface'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  source.code === 'cardmarket'
                    ? 'bg-blue-500/20'
                    : 'bg-orange-500/20'
                )}>
                  {source.code === 'cardmarket' ? (
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0L17 13" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className={cn(
                    'font-semibold',
                    data.priceSource === source.code ? 'text-pokemon-gold' : 'text-white'
                  )}>
                    {source.name}
                  </h3>
                  <p className={cn(
                    'text-sm',
                    data.priceSource === source.code ? 'text-pokemon-gold/80' : 'text-gray-400'
                  )}>
                    {source.region} • {source.description}
                  </p>
                </div>
              </div>

              {/* Selection Indicator */}
              {data.priceSource === source.code && (
                <div className="w-6 h-6 bg-pokemon-gold rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Selected Source Preview - Compact */}
      <div className="bg-pkmn-surface rounded-lg p-3 border border-gray-600 text-center">
        <p className="text-sm text-gray-300">
          Selected: <span className="text-pokemon-gold font-medium">
            {availablePriceSources.find(source => source.code === data.priceSource)?.name || 'CardMarket'} ({availablePriceSources.find(source => source.code === data.priceSource)?.region || 'Europe'})
          </span>
        </p>
      </div>
    </div>
  )
}