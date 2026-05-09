/**
 * Lumidex i18n — lightweight client-side translation utility.
 *
 * Design goals:
 *  - Zero external dependencies (no next-intl, i18next, etc.)
 *  - No URL / routing changes — locale comes from the user's profile preference
 *  - Full TypeScript: keys are type-checked against the English source dictionary
 *  - Simple variable interpolation:  t('nav_pending', { count: 3 }) → "3 pending"
 */

import type { TranslationKey, TranslationDict } from '@/locales/en'

export type Locale = 'en' | 'nb'

export const SUPPORTED_LOCALES: Locale[] = ['en', 'nb']

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as string[]).includes(value)
}

/**
 * Build a `t()` translator function bound to the given dictionary.
 *
 * @example
 * const t = createTranslator(nbDict)
 * t('nav_sign_in')                        // → "Logg inn"
 * t('nav_pending', { count: 3 })          // → "3 ventende"
 */
export function createTranslator(dict: TranslationDict) {
  return function t(
    key: TranslationKey,
    vars?: Record<string, string | number>,
  ): string {
    // Fall back gracefully: if a key is missing return the key itself
    let str: string = (dict as Record<string, string>)[key] ?? key

    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.split(`{${k}}`).join(String(v))
      }
    }

    return str
  }
}

export type Translator = ReturnType<typeof createTranslator>
