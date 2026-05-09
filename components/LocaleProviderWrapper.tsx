'use client'

/**
 * LocaleProviderWrapper — thin client component that mounts the LocaleProvider.
 *
 * app/layout.tsx is a Server Component, so it cannot directly instantiate
 * context providers. This wrapper is imported there as the only 'use client'
 * boundary needed for i18n.
 */

import { LocaleProvider } from '@/contexts/LocaleContext'

export default function LocaleProviderWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return <LocaleProvider>{children}</LocaleProvider>
}
