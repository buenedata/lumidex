import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Card, PriceDisplay } from '@/types'

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency values for European market
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = 'EUR',
  locale: string = 'en-EU'
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'N/A'
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format dates in a user-friendly way
 */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString('en-EU', options)
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'Just now'
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
  }

  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`
  }

  return formatDate(dateObj)
}

/**
 * Get the best available price for a card with fallbacks
 */
export function getCardPrice(
  card: Card,
  priceType: 'market' | 'low' | 'trend' = 'market'
): PriceDisplay {
  const pricing = {
    market: card.cardmarket_avg_sell_price,
    low: card.cardmarket_low_price,
    trend: card.cardmarket_trend_price,
  }

  // Primary: CardMarket pricing
  if (pricing[priceType] && pricing[priceType]! > 0) {
    return {
      price: pricing[priceType]!,
      currency: 'EUR',
      source: 'CardMarket',
      updated: card.cardmarket_updated_at,
    }
  }

  // Fallback: TCGPlayer pricing (converted to EUR)
  if (card.tcgplayer_price && card.tcgplayer_price > 0) {
    return {
      price: card.tcgplayer_price * 0.85, // Approximate USD to EUR conversion
      currency: 'EUR',
      source: 'TCGPlayer',
      updated: card.updated_at,
    }
  }

  // No pricing available
  return {
    price: null,
    currency: 'EUR',
    source: 'unavailable',
    updated: undefined,
  }
}

/**
 * Get CSS classes for Pokemon card rarity
 */
export function getRarityClasses(rarity: string): string {
  const rarityMap: Record<string, string> = {
    'Common': 'rarity-common',
    'Uncommon': 'rarity-uncommon',
    'Rare': 'rarity-rare',
    'Rare Holo': 'rarity-rare-holo',
    'Rare Holo EX': 'rarity-ultra-rare',
    'Rare Holo GX': 'rarity-ultra-rare',
    'Rare Holo V': 'rarity-ultra-rare',
    'Rare Holo VMAX': 'rarity-ultra-rare',
    'Rare Secret': 'rarity-ultra-rare',
    'Rare Rainbow': 'rarity-ultra-rare',
  }

  return rarityMap[rarity] || 'rarity-common'
}

/**
 * Get CSS classes for Pokemon energy types
 */
export function getEnergyTypeClasses(type: string): string {
  const typeMap: Record<string, string> = {
    'Fire': 'energy-fire',
    'Water': 'energy-water',
    'Grass': 'energy-grass',
    'Lightning': 'energy-electric',
    'Psychic': 'energy-psychic',
    'Fighting': 'energy-fighting',
    'Darkness': 'energy-darkness',
    'Metal': 'energy-metal',
    'Fairy': 'energy-fairy',
    'Dragon': 'energy-dragon',
    'Colorless': 'energy-colorless',
  }

  return typeMap[type] || 'energy-colorless'
}

/**
 * Calculate collection completion percentage
 */
export function calculateCompletionPercentage(
  ownedCards: number,
  totalCards: number
): number {
  if (totalCards === 0) return 0
  return Math.round((ownedCards / totalCards) * 100 * 10) / 10 // Round to 1 decimal
}

/**
 * Generate a random ID (for temporary use before database IDs)
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

/**
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate username format (alphanumeric, underscores, hyphens)
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/
  return usernameRegex.test(username)
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength).trim() + '...'
}

/**
 * Convert file size to human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Sleep function for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Check if user is online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const result = document.execCommand('copy')
      textArea.remove()
      return result
    }
  } catch (error) {
    console.error('Failed to copy text:', error)
    return false
  }
}

/**
 * Format large numbers with abbreviations (1K, 1M, etc.)
 */
export function formatNumber(num: number): string {
  if (num < 1000) return num.toString()
  if (num < 1000000) return (num / 1000).toFixed(1) + 'K'
  if (num < 1000000000) return (num / 1000000).toFixed(1) + 'M'
  return (num / 1000000000).toFixed(1) + 'B'
}

/**
 * Get initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2)
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array)
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json)
  } catch {
    return fallback
  }
}