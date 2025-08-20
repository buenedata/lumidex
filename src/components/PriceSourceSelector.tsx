'use client'

import React from 'react'
import { useUserPreferences, usePreferredPriceSource } from '@/contexts/UserPreferencesContext'
import { PriceSource } from '@/lib/user-preferences-service'
import { cn } from '@/lib/utils'

interface PriceSourceSelectorProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'select' | 'toggle' | 'radio'
  showLabels?: boolean
}

export const PriceSourceSelector: React.FC<PriceSourceSelectorProps> = ({
  className,
  size = 'md',
  variant = 'select',
  showLabels = true
}) => {
  const priceSource = usePreferredPriceSource()
  const { updatePriceSource } = useUserPreferences()

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-sm py-1 px-2'
      case 'lg':
        return 'text-lg py-3 px-4'
      default:
        return 'text-base py-2 px-3'
    }
  }

  const priceSourceOptions = [
    {
      value: 'cardmarket' as PriceSource,
      label: 'CardMarket',
      description: 'European market prices (EUR)',
      region: 'EU'
    },
    {
      value: 'tcgplayer' as PriceSource,
      label: 'TCGPlayer',
      description: 'US market prices (USD)',
      region: 'US'
    }
  ]

  if (variant === 'select') {
    return (
      <div className={cn('flex flex-col space-y-1', className)}>
        {showLabels && (
          <label className="text-sm font-medium text-gray-700">
            Price Source
          </label>
        )}
        <select
          value={priceSource}
          onChange={(e) => updatePriceSource(e.target.value as PriceSource)}
          className={cn(
            'border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            getSizeClasses(),
            className
          )}
        >
          {priceSourceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} ({option.region}) - {option.description}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (variant === 'toggle') {
    return (
      <div className={cn('flex flex-col space-y-2', className)}>
        {showLabels && (
          <label className="text-sm font-medium text-gray-700">
            Price Source
          </label>
        )}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {priceSourceOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updatePriceSource(option.value)}
              className={cn(
                'flex-1 rounded-md transition-all duration-200',
                getSizeClasses(),
                priceSource === option.value
                  ? 'bg-white text-blue-600 shadow-sm font-medium'
                  : 'text-gray-600 hover:text-gray-800'
              )}
            >
              <div className="text-center">
                <div className="font-medium">{option.label}</div>
                <div className="text-xs opacity-75">{option.region}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'radio') {
    return (
      <div className={cn('flex flex-col space-y-3', className)}>
        {showLabels && (
          <label className="text-sm font-medium text-gray-700">
            Price Source
          </label>
        )}
        <div className="space-y-2">
          {priceSourceOptions.map((option) => (
            <label
              key={option.value}
              className="flex items-start space-x-3 cursor-pointer"
            >
              <input
                type="radio"
                name="priceSource"
                value={option.value}
                checked={priceSource === option.value}
                onChange={(e) => updatePriceSource(e.target.value as PriceSource)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">{option.label}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                    {option.region}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {option.description}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>
    )
  }

  return null
}

interface PriceSourceInfoProps {
  source?: PriceSource
  className?: string
}

export const PriceSourceInfo: React.FC<PriceSourceInfoProps> = ({
  source,
  className
}) => {
  const priceSource = usePreferredPriceSource()
  const currentSource = source || priceSource

  const sourceInfo: Record<PriceSource, {
    name: string
    region: string
    currency: string
    description: string
    website: string
  }> = {
    cardmarket: {
      name: 'CardMarket',
      region: 'Europe',
      currency: 'EUR',
      description: 'European marketplace with competitive pricing',
      website: 'cardmarket.com'
    },
    tcgplayer: {
      name: 'TCGPlayer',
      region: 'United States',
      currency: 'USD',
      description: 'Leading US marketplace for trading cards',
      website: 'tcgplayer.com'
    }
  }

  const info = sourceInfo[currentSource]

  return (
    <div className={cn('bg-blue-50 border border-blue-200 rounded-lg p-3', className)}>
      <div className="flex items-center space-x-2 mb-2">
        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
        <span className="font-medium text-blue-900">
          Using {info.name} Prices
        </span>
      </div>
      <div className="text-sm text-blue-700 space-y-1">
        <p><strong>Region:</strong> {info.region}</p>
        <p><strong>Currency:</strong> {info.currency}</p>
        <p><strong>Source:</strong> {info.website}</p>
        <p className="text-xs mt-2 opacity-75">{info.description}</p>
      </div>
    </div>
  )
}

export default PriceSourceSelector