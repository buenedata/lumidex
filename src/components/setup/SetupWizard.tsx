'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useUserPreferences } from '@/contexts/UserPreferencesContext'
import { useI18n } from '@/contexts/I18nContext'
import { userPreferencesService, PriceSource } from '@/lib/user-preferences-service'
import { SupportedCurrency } from '@/lib/currency-service'
import { Locale } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import WelcomeStep from './WelcomeStep'
import LanguageStep from './LanguageStep'
import CurrencyStep from './CurrencyStep'
import PriceSourceStep from './PriceSourceStep'
import CompletionStep from './CompletionStep'

export interface SetupWizardData {
  language: Locale
  currency: SupportedCurrency
  priceSource: PriceSource
}

interface SetupWizardProps {
  onComplete: () => void
  onSkip?: () => void
}

const STEPS = [
  { id: 'welcome', title: 'Welcome', component: WelcomeStep },
  { id: 'language', title: 'Language', component: LanguageStep },
  { id: 'currency', title: 'Currency', component: CurrencyStep },
  { id: 'priceSource', title: 'Price Source', component: PriceSourceStep },
  { id: 'completion', title: 'Complete', component: CompletionStep }
] as const

export default function SetupWizard({ onComplete, onSkip }: SetupWizardProps) {
  const { user } = useAuth()
  const { updatePreferences } = useUserPreferences()
  const { locale, setLocale } = useI18n()
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Setup wizard data
  const [wizardData, setWizardData] = useState<SetupWizardData>({
    language: locale,
    currency: 'EUR',
    priceSource: 'cardmarket'
  })

  // Auto-detect initial preferences based on user's locale
  useEffect(() => {
    const detectedCurrency = locale === 'no' ? 'NOK' : 'EUR'
    const detectedPriceSource = locale === 'en' ? 'tcgplayer' : 'cardmarket'
    
    setWizardData(prev => ({
      ...prev,
      language: locale,
      currency: detectedCurrency,
      priceSource: detectedPriceSource
    }))
  }, [locale])

  const updateWizardData = (updates: Partial<SetupWizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }))
  }

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const skipSetup = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      // Mark setup as completed without saving preferences
      await supabase
        .from('profiles')
        .update({
          setup_completed: true,
          setup_completed_at: new Date().toISOString()
        } as any)
        .eq('id', user.id)
      
      onSkip?.()
    } catch (error) {
      console.error('Error skipping setup:', error)
      setError('Failed to skip setup. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const completeSetup = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      setError(null)

      // Update user preferences
      await updatePreferences({
        preferred_language: wizardData.language,
        preferred_currency: wizardData.currency,
        preferred_price_source: wizardData.priceSource
      })

      // Apply language change immediately
      setLocale(wizardData.language)

      // Mark setup as completed
      await supabase
        .from('profiles')
        .update({
          setup_completed: true,
          setup_completed_at: new Date().toISOString()
        } as any)
        .eq('id', user.id)

      // Move to completion step
      setCurrentStep(STEPS.length - 1)

    } catch (error) {
      console.error('Error completing setup:', error)
      setError('Failed to save preferences. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const CurrentStepComponent = STEPS[currentStep].component
  const isWelcomeStep = currentStep === 0
  const isCompletionStep = currentStep === STEPS.length - 1
  const isLastConfigStep = currentStep === STEPS.length - 2

  return (
    <div className="min-h-screen bg-pkmn-dark flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress Bar */}
        {!isWelcomeStep && !isCompletionStep && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-300">
                Step {currentStep} of {STEPS.length - 2}
              </span>
              <span className="text-sm text-gray-400">
                {Math.round(((currentStep - 1) / (STEPS.length - 3)) * 100)}% Complete
              </span>
            </div>
            <div className="w-full bg-pkmn-surface rounded-full h-2">
              <div
                className="bg-gradient-to-r from-pokemon-gold to-pokemon-gold-hover h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(0, ((currentStep - 1) / (STEPS.length - 3)) * 100)}%`
                }}
              />
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="card-container overflow-hidden">
          {/* Step Content */}
          <div className="p-8">
            <CurrentStepComponent
              data={wizardData}
              updateData={updateWizardData}
              onNext={nextStep}
              onPrev={prevStep}
              onComplete={isCompletionStep ? onComplete : completeSetup}
              onSkip={skipSetup}
              loading={loading}
              error={error}
            />
          </div>

          {/* Navigation Footer */}
          {!isWelcomeStep && !isCompletionStep && (
            <div className="px-8 py-6 bg-pkmn-surface border-t border-gray-700 flex justify-between items-center">
              <button
                onClick={prevStep}
                disabled={loading}
                className="btn-secondary flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back</span>
              </button>

              <div className="flex items-center space-x-3">
                <button
                  onClick={skipSetup}
                  disabled={loading}
                  className="btn-outline"
                >
                  Skip for Now
                </button>
                
                {isLastConfigStep ? (
                  <button
                    onClick={completeSetup}
                    disabled={loading}
                    className="btn-gaming px-6"
                  >
                    {loading ? (
                      <LoadingSpinner size="sm" className="text-black" />
                    ) : (
                      'Complete Setup'
                    )}
                  </button>
                ) : (
                  <button
                    onClick={nextStep}
                    disabled={loading}
                    className="btn-gaming flex items-center space-x-2 px-6"
                  >
                    <span>Continue</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}