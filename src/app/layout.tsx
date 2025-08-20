import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProfileProvider } from '@/contexts/ProfileContext'
import { NavigationProvider } from '@/contexts/NavigationContext'
import { I18nProvider } from '@/contexts/I18nContext'
import { UserPreferencesProvider } from '@/contexts/UserPreferencesContext'
import { TradeModalProvider } from '@/contexts/TradeModalContext'
import { WishlistModalProvider } from '@/contexts/WishlistModalContext'
import { ConfirmationProvider } from '@/contexts/ConfirmationContext'
import TestUserSwitcher from '@/components/dev/TestUserSwitcher'
import { ToastProvider } from '@/components/ui/ToastContainer'
import ScrollToTopButton from '@/components/ui/ScrollToTopButton'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-inter'
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.lumidex.app'),
  title: 'Lumidex - European Card Tracker',
  description: 'Track your Pokemon card collection with European market pricing from CardMarket. Connect with friends, trade cards, and build your dream collection.',
  keywords: 'pokemon, tcg, cards, collection, cardmarket, europe, trading, friends',
  authors: [{ name: 'Lumidex Team' }],
  openGraph: {
    title: 'Lumidex - European Card Tracker',
    description: 'Track your Pokemon card collection with European market pricing from CardMarket.',
    type: 'website',
    locale: 'en_EU',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lumidex - European Card Tracker',
    description: 'Track your Pokemon card collection with European market pricing from CardMarket.',
  },
  robots: 'index, follow',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full antialiased`}>
        <I18nProvider>
          <AuthProvider>
            <ProfileProvider>
              <UserPreferencesProvider>
                <NavigationProvider>
                  <TradeModalProvider>
                    <WishlistModalProvider>
                      <ConfirmationProvider>
                        <ToastProvider>
                          <div id="root" className="min-h-full">
                            {children}
                            <TestUserSwitcher />
                            <ScrollToTopButton />
                          </div>
                        </ToastProvider>
                      </ConfirmationProvider>
                    </WishlistModalProvider>
                  </TradeModalProvider>
                </NavigationProvider>
              </UserPreferencesProvider>
            </ProfileProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  )
}