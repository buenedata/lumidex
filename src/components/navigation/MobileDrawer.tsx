'use client'

import React, { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigation } from '@/contexts/NavigationContext'
import {
  X,
  Search,
  Home,
  Users,
  ArrowLeftRight,
  BarChart3,
  Star,
  Settings,
  User,
  LogOut,
  ChevronRight,
  Calendar,
  TrendingUp,
  Zap
} from 'lucide-react'

interface MobileDrawerProps {
  className?: string
}

export default function MobileDrawer({ className = '' }: MobileDrawerProps) {
  const { user, signOut } = useAuth()
  const { state, toggleMobileDrawer } = useNavigation()
  const router = useRouter()
  const drawerRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close drawer
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        toggleMobileDrawer(false)
      }
    }

    if (state.mobileDrawerOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [state.mobileDrawerOpen, toggleMobileDrawer])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (state.mobileDrawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [state.mobileDrawerOpen])

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (error) {
      console.error('Error signing out:', error.message)
    } else {
      toggleMobileDrawer(false)
      router.push('/')
    }
  }

  const handleLinkClick = () => {
    toggleMobileDrawer(false)
  }

  // Pre-define icon components to avoid temporal dead zone issues
  const HomeIcon = Home
  const SearchIcon = Search
  const BarChart3Icon = BarChart3
  const ArrowLeftRightIcon = ArrowLeftRight
  const UsersIcon = Users
  const CalendarIcon = Calendar
  const TrendingUpIcon = TrendingUp
  const StarIcon = Star
  const ZapIcon = Zap

  const mainNavItems = [
    { label: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { label: 'Browse Cards', href: '/cards', icon: SearchIcon },
    { label: 'My Collection', href: '/collection', icon: BarChart3Icon },
    { label: 'Trading', href: '/trades', icon: ArrowLeftRightIcon },
    { label: 'Friends', href: '/friends', icon: UsersIcon },
  ]

  const browseItems = [
    { label: 'All Cards', href: '/cards', icon: SearchIcon },
    { label: 'New Releases', href: '/cards?sort=release_date&order=desc', icon: CalendarIcon },
    { label: 'Popular Cards', href: '/cards?sort=popularity', icon: TrendingUpIcon },
    { label: 'High Value Cards', href: '/cards?sort=price&order=desc', icon: StarIcon },
    { label: 'Promo Cards', href: '/cards?rarity=Promo', icon: ZapIcon },
  ]

  const seriesItems = [
    { label: 'Scarlet & Violet', href: '/cards?series=Scarlet%20%26%20Violet' },
    { label: 'Sword & Shield', href: '/cards?series=Sword%20%26%20Shield' },
    { label: 'Sun & Moon', href: '/cards?series=Sun%20%26%20Moon' },
    { label: 'XY', href: '/cards?series=XY' },
    { label: 'Black & White', href: '/cards?series=Black%20%26%20White' },
  ]

  const collectionItems = [
    { label: 'My Cards', href: '/collection', icon: BarChart3Icon },
  ]

  const socialItems = [
    { label: 'Friends', href: '/friends', icon: UsersIcon },
    { label: 'Trading', href: '/trades', icon: ArrowLeftRightIcon },
    { label: 'Matches', href: '/matches', icon: TrendingUpIcon },
  ]

  if (!state.mobileDrawerOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" />
      
      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`
          fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-pkmn-card border-l border-gray-700
          transform transition-transform duration-300 ease-out z-50 md:hidden
          ${state.mobileDrawerOpen ? 'translate-x-0' : 'translate-x-full'}
          ${className}
        `}
      >
        <div className="flex flex-col h-full">
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="text-xl">🃏</div>
              <h2 className="text-lg font-bold text-pokemon-gold">Menu</h2>
            </div>
            <button
              onClick={() => toggleMobileDrawer(false)}
              className="p-2 rounded-lg hover:bg-pkmn-surface transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-6">
              
              {/* Main Navigation */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Navigation
                </h3>
                <div className="space-y-1">
                  {mainNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = state.currentPage.startsWith(item.href)
                    
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleLinkClick}
                        className={`
                          flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors
                          ${isActive 
                            ? 'bg-pokemon-gold/10 text-pokemon-gold' 
                            : 'text-gray-300 hover:text-white hover:bg-pkmn-surface'
                          }
                        `}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>

              {/* Browse Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Browse
                </h3>
                <div className="space-y-1">
                  {browseItems.map((item) => {
                    const Icon = item.icon
                    
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleLinkClick}
                        className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-pkmn-surface transition-colors"
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>

              {/* Series Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  By Series
                </h3>
                <div className="space-y-1">
                  {seriesItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleLinkClick}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-pkmn-surface transition-colors"
                    >
                      <span className="text-sm">{item.label}</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Collection Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Collection
                </h3>
                <div className="space-y-1">
                  {collectionItems.map((item) => {
                    const Icon = item.icon
                    
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleLinkClick}
                        className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-pkmn-surface transition-colors"
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>

              {/* Social Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Social
                </h3>
                <div className="space-y-1">
                  {socialItems.map((item) => {
                    const Icon = item.icon
                    
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleLinkClick}
                        className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-pkmn-surface transition-colors"
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Footer - User Actions */}
          {user && (
            <div className="border-t border-gray-700 p-4">
              <div className="space-y-1">
                <Link
                  href="/profile"
                  onClick={handleLinkClick}
                  className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-pkmn-surface transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span className="text-sm">Profile</span>
                </Link>
                <Link
                  href="/settings"
                  onClick={handleLinkClick}
                  className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-pkmn-surface transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-sm">Settings</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-3 w-full px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-600/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm">Sign Out</span>
                </button>
              </div>
              
              {/* User Info */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="text-xs text-gray-400">
                  Signed in as
                </div>
                <div className="text-sm text-pokemon-gold font-medium">
                  {user.email?.split('@')[0]}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}