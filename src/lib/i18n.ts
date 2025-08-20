// Internationalization configuration for European markets
export type Locale = 'en' | 'de' | 'fr' | 'es' | 'it' | 'nl' | 'pt' | 'no'

export const locales: Locale[] = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pt', 'no']

export const defaultLocale: Locale = 'en'

// European country to locale mapping
export const countryToLocale: Record<string, Locale> = {
  'GB': 'en', // United Kingdom
  'IE': 'en', // Ireland
  'DE': 'de', // Germany
  'AT': 'de', // Austria
  'CH': 'de', // Switzerland (German-speaking)
  'FR': 'fr', // France
  'BE': 'fr', // Belgium (French-speaking)
  'LU': 'fr', // Luxembourg
  'ES': 'es', // Spain
  'IT': 'it', // Italy
  'SM': 'it', // San Marino
  'VA': 'it', // Vatican City
  'NL': 'nl', // Netherlands
  'PT': 'pt', // Portugal
  'NO': 'no', // Norway
}

// Currency mapping for European countries
export const localeToCurrency: Record<Locale, string> = {
  'en': 'EUR',
  'de': 'EUR',
  'fr': 'EUR',
  'es': 'EUR',
  'it': 'EUR',
  'nl': 'EUR',
  'pt': 'EUR',
  'no': 'NOK'  // Norway uses Norwegian Krone
}

// Language names in their native language
export const localeNames: Record<Locale, string> = {
  'en': 'English',
  'de': 'Deutsch',
  'fr': 'Français',
  'es': 'Español',
  'it': 'Italiano',
  'nl': 'Nederlands',
  'pt': 'Português',
  'no': 'Norsk'
}

// Detect user's preferred locale
export function detectLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale
  
  // Check localStorage first
  const stored = localStorage.getItem('preferred-locale') as Locale
  if (stored && locales.includes(stored)) {
    return stored
  }
  
  // Check browser language
  const browserLang = navigator.language.split('-')[0] as Locale
  if (locales.includes(browserLang)) {
    return browserLang
  }
  
  // Check browser languages array
  for (const lang of navigator.languages) {
    const langCode = lang.split('-')[0] as Locale
    if (locales.includes(langCode)) {
      return langCode
    }
  }
  
  return defaultLocale
}

// Set and persist locale preference
export function setLocale(locale: Locale): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('preferred-locale', locale)
}

// Format currency for locale
export function formatCurrency(amount: number, locale: Locale = defaultLocale): string {
  const currency = localeToCurrency[locale]
  
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

// Format date for locale
export function formatDate(date: string | Date, locale: Locale = defaultLocale): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(dateObj)
}

// Format number for locale
export function formatNumber(number: number, locale: Locale = defaultLocale): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : locale).format(number)
}

// Get RTL languages (none for European languages, but good to have)
export function isRTL(locale: Locale): boolean {
  return false // No RTL languages in our European locale set
}