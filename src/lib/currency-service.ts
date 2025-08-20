// Enhanced currency service for European markets with conversion support
import { Locale, localeToCurrency } from './i18n'

export interface CurrencyRate {
  from: string
  to: string
  rate: number
  lastUpdated: Date
}

export interface PriceData {
  amount: number
  currency: string
  locale?: Locale
}

export interface ConvertedPrice {
  original: PriceData
  converted: PriceData
  rate: number
  lastUpdated: Date
}

// European currencies we support
export const supportedCurrencies = ['EUR', 'USD', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF'] as const
export type SupportedCurrency = typeof supportedCurrencies[number]

// Mock exchange rates - in production, this would come from a real API
// Updated rates as of August 2025
const mockExchangeRates: Record<string, number> = {
  'USD_EUR': 0.85,
  'EUR_USD': 1.18,
  'GBP_EUR': 1.15,
  'EUR_GBP': 0.87,
  'CHF_EUR': 0.92,
  'EUR_CHF': 1.09,
  'SEK_EUR': 0.095,
  'EUR_SEK': 10.53,
  'NOK_EUR': 0.087,  // Updated: 1 NOK = 0.087 EUR
  'EUR_NOK': 11.5,   // Updated: 1 EUR = 11.5 NOK
  'DKK_EUR': 0.134,
  'EUR_DKK': 7.46,
  'PLN_EUR': 0.22,
  'EUR_PLN': 4.55,
  'CZK_EUR': 0.041,
  'EUR_CZK': 24.39,
  'HUF_EUR': 0.0027,
  'EUR_HUF': 370.25
}

class CurrencyService {
  private rates: Map<string, CurrencyRate> = new Map()
  private lastFetch: Date | null = null
  private readonly CACHE_DURATION = 1000 * 60 * 60 // 1 hour

  constructor() {
    this.initializeMockRates()
  }

  private initializeMockRates() {
    const now = new Date()
    Object.entries(mockExchangeRates).forEach(([pair, rate]) => {
      const [from, to] = pair.split('_')
      this.rates.set(pair, {
        from,
        to,
        rate,
        lastUpdated: now
      })
    })
    this.lastFetch = now
  }

  // Get exchange rate between two currencies
  async getExchangeRate(from: SupportedCurrency, to: SupportedCurrency): Promise<number> {
    if (from === to) return 1

    const pair = `${from}_${to}`
    const reversePair = `${to}_${from}`

    // Check if we have the direct rate
    if (this.rates.has(pair)) {
      const rate = this.rates.get(pair)!
      if (this.isRateValid(rate)) {
        return rate.rate
      }
    }

    // Check if we have the reverse rate
    if (this.rates.has(reversePair)) {
      const rate = this.rates.get(reversePair)!
      if (this.isRateValid(rate)) {
        return 1 / rate.rate
      }
    }

    // If no direct rate, try to convert through EUR
    if (from !== 'EUR' && to !== 'EUR') {
      const fromToEur = await this.getExchangeRate(from, 'EUR')
      const eurToTo = await this.getExchangeRate('EUR', to)
      return fromToEur * eurToTo
    }

    // Fallback to 1 if no rate found
    console.warn(`No exchange rate found for ${from} to ${to}`)
    return 1
  }

  private isRateValid(rate: CurrencyRate): boolean {
    if (!this.lastFetch) return false
    const now = new Date()
    return (now.getTime() - rate.lastUpdated.getTime()) < this.CACHE_DURATION
  }

  // Convert price from one currency to another
  async convertPrice(price: PriceData, targetCurrency: SupportedCurrency): Promise<ConvertedPrice> {
    const rate = await this.getExchangeRate(price.currency as SupportedCurrency, targetCurrency)
    const convertedAmount = price.amount * rate

    return {
      original: price,
      converted: {
        amount: convertedAmount,
        currency: targetCurrency,
        locale: price.locale
      },
      rate,
      lastUpdated: new Date()
    }
  }

  // Convert price to user's preferred currency based on locale
  async convertToLocaleCurrency(price: PriceData, locale: Locale): Promise<ConvertedPrice> {
    const targetCurrency = localeToCurrency[locale] as SupportedCurrency
    return this.convertPrice(price, targetCurrency)
  }

  // Format currency for display
  formatCurrency(amount: number, currency: SupportedCurrency, locale: Locale = 'en'): string {
    try {
      // Use appropriate locale for each currency to get the best formatting
      let formatLocale: string = locale
      if (locale === 'en') {
        // Use specific locales for better currency formatting
        switch (currency) {
          case 'USD':
            formatLocale = 'en-US' // Shows $ instead of US$
            break
          case 'GBP':
            formatLocale = 'en-GB' // Shows £
            break
          case 'NOK':
            formatLocale = 'nb-NO' // Shows kr properly
            break
          default:
            formatLocale = 'en-US' // Default to US formatting for other currencies
        }
      }
      
      return new Intl.NumberFormat(formatLocale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount)
    } catch (error) {
      // Fallback formatting
      const symbols: Record<SupportedCurrency, string> = {
        'EUR': '€',
        'USD': '$',
        'GBP': '£',
        'CHF': 'CHF',
        'SEK': 'kr',
        'NOK': 'kr',
        'DKK': 'kr',
        'PLN': 'zł',
        'CZK': 'Kč',
        'HUF': 'Ft'
      }
      
      const symbol = symbols[currency] || currency
      return `${symbol}${amount.toFixed(2)}`
    }
  }

  // Format price with conversion info
  formatPriceWithConversion(converted: ConvertedPrice, locale: Locale = 'en'): {
    primary: string
    secondary?: string
    rate: string
  } {
    const primary = this.formatCurrency(
      converted.converted.amount,
      converted.converted.currency as SupportedCurrency,
      locale
    )

    let secondary: string | undefined
    if (converted.original.currency !== converted.converted.currency) {
      secondary = this.formatCurrency(
        converted.original.amount,
        converted.original.currency as SupportedCurrency,
        locale
      )
    }

    const rate = `1 ${converted.original.currency} = ${converted.rate.toFixed(4)} ${converted.converted.currency}`

    return { primary, secondary, rate }
  }

  // Get currency symbol
  getCurrencySymbol(currency: SupportedCurrency): string {
    const symbols: Record<SupportedCurrency, string> = {
      'EUR': '€',
      'USD': '$',
      'GBP': '£',
      'CHF': 'CHF',
      'SEK': 'kr',
      'NOK': 'kr',
      'DKK': 'kr',
      'PLN': 'zł',
      'CZK': 'Kč',
      'HUF': 'Ft'
    }
    return symbols[currency] || currency
  }

  // Get all supported currencies with their names
  getSupportedCurrencies(): Array<{ code: SupportedCurrency; name: string; symbol: string }> {
    const currencyNames: Record<SupportedCurrency, string> = {
      'EUR': 'Euro',
      'USD': 'US Dollar',
      'GBP': 'British Pound',
      'CHF': 'Swiss Franc',
      'SEK': 'Swedish Krona',
      'NOK': 'Norwegian Krone',
      'DKK': 'Danish Krone',
      'PLN': 'Polish Złoty',
      'CZK': 'Czech Koruna',
      'HUF': 'Hungarian Forint'
    }

    return supportedCurrencies.map(code => ({
      code,
      name: currencyNames[code],
      symbol: this.getCurrencySymbol(code)
    }))
  }

  // Refresh exchange rates (in production, this would fetch from an API)
  async refreshRates(): Promise<void> {
    // In production, implement actual API call here
    // For now, just update the timestamp
    this.lastFetch = new Date()
    
    // Update all existing rates with new timestamp
    this.rates.forEach((rate, key) => {
      this.rates.set(key, {
        ...rate,
        lastUpdated: new Date()
      })
    })
  }

  // Check if rates need refreshing
  needsRefresh(): boolean {
    if (!this.lastFetch) return true
    const now = new Date()
    return (now.getTime() - this.lastFetch.getTime()) > this.CACHE_DURATION
  }
}

// Export singleton instance
export const currencyService = new CurrencyService()

// Utility functions for common operations
export async function convertToEuros(amount: number, fromCurrency: SupportedCurrency): Promise<number> {
  if (fromCurrency === 'EUR') return amount
  
  const rate = await currencyService.getExchangeRate(fromCurrency, 'EUR')
  return amount * rate
}

export async function convertFromEuros(amount: number, toCurrency: SupportedCurrency): Promise<number> {
  if (toCurrency === 'EUR') return amount
  
  const rate = await currencyService.getExchangeRate('EUR', toCurrency)
  return amount * rate
}

export function formatEuros(amount: number, locale: Locale = 'en'): string {
  return currencyService.formatCurrency(amount, 'EUR', locale)
}