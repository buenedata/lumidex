'use client'

import React from 'react'
import { Button } from '@/components/ui'
import { SetupWizardData } from './SetupWizard'

interface WelcomeStepProps {
  data: SetupWizardData
  updateData: (updates: Partial<SetupWizardData>) => void
  onNext: () => void
  onPrev: () => void
  onComplete: () => void
  onSkip: () => void
  loading: boolean
  error: string | null
}

export default function WelcomeStep({ onNext, onSkip, loading }: WelcomeStepProps) {
  return (
    <div className="text-center space-y-6">
      {/* Welcome Icon */}
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-gradient-to-br from-pokemon-gold to-pokemon-gold-hover rounded-full flex items-center justify-center hover-glow">
          <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.168 18.477 18.582 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
      </div>

      {/* Welcome Content */}
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-pokemon-gold">
          Welcome to Lumidex!
        </h1>
        <p className="text-body max-w-lg mx-auto">
          Let's personalize your experience by setting up your preferred language, currency, and card pricing source.
        </p>
      </div>

      {/* Features Preview - Compact */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center space-y-2 card-hover p-3 rounded-lg bg-pkmn-surface/50">
          <div className="w-8 h-8 bg-pokemon-gold/20 rounded-lg flex items-center justify-center mx-auto">
            <svg className="w-4 h-4 text-pokemon-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-white">Language</h3>
          <p className="text-xs text-gray-400">
            Multi-language support
          </p>
        </div>

        <div className="text-center space-y-2 card-hover p-3 rounded-lg bg-pkmn-surface/50">
          <div className="w-8 h-8 bg-pokemon-gold/20 rounded-lg flex items-center justify-center mx-auto">
            <svg className="w-4 h-4 text-pokemon-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-white">Currency</h3>
          <p className="text-xs text-gray-400">
            Local pricing
          </p>
        </div>

        <div className="text-center space-y-2 card-hover p-3 rounded-lg bg-pkmn-surface/50">
          <div className="w-8 h-8 bg-pokemon-gold/20 rounded-lg flex items-center justify-center mx-auto">
            <svg className="w-4 h-4 text-pokemon-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-white">Market</h3>
          <p className="text-xs text-gray-400">
            Price sources
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4">
        <button
          onClick={onSkip}
          disabled={loading}
          className="btn-outline w-full sm:w-auto px-6"
        >
          Skip for Now
        </button>
        <button
          onClick={onNext}
          disabled={loading}
          className="btn-gaming w-full sm:w-auto px-6"
        >
          Get Started
        </button>
      </div>

      {/* Setup Information */}
      <div className="text-center space-y-1">
        <p className="text-caption">
          Takes less than 2 minutes • Change anytime in settings
        </p>
      </div>
    </div>
  )
}