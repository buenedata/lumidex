'use client'

import React, { useState, useEffect } from 'react'
import { currencyService, ConvertedPrice, PriceData, SupportedCurrency } from '@/lib/currency-service'
import { useI18n } from '@/contexts/I18nContext'
import { usePreferredCurrency, usePreferredPriceSource } from '@/contexts/UserPreferencesContext'
import { localeToCurrency } from '@/lib/i18n'
import { getCardPrice, CardPriceData } from '@/lib/price-utils'
import { cn } from '@/lib/utils'

interface PriceDisplayProps {
  amount?: number
  currency?: SupportedCurrency
  cardData?: CardPriceData
  showConversion?: boolean
  showOriginal?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'badge' | 'card'
  className?: string
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  amount,
  currency,
  cardData,
  showConversion = true,
  showOriginal = true,
  size = 'md',
  variant = 'default',
  className
}) => {
  const { locale } = useI18n()
  const preferredCurrency = usePreferredCurrency()
  const preferredPriceSource = usePreferredPriceSource()
  const [convertedPrice, setConvertedPrice] = useState<ConvertedPrice | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actualPrice, setActualPrice] = useState<{ amount: number; currency: SupportedCurrency } | null>(null)

  // Use user's preferred currency, fallback to locale-based currency if not available
  const targetCurrency = preferredCurrency || (localeToCurrency[locale] as SupportedCurrency)

  // Determine the actual price and currency to use
  useEffect(() => {
    if (cardData) {
      // Use price utils to get the appropriate price based on user preference
      const priceResult = getCardPrice(cardData, preferredPriceSource)
      if (priceResult) {
        setActualPrice({
          amount: priceResult.amount,
          currency: priceResult.currency as SupportedCurrency
        })
      } else {
        setActualPrice(null)
      }
    } else if (amount !== undefined && currency) {
      // Use provided amount and currency
      setActualPrice({
        amount,
        currency
      })
    } else {
      setActualPrice(null)
    }
  }, [cardData, preferredPriceSource, amount, currency])

  useEffect(() => {
    if (actualPrice && showConversion && actualPrice.currency !== targetCurrency) {
      convertPrice()
    }
  }, [actualPrice, targetCurrency, showConversion, preferredCurrency])

  const convertPrice = async () => {
    if (!actualPrice) return

    setLoading(true)
    setError(null)

    try {
      const priceData: PriceData = {
        amount: actualPrice.amount,
        currency: actualPrice.currency,
        locale
      }

      const converted = await currencyService.convertPrice(priceData, targetCurrency)
      setConvertedPrice(converted)
    } catch (err) {
      setError('Conversion failed')
      console.error('Currency conversion error:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (value: number, curr: SupportedCurrency) => {
    return currencyService.formatCurrency(value, curr, locale)
  }

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-sm'
      case 'lg':
        return 'text-lg font-semibold'
      default:
        return 'text-base'
    }
  }

  const getVariantClasses = () => {
    switch (variant) {
      case 'badge':
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 font-medium'
      case 'card':
        return 'p-3 bg-gray-50 rounded-lg border'
      default:
        return ''
    }
  }

  // If no price data available
  if (!actualPrice) {
    return (
      <span className={cn('text-gray-500', getSizeClasses(), getVariantClasses(), className)}>
        N/A
      </span>
    )
  }

  if (loading) {
    return (
      <div className={cn('animate-pulse', getSizeClasses(), getVariantClasses(), className)}>
        <div className="h-4 bg-gray-200 rounded w-16"></div>
      </div>
    )
  }

  if (error) {
    return (
      <span className={cn('text-white', getSizeClasses(), getVariantClasses(), className)}>
        {actualPrice ? formatPrice(actualPrice.amount, actualPrice.currency) : 'Error'}
      </span>
    )
  }

  // Always override currency colors when className contains text color classes
  const hasTextColorOverride = className && (
    className.includes('!text-') ||
    className.includes('text-') ||
    className.includes('!text-current')
  )
  
  // If no conversion needed or conversion disabled
  if (!showConversion || actualPrice.currency === targetCurrency || !convertedPrice) {
    return (
      <span className={cn(
        getSizeClasses(),
        getVariantClasses(),
        className,
        !hasTextColorOverride && `currency-${actualPrice.currency.toLowerCase()}`
      )}>
        {formatPrice(actualPrice.amount, actualPrice.currency)}
      </span>
    )
  }

  // Show converted price with optional original
  return (
    <div className={cn('flex flex-col', getVariantClasses())}>
      <span className={cn(
        'font-semibold',
        getSizeClasses(),
        className,
        !hasTextColorOverride && `currency-${targetCurrency.toLowerCase()}`
      )}>
        {formatPrice(convertedPrice.converted.amount, targetCurrency)}
      </span>
      {showOriginal && actualPrice.currency !== targetCurrency && (
        <span className={cn(
          'text-gray-500 text-xs',
          !hasTextColorOverride && `currency-${actualPrice.currency.toLowerCase()}`
        )}>
          {formatPrice(actualPrice.amount, actualPrice.currency)}
        </span>
      )}
    </div>
  )
}

