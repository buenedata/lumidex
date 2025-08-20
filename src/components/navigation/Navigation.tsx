'use client'

import React from 'react'
import { NavigationProvider } from '@/contexts/NavigationContext'
import MainNavBar from './MainNavBar'
import EnhancedMegaMenu from './EnhancedMegaMenu'
import MobileDrawer from './MobileDrawer'
import Footer from '@/components/ui/Footer'

interface NavigationProps {
  children: React.ReactNode
  className?: string
}

export default function Navigation({ children, className = '' }: NavigationProps) {
  return (
    <NavigationProvider>
      <div className={`min-h-screen bg-pkmn-dark flex flex-col ${className}`}>
        {/* Main Navigation Bar */}
        <MainNavBar />
        
        {/* Enhanced Mega Menu */}
        <div className="relative">
          <EnhancedMegaMenu />
        </div>
        
        {/* Mobile Drawer */}
        <MobileDrawer />
        
        {/* Main Content */}
        <main className="relative flex-1">
          {children}
        </main>
        
        {/* Footer */}
        <Footer />
      </div>
    </NavigationProvider>
  )
}

// Export individual components for direct use if needed
export { MainNavBar, EnhancedMegaMenu, MobileDrawer }