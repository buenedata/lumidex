'use client'

import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// Types
export interface BreadcrumbItem {
  id: string
  label: string
  href: string
  isActive?: boolean
  dropdown?: BreadcrumbDropdownItem[]
}

export interface BreadcrumbDropdownItem {
  id: string
  label: string
  href: string
}

export interface SearchSuggestion {
  id: string
  type: 'card' | 'set' | 'series' | 'user'
  title: string
  subtitle?: string
  image?: string
  url: string
}

export interface FilterState {
  series: string[]
  sets: string[]
  rarity: string[]
  types: string[]
  priceRange: [number, number]
  sortBy: 'name' | 'number' | 'price' | 'release_date'
  sortOrder: 'asc' | 'desc'
  viewMode: 'grid' | 'list'
  showOwned: boolean
  showMissing: boolean
}

export interface NotificationData {
  id: string
  type: 'friend_request' | 'trade_request' | 'trade_accepted' | 'trade_declined'
  title: string
  message: string
  from_user: {
    id: string
    username: string
    display_name?: string
    avatar_url?: string
  }
  created_at: string
  read: boolean
  data?: any // Additional data specific to notification type
}

export interface NavigationState {
  // Current page and routing
  currentPage: string
  previousPage: string
  
  // Search state
  searchQuery: string
  searchSuggestions: SearchSuggestion[]
  recentSearches: string[]
  searchLoading: boolean
  
  // Filter state
  activeFilters: FilterState
  
  // Navigation state
  breadcrumbs: BreadcrumbItem[]
  megaMenuOpen: boolean
  mobileDrawerOpen: boolean
  
  // UI state
  isLoading: boolean
  notifications: number
  notificationData: NotificationData[]
}

// Actions
type NavigationAction =
  | { type: 'SET_CURRENT_PAGE'; payload: string }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_SEARCH_SUGGESTIONS'; payload: SearchSuggestion[] }
  | { type: 'SET_SEARCH_LOADING'; payload: boolean }
  | { type: 'ADD_RECENT_SEARCH'; payload: string }
  | { type: 'SET_FILTERS'; payload: Partial<FilterState> }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SET_BREADCRUMBS'; payload: BreadcrumbItem[] }
  | { type: 'TOGGLE_MEGA_MENU'; payload?: boolean }
  | { type: 'TOGGLE_MOBILE_DRAWER'; payload?: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_NOTIFICATIONS'; payload: number }
  | { type: 'SET_NOTIFICATION_DATA'; payload: NotificationData[] }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }

// Initial state
const initialState: NavigationState = {
  currentPage: '',
  previousPage: '',
  searchQuery: '',
  searchSuggestions: [],
  recentSearches: [],
  searchLoading: false,
  activeFilters: {
    series: [],
    sets: [],
    rarity: [],
    types: [],
    priceRange: [0, 1000],
    sortBy: 'name',
    sortOrder: 'asc',
    viewMode: 'grid',
    showOwned: true,
    showMissing: true,
  },
  breadcrumbs: [],
  megaMenuOpen: false,
  mobileDrawerOpen: false,
  isLoading: false,
  notifications: 0,
  notificationData: [],
}

// Reducer
function navigationReducer(state: NavigationState, action: NavigationAction): NavigationState {
  switch (action.type) {
    case 'SET_CURRENT_PAGE':
      return {
        ...state,
        previousPage: state.currentPage,
        currentPage: action.payload,
      }
    
    case 'SET_SEARCH_QUERY':
      return {
        ...state,
        searchQuery: action.payload,
      }
    
    case 'SET_SEARCH_SUGGESTIONS':
      return {
        ...state,
        searchSuggestions: action.payload,
      }
    
    case 'SET_SEARCH_LOADING':
      return {
        ...state,
        searchLoading: action.payload,
      }
    
    case 'ADD_RECENT_SEARCH':
      const newRecentSearches = [
        action.payload,
        ...state.recentSearches.filter(search => search !== action.payload)
      ].slice(0, 5) // Keep only 5 recent searches
      
      return {
        ...state,
        recentSearches: newRecentSearches,
      }
    
    case 'SET_FILTERS':
      return {
        ...state,
        activeFilters: {
          ...state.activeFilters,
          ...action.payload,
        },
      }
    
    case 'CLEAR_FILTERS':
      return {
        ...state,
        activeFilters: initialState.activeFilters,
      }
    
    case 'SET_BREADCRUMBS':
      return {
        ...state,
        breadcrumbs: action.payload,
      }
    
    case 'TOGGLE_MEGA_MENU':
      return {
        ...state,
        megaMenuOpen: action.payload !== undefined ? action.payload : !state.megaMenuOpen,
        mobileDrawerOpen: false, // Close mobile drawer when mega menu opens
      }
    
    case 'TOGGLE_MOBILE_DRAWER':
      return {
        ...state,
        mobileDrawerOpen: action.payload !== undefined ? action.payload : !state.mobileDrawerOpen,
        megaMenuOpen: false, // Close mega menu when mobile drawer opens
      }
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      }
    
    case 'SET_NOTIFICATIONS':
      return {
        ...state,
        notifications: action.payload,
      }
    
    case 'SET_NOTIFICATION_DATA':
      return {
        ...state,
        notificationData: action.payload,
        notifications: action.payload.filter(n => !n.read).length,
      }
    
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notificationData: state.notificationData.map(notification =>
          notification.id === action.payload
            ? { ...notification, read: true }
            : notification
        ),
        notifications: state.notificationData.filter(n => !n.read && n.id !== action.payload).length,
      }
    
    default:
      return state
  }
}

