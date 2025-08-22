'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/contexts/ProfileContext'
import { useNavigation } from '@/contexts/NavigationContext'
import { useNotifications } from '@/hooks/useNotifications'
import {
  Bell,
  Menu,
  X,
  ChevronDown,
  User,
  LogOut,
  Settings,
  Users,
  ArrowLeftRight,
  Star,
  ShoppingCart
} from 'lucide-react'
import EnhancedMegaMenu from './EnhancedMegaMenu'

// Navigation items configuration
const navigationItems = [
  {
    id: 'browse',
    label: 'Browse',
    href: '/cards',
    hasMegaMenu: true,
  },
  {
    id: 'collection',
    label: 'My Collection',
    href: '/collection',
    hasMegaMenu: false,
  },
  {
    id: 'trading',
    label: 'Trading',
    href: '/trades',
    hasMegaMenu: false,
    icon: ArrowLeftRight,
  },
  {
    id: 'profile',
    label: 'Profile',
    href: '/profile',
    hasMegaMenu: false,
    icon: User,
  },
]

interface MainNavBarProps {
  className?: string
}

export default function MainNavBar({ className = '' }: MainNavBarProps) {
  const { user, signOut } = useAuth()
  const { profile } = useProfile()
  const { state, toggleMegaMenu, toggleMobileDrawer } = useNavigation()
  const router = useRouter()
  
  // Initialize notifications
  useNotifications()
  
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notificationMenuRef = useRef<HTMLDivElement>(null)

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target as Node)) {
        setNotificationMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle sign out
  const handleSignOut = async () => {
    const { error } = await signOut()
    if (error) {
      console.error('Error signing out:', error.message)
    } else {
      router.push('/')
    }
  }

  // Handle navigation item hover
  const handleNavItemHover = (itemId: string) => {
    setHoveredItem(itemId)
    const item = navigationItems.find(nav => nav.id === itemId)
    if (item?.hasMegaMenu) {
      toggleMegaMenu(true)
    }
  }

  // Handle navigation item leave
  const handleNavItemLeave = () => {
    setHoveredItem(null)
    // Don't close mega menu immediately, let the mega menu component handle it
  }

  return (
    <header className={`bg-pkmn-card/80 backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3">
            <Link href="/dashboard" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
              <img
                src="/images/logos/ChatGPT Image Aug 22, 2025, 01_37_48 AM.png"
                alt="Lumidex Logo"
                className="w-8 h-8 object-contain"
              />
              <h1 className="text-xl font-bold text-pokemon-gold">
                Lumidex.app
              </h1>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = state.currentPage.startsWith(item.href)
              const isHovered = hoveredItem === item.id
              
              return (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => handleNavItemHover(item.id)}
                  onMouseLeave={handleNavItemLeave}
                >
                  <Link
                    href={item.href}
                    className={`
                      nav-link flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg
                      transition-all duration-200 relative
                      ${isActive
                        ? 'text-yellow-400 bg-pkmn-surface'
                        : 'text-gray-300 hover:text-white hover:bg-pkmn-surface'
                      }
                      ${isHovered && item.hasMegaMenu ? 'text-white bg-pkmn-surface' : ''}
                    `}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span>{item.label}</span>
                    {item.hasMegaMenu && (
                      <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${
                        state.megaMenuOpen && isHovered ? 'rotate-180' : ''
                      }`} />
                    )}
                  </Link>
                </div>
              )
            })}
          </nav>


          {/* Right Side Actions */}
          <div className="flex items-center space-x-3">
            

            {/* Notifications */}
            <div className="relative" ref={notificationMenuRef}>
              <button
                onClick={() => setNotificationMenuOpen(!notificationMenuOpen)}
                className="p-2 rounded-lg hover:bg-pkmn-surface transition-colors relative"
              >
                <Bell className="w-5 h-5 text-gray-400" />
                {state.notifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-medium">
                    {state.notifications > 9 ? '9+' : state.notifications}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {notificationMenuOpen && (
                <div className="dropdown-menu-enhanced absolute right-0 mt-3 w-80 rounded-xl py-2 z-50 animate-fade-in-up">
                  <div className="px-4 py-3 border-b border-gray-700/50">
                    <h3 className="text-white font-medium">Notifications</h3>
                    {state.notifications > 0 && (
                      <p className="text-gray-400 text-xs">{state.notifications} unread notification{state.notifications > 1 ? 's' : ''}</p>
                    )}
                  </div>
                  
                  <div className="py-2 max-h-96 overflow-y-auto">
                    {state.notificationData.length > 0 ? (
                      state.notificationData.slice(0, 5).map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => {
                            setNotificationMenuOpen(false)
                            if (notification.type === 'friend_request') {
                              router.push('/friends')
                            } else if (notification.type === 'trade_request') {
                              router.push('/trades')
                            }
                          }}
                          className="dropdown-item-enhanced flex items-center space-x-3 px-4 py-3 text-sm text-gray-300 hover:text-white group w-full text-left border-b border-gray-700/30 last:border-b-0"
                        >
                          <div className="flex-shrink-0">
                            {notification.from_user.avatar_url ? (
                              <img
                                src={notification.from_user.avatar_url}
                                alt={notification.from_user.display_name || notification.from_user.username}
                                className="w-8 h-8 rounded-full border border-pokemon-gold/30"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-pokemon-gold/20 flex items-center justify-center border border-pokemon-gold/30">
                                <span className="text-xs font-bold text-pokemon-gold">
                                  {(notification.from_user.display_name || notification.from_user.username).charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              {notification.type === 'friend_request' ? (
                                <Users className="w-3 h-3 text-blue-400 flex-shrink-0" />
                              ) : notification.type === 'trade_request' ? (
                                <ShoppingCart className="w-3 h-3 text-green-400 flex-shrink-0" />
                              ) : (
                                <Bell className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              )}
                              <div className="font-medium text-white text-xs truncate">{notification.title}</div>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-pokemon-gold rounded-full flex-shrink-0"></div>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 truncate">{notification.message}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {new Date(notification.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-gray-400">
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No new notifications</p>
                      </div>
                    )}
                    
                    {state.notificationData.length > 5 && (
                      <div className="px-4 py-2 border-t border-gray-700/50">
                        <button
                          onClick={() => {
                            setNotificationMenuOpen(false)
                            router.push('/notifications')
                          }}
                          className="text-xs text-pokemon-gold hover:text-pokemon-gold-hover transition-colors"
                        >
                          View all notifications
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Enhanced User Menu */}
            {user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-pkmn-surface transition-all duration-200 hover:scale-105 group"
                >
                  {/* User Avatar */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pokemon-gold to-pokemon-gold-hover flex items-center justify-center text-black font-semibold text-sm group-hover:shadow-lg group-hover:shadow-pokemon-gold/30 transition-all duration-200 overflow-hidden">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.display_name || profile.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{user.email?.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <span className="hidden sm:block text-sm">
                    <span className="text-white font-medium">
                      {profile?.display_name || profile?.username || user.email?.split('@')[0]}
                    </span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-all duration-200 group-hover:text-pokemon-gold ${
                    userMenuOpen ? 'rotate-180' : ''
                  }`} />
                </button>

                {/* Enhanced User Dropdown Menu */}
                {userMenuOpen && (
                  <div className="dropdown-menu-enhanced absolute right-0 mt-3 w-64 rounded-xl py-2 z-50 animate-fade-in-up">
                    {/* User Info Header */}
                    <div className="px-4 py-3 border-b border-gray-700/50">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pokemon-gold to-pokemon-gold-hover flex items-center justify-center text-black font-bold overflow-hidden">
                          {profile?.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt={profile.display_name || profile.username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{user.email?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <div className="text-white font-medium">
                            {profile?.display_name || profile?.username || user.email?.split('@')[0]}
                          </div>
                          <div className="text-gray-400 text-xs">{user.email}</div>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <Link
                        href="/profile?tab=settings"
                        className="dropdown-item-enhanced flex items-center space-x-3 px-4 py-3 text-sm text-gray-300 hover:text-white group"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings className="w-4 h-4 group-hover:text-pokemon-gold transition-colors" />
                        <div>
                          <div className="font-medium">Settings</div>
                          <div className="text-xs text-gray-500">Privacy and preferences</div>
                        </div>
                      </Link>

                    </div>

                    <hr className="my-2 border-gray-700/50" />
                    
                    <button
                      onClick={handleSignOut}
                      className="flex items-center space-x-3 w-full px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-600/20 transition-all duration-200 group"
                    >
                      <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <div>
                        <div className="font-medium">Sign Out</div>
                        <div className="text-xs text-red-500/70">End your session</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Mobile Menu Button */}
            <button
              onClick={() => toggleMobileDrawer()}
              className="md:hidden p-2 rounded-lg hover:bg-pkmn-surface transition-colors"
            >
              {state.mobileDrawerOpen ? (
                <X className="w-5 h-5 text-gray-400" />
              ) : (
                <Menu className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Mega Menu */}
      <EnhancedMegaMenu />

    </header>
  )
}