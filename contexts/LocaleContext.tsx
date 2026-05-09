'use client'

/**
 * LocaleContext — provides a type-safe t() translator to all client components.
 *
 * The active locale is derived from the authenticated user's `preferred_language`
 * profile field (stored in Supabase, synced into the Zustand auth store).
 * Falls back to 'en' for unauthenticated visitors or unsupported values.
 *
 * Usage:
 *   const { t, locale } = useLocale()
 *   t('nav_sign_in')                    // → "Sign In" or "Logg inn"
 *   t('nav_pending', { count: 3 })      // → "3 pending"  / "3 ventende"
 */

import { createContext, useContext, useMemo } from 'react'
import { useAuthStore } from '@/lib/store'
import { createTranslator, isSupportedLocale, type Locale, type Translator } from '@/lib/i18n'
import en from '@/locales/en'
import nb from '@/locales/nb'
import type { TranslationDict } from '@/locales/en'

// ── Dictionaries map ───────────────────────────────────────────────────────────

const DICTS: Record<Locale, TranslationDict> = {
  en: en as TranslationDict,
  nb: nb as TranslationDict,
}

// ── Context shape ──────────────────────────────────────────────────────────────

interface LocaleContextValue {
  locale: Locale
  t: Translator
}

// Default (no provider fallback) → English
const defaultValue: LocaleContextValue = {
  locale: 'en',
  t: createTranslator(en),
}

export const LocaleContext = createContext<LocaleContextValue>(defaultValue)

// ── Provider ───────────────────────────────────────────────────────────────────

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const profile = useAuthStore(s => s.profile)

  const locale: Locale = useMemo(() => {
    const pref = profile?.preferred_language
    return isSupportedLocale(pref) ? pref : 'en'
  }, [profile?.preferred_language])

  const t = useMemo(() => createTranslator(DICTS[locale]), [locale])

  const value = useMemo<LocaleContextValue>(() => ({ locale, t }), [locale, t])

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  )
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext)
}
