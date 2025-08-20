'use client'

import React from 'react'
import { SupportedCurrency } from '@/lib/currency-service'
import { userPreferencesService } from '@/lib/user-preferences-service'
import { SetupWizardData } from './SetupWizard'
import { cn } from '@/lib/utils'

interface CurrencyStepProps {
  data: SetupWizardData
  updateData: (updates: Partial<SetupWizardData>) => void
  onNext: () => void
  onPrev: () => void
  onComplete: () => void
  onSkip: () => void
  loading: boolean
  error: string | null
}

export default function CurrencyStep({ data, updateData, onNext, loading }: CurrencyStepProps) {
  const availableCurrencies = userPreferencesService.getAvailableCurrencies()

  const handleCurrencySelect = (currency: SupportedCurrency) => {
    updateData({ currency })
  }

  // Group currencies by region for better organization
  const europeanCurrencies = availableCurrencies.filter(curr =>
    ['EUR', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF'].includes(curr.code)
  )
  const otherCurrencies = availableCurrencies.filter(curr =>
    !['EUR', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF'].includes(curr.code)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-12 h-12 bg-gradient-to-br from-pokemon-gold to-pokemon-gold-hover rounded-full flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Choose Your Currency</h2>
        <p className="text-sm text-gray-300 max-w-md mx-auto">
          Select your preferred currency for displaying card prices
        </p>
      </div>

      {/* Currency Options - Compact Grid */}
      <div className="space-y-4">
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {europeanCurrencies.map((currency) => (
            <button
              key={currency.code}
              onClick={() => handleCurrencySelect(currency.code)}
              disabled={loading}
              className={cn(
                'p-3 rounded-lg border transition-all duration-200 text-center hover:scale-105',
                'focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:ring-offset-2 focus:ring-offset-pkmn-dark',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                data.currency === currency.code
                  ? 'border-pokemon-gold bg-pokemon-gold/10 shadow-lg'
                  : 'border-gray-600 hover:border-pokemon-gold/50 bg-pkmn-surface'
              )}
            >
              <div className="space-y-1">
                <div className={cn(
                  'text-lg font-bold',
                  data.currency === currency.code ? 'text-pokemon-gold' : 'text-gray-300'
                )}>
                  {currency.symbol}
                </div>
                <div className={cn(
                  'text-xs font-medium',
                  data.currency === currency.code ? 'text-pokemon-gold' : 'text-white'
                )}>
                  {currency.code}
                </div>
                {data.currency === currency.code && (
                  <svg className="w-3 h-3 text-pokemon-gold mx-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Other Currencies */}
        {otherCurrencies.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {otherCurrencies.map((currency) => (
              <button
                key={currency.code}
                onClick={() => handleCurrencySelect(currency.code)}
                disabled={loading}
                className={cn(
                  'p-3 rounded-lg border transition-all duration-200 text-center hover:scale-105',
                  'focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:ring-offset-2 focus:ring-offset-pkmn-dark',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  data.currency === currency.code
                    ? 'border-pokemon-gold bg-pokemon-gold/10 shadow-lg'
                    : 'border-gray-600 hover:border-pokemon-gold/50 bg-pkmn-surface'
                )}
              >
                <div className="space-y-1">
                  <div className={cn(
                    'text-lg font-bold',
                    data.currency === currency.code ? 'text-pokemon-gold' : 'text-gray-300'
                  )}>
                    {currency.symbol}
                  </div>
                  <div className={cn(
                    'text-xs font-medium',
                    data.currency === currency.code ? 'text-pokemon-gold' : 'text-white'
                  )}>
                    {currency.code}
                  </div>
                  {data.currency === currency.code && (
                    <svg className="w-3 h-3 text-pokemon-gold mx-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Currency Preview - Compact */}
      <div className="bg-pkmn-surface rounded-lg p-3 border border-gray-600 text-center">
        <p className="text-sm text-gray-300">
          Selected: <span className="text-pokemon-gold font-medium">
            {availableCurrencies.find(curr => curr.code === data.currency)?.name || 'Euro'} ({data.currency})
          </span>
        </p>
      </div>
    </div>
  )
}