// Context
interface NavigationContextType {
  state: NavigationState
  dispatch: React.Dispatch<NavigationAction>
  
  // Helper functions
  setCurrentPage: (page: string) => void
  setSearchQuery: (query: string) => void
  addRecentSearch: (search: string) => void
  updateFilters: (filters: Partial<FilterState>) => void
  clearFilters: () => void
  setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void
  toggleMegaMenu: (open?: boolean) => void
  toggleMobileDrawer: (open?: boolean) => void
  closeMegaMenu: () => void
  closeMobileDrawer: () => void
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined)

// Provider component
interface NavigationProviderProps {
  children: React.ReactNode
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const [state, dispatch] = useReducer(navigationReducer, initialState)
  const router = useRouter()
  const pathname = usePathname()

  // Update current page when pathname changes
  useEffect(() => {
    dispatch({ type: 'SET_CURRENT_PAGE', payload: pathname })
  }, [pathname])

  // Load recent searches from localStorage
  useEffect(() => {
    const savedSearches = localStorage.getItem('recentSearches')
    if (savedSearches) {
      try {
        const searches = JSON.parse(savedSearches)
        searches.forEach((search: string) => {
          dispatch({ type: 'ADD_RECENT_SEARCH', payload: search })
        })
      } catch (error) {
        console.error('Error loading recent searches:', error)
      }
    }
  }, [])

  // Save recent searches to localStorage
  useEffect(() => {
    localStorage.setItem('recentSearches', JSON.stringify(state.recentSearches))
  }, [state.recentSearches])

  // Helper functions
  const setCurrentPage = (page: string) => {
    dispatch({ type: 'SET_CURRENT_PAGE', payload: page })
  }

  const setSearchQuery = (query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query })
  }

  const addRecentSearch = (search: string) => {
    if (search.trim()) {
      dispatch({ type: 'ADD_RECENT_SEARCH', payload: search.trim() })
    }
  }

  const updateFilters = (filters: Partial<FilterState>) => {
    dispatch({ type: 'SET_FILTERS', payload: filters })
  }

  const clearFilters = () => {
    dispatch({ type: 'CLEAR_FILTERS' })
  }

  const setBreadcrumbs = (breadcrumbs: BreadcrumbItem[]) => {
    dispatch({ type: 'SET_BREADCRUMBS', payload: breadcrumbs })
  }

  const toggleMegaMenu = (open?: boolean) => {
    dispatch({ type: 'TOGGLE_MEGA_MENU', payload: open })
  }

  const toggleMobileDrawer = (open?: boolean) => {
    dispatch({ type: 'TOGGLE_MOBILE_DRAWER', payload: open })
  }

  const closeMegaMenu = () => {
    dispatch({ type: 'TOGGLE_MEGA_MENU', payload: false })
  }

  const closeMobileDrawer = () => {
    dispatch({ type: 'TOGGLE_MOBILE_DRAWER', payload: false })
  }

  const contextValue: NavigationContextType = {
    state,
    dispatch,
    setCurrentPage,
    setSearchQuery,
    addRecentSearch,
    updateFilters,
    clearFilters,
    setBreadcrumbs,
    toggleMegaMenu,
    toggleMobileDrawer,
    closeMegaMenu,
    closeMobileDrawer,
  }

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  )
}

// Hook to use navigation context
export function useNavigation() {
  const context = useContext(NavigationContext)
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider')
  }
  return context
}

export default NavigationContext