import React from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'achievement-unlocked' | 'achievement-locked' | 'achievement-rare' | 'achievement-epic' | 'achievement-legendary' | 'rarity'
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  children: React.ReactNode
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  rarity,
  className,
  children,
  ...props
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'achievement-unlocked':
        return 'achievement-unlocked'
      case 'achievement-locked':
        return 'achievement-locked'
      case 'achievement-rare':
        return 'achievement-rare'
      case 'achievement-epic':
        return 'achievement-epic'
      case 'achievement-legendary':
        return 'achievement-legendary'
      case 'rarity':
        return getRarityClasses()
      default:
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800'
    }
  }

  const getRarityClasses = () => {
    switch (rarity) {
      case 'common':
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800'
      case 'uncommon':
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'
      case 'rare':
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'
      case 'epic':
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800'
      case 'legendary':
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800'
      default:
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800'
    }
  }

  return (
    <span
      className={cn(getVariantClasses(), className)}
      {...props}
    >
      {children}
    </span>
  )
}

interface CurrencyBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number
  currency?: 'EUR' | 'USD' | 'NOK' | 'GBP' | 'CHF' | 'SEK' | 'DKK' | 'PLN' | 'CZK' | 'HUF'
  size?: 'sm' | 'md' | 'lg'
}

export const CurrencyBadge: React.FC<CurrencyBadgeProps> = ({
  amount,
  currency = 'EUR',
  size = 'md',
  className,
  ...props
}) => {
  const formatCurrency = (value: number) => {
    // Use appropriate locale for better currency formatting
    let locale = 'en-US'
    switch (currency) {
      case 'EUR':
        locale = 'en-EU'
        break
      case 'NOK':
        locale = 'nb-NO'
        break
      case 'GBP':
        locale = 'en-GB'
        break
      case 'SEK':
        locale = 'sv-SE'
        break
      case 'DKK':
        locale = 'da-DK'
        break
      default:
        locale = 'en-US'
    }
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency
    }).format(value)
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  }

  return (
    <span
      className={cn(
        `currency-${currency.toLowerCase()} inline-flex items-center rounded-full font-semibold bg-orange-100 text-orange-800`,
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {formatCurrency(amount)}
    </span>
  )
}