interface PriceComparisonProps {
  prices: Array<{
    label: string
    amount: number
    currency?: SupportedCurrency
    highlight?: boolean
  }>
  className?: string
}

export const PriceComparison: React.FC<PriceComparisonProps> = ({
  prices,
  className
}) => {
  const { locale } = useI18n()
  const preferredCurrency = usePreferredCurrency()
  const targetCurrency = preferredCurrency || (localeToCurrency[locale] as SupportedCurrency)

  return (
    <div className={cn('space-y-2', className)}>
      {prices.map((price, index) => (
        <div
          key={index}
          className={cn(
            'flex justify-between items-center p-2 rounded',
            price.highlight ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
          )}
        >
          <span className="text-sm font-medium text-gray-700">
            {price.label}
          </span>
          <PriceDisplay
            amount={price.amount}
            currency={price.currency}
            size="sm"
            showConversion={true}
            showOriginal={false}
          />
        </div>
      ))}
    </div>
  )
}

interface PriceRangeProps {
  min: number
  max: number
  currency?: SupportedCurrency
  showConversion?: boolean
  className?: string
}

export const PriceRange: React.FC<PriceRangeProps> = ({
  min,
  max,
  currency = 'EUR',
  showConversion = true,
  className
}) => {
  const { locale } = useI18n()
  const preferredCurrency = usePreferredCurrency()

  const formatPrice = (value: number) => {
    const targetCurrency = showConversion
      ? (preferredCurrency || (localeToCurrency[locale] as SupportedCurrency))
      : currency
    return currencyService.formatCurrency(value, targetCurrency, locale)
  }

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <PriceDisplay
        amount={min}
        currency={currency}
        showConversion={showConversion}
        showOriginal={false}
        size="sm"
      />
      <span className="text-gray-400">-</span>
      <PriceDisplay
        amount={max}
        currency={currency}
        showConversion={showConversion}
        showOriginal={false}
        size="sm"
      />
    </div>
  )
}

interface PriceTrendProps {
  current: number
  previous: number
  currency?: SupportedCurrency
  showPercentage?: boolean
  className?: string
}

export const PriceTrend: React.FC<PriceTrendProps> = ({
  current,
  previous,
  currency = 'EUR',
  showPercentage = true,
  className
}) => {
  const { locale } = useI18n()
  const difference = current - previous
  const percentageChange = previous > 0 ? (difference / previous) * 100 : 0
  const isPositive = difference > 0
  const isNegative = difference < 0

  const formatPrice = (value: number) => {
    return currencyService.formatCurrency(value, currency, locale)
  }

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <PriceDisplay
        amount={current}
        currency={currency}
        showConversion={true}
        showOriginal={false}
        size="sm"
      />
      
      <div className={cn(
        'flex items-center space-x-1 text-xs',
        isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
      )}>
        {isPositive && <span>↗</span>}
        {isNegative && <span>↘</span>}
        {!isPositive && !isNegative && <span>→</span>}
        
        <span>
          {formatPrice(Math.abs(difference))}
        </span>
        
        {showPercentage && (
          <span>
            ({percentageChange > 0 ? '+' : ''}{percentageChange.toFixed(1)}%)
          </span>
        )}
      </div>
    </div>
  )
}

interface CurrencySelectorProps {
  value: SupportedCurrency
  onChange: (currency: SupportedCurrency) => void
  className?: string
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  value,
  onChange,
  className
}) => {
  const currencies = currencyService.getSupportedCurrencies()

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SupportedCurrency)}
      className={cn(
        'input text-sm py-1 px-2 w-auto',
        className
      )}
    >
      {currencies.map((currency) => (
        <option key={currency.code} value={currency.code}>
          {currency.symbol} {currency.code}
        </option>
      ))}
    </select>
  )
}