// Unified app store using Zustand - replaces multiple context providers

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  User,
  UserProfileData,
  LoadingState,
  Currency,
  Language,
  PrivacyLevel,
  UIState
} from '@/types'

/**
 * Authentication state slice
 */
interface AuthState {
  user: User | null
  session: any | null
  loading: boolean
  error: string | null
  
  // Actions
  setUser: (user: User | null) => void
  setSession: (session: any | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearAuth: () => void
}

/**
 * Profile state slice
 */
interface ProfileState {
  profileData: UserProfileData | null
  loading: boolean
  error: string | null
  
  // Actions
  setProfileData: (data: UserProfileData | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  updateProfileField: <K extends keyof User>(field: K, value: User[K]) => void
}

/**
 * User preferences state slice
 */
interface PreferencesState {
  currency: Currency
  language: Language
  priceSource: string | null
  privacyLevel: PrivacyLevel
  showCollectionValue: boolean
  
  // Actions
  setCurrency: (currency: Currency) => void
  setLanguage: (language: Language) => void
  setPriceSource: (source: string | null) => void
  setPrivacyLevel: (level: PrivacyLevel) => void
  setShowCollectionValue: (show: boolean) => void
  updatePreferences: (preferences: Partial<PreferencesState>) => void
}

/**
 * Navigation state slice
 */
interface NavigationState {
  currentPath: string
  isLoading: boolean
  megaMenuOpen: boolean
  mobileDrawerOpen: boolean
  
  // Actions
  setCurrentPath: (path: string) => void
  setLoading: (loading: boolean) => void
  setMegaMenuOpen: (open: boolean) => void
  setMobileDrawerOpen: (open: boolean) => void
}

/**
 * Modal state slice
 */
interface ModalState {
  cardDetailsModal: {
    isOpen: boolean
    cardId: string | null
    tab: string
    loading: boolean
  }
  tradeModal: {
    isOpen: boolean
    tradeId: string | null
    recipientId: string | null
    mode: string
    loading: boolean
  }
  wishlistModal: {
    isOpen: boolean
    cardIds: string[]
    selectedListId: string | null
    loading: boolean
  }
  
  // Actions
  openCardDetailsModal: (cardId: string, tab?: string) => void
  closeCardDetailsModal: () => void
  openTradeModal: (recipientId: string, mode?: string) => void
  closeTradeModal: () => void
  openWishlistModal: (cardIds: string[], listId?: string) => void
  closeWishlistModal: () => void
  setModalLoading: (modal: 'cardDetails' | 'trade' | 'wishlist', loading: boolean) => void
}

/**
 * Toast notification state slice
 */
interface ToastState {
  toasts: Array<{
    id: string
    type: 'success' | 'error' | 'warning' | 'info' | 'achievement'
    title: string
    message?: string
    duration?: number
    action?: {
      label: string
      onClick: () => void
    }
    createdAt: number
  }>
  
  // Actions
  addToast: (toast: Omit<ToastState['toasts'][0], 'id' | 'createdAt'>) => void
  removeToast: (id: string) => void
  clearToasts: () => void
}

/**
 * Confirmation dialog state slice
 */
interface ConfirmationState {
  isOpen: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: (() => void) | null
  onCancel: (() => void) | null
  
  // Actions
  openConfirmation: (config: {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    onConfirm: () => void
    onCancel?: () => void
  }) => void
  closeConfirmation: () => void
}

/**
 * Combined app state
 */
type AppState = AuthState & 
  ProfileState & 
  PreferencesState & 
  NavigationState & 
  ModalState & 
  ToastState & 
  ConfirmationState

/**
 * Create the unified app store
 */
export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    // Auth state
    user: null,
    session: null,
    loading: false,
    error: null,
    
    setUser: (user) => set({ user }),
    setSession: (session) => set({ session }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    clearAuth: () => set({ user: null, session: null, error: null }),
    
    // Profile state
    profileData: null,
    
    setProfileData: (profileData) => set({ profileData }),
    updateProfileField: (field, value) => {
      const { profileData } = get()
      if (profileData) {
        set({
          profileData: {
            ...profileData,
            user: {
              ...profileData.user,
              [field]: value
            }
          }
        })
      }
    },
    
    // Preferences state
    currency: 'EUR',
    language: 'en',
    priceSource: null,
    privacyLevel: 'public',
    showCollectionValue: true,
    
    setCurrency: (currency) => set({ currency }),
    setLanguage: (language) => set({ language }),
    setPriceSource: (priceSource) => set({ priceSource }),
    setPrivacyLevel: (privacyLevel) => set({ privacyLevel }),
    setShowCollectionValue: (showCollectionValue) => set({ showCollectionValue }),
    updatePreferences: (preferences) => set(preferences),
    
    // Navigation state
    currentPath: '/',
    isLoading: false,
    megaMenuOpen: false,
    mobileDrawerOpen: false,
    
    setCurrentPath: (currentPath) => set({ currentPath }),
    setMegaMenuOpen: (megaMenuOpen) => set({ megaMenuOpen }),
    setMobileDrawerOpen: (mobileDrawerOpen) => set({ mobileDrawerOpen }),
    
    // Modal state
    cardDetailsModal: {
      isOpen: false,
      cardId: null,
      tab: 'details',
      loading: false
    },
    tradeModal: {
      isOpen: false,
      tradeId: null,
      recipientId: null,
      mode: 'create',
      loading: false
    },
    wishlistModal: {
      isOpen: false,
      cardIds: [],
      selectedListId: null,
      loading: false
    },
    
    openCardDetailsModal: (cardId, tab = 'details') => 
      set({
        cardDetailsModal: {
          isOpen: true,
          cardId,
          tab,
          loading: false
        }
      }),
    closeCardDetailsModal: () => 
      set({
        cardDetailsModal: {
          isOpen: false,
          cardId: null,
          tab: 'details',
          loading: false
        }
      }),
    openTradeModal: (recipientId, mode = 'create') =>
      set({
        tradeModal: {
          isOpen: true,
          tradeId: null,
          recipientId,
          mode,
          loading: false
        }
      }),
    closeTradeModal: () =>
      set({
        tradeModal: {
          isOpen: false,
          tradeId: null,
          recipientId: null,
          mode: 'create',
          loading: false
        }
      }),
    openWishlistModal: (cardIds, selectedListId) =>
      set({
        wishlistModal: {
          isOpen: true,
          cardIds,
          selectedListId: selectedListId || null,
          loading: false
        }
      }),
    closeWishlistModal: () =>
      set({
        wishlistModal: {
          isOpen: false,
          cardIds: [],
          selectedListId: null,
          loading: false
        }
      }),
    setModalLoading: (modal, loading) => {
      const state = get()
      if (modal === 'cardDetails') {
        set({
          cardDetailsModal: {
            ...state.cardDetailsModal,
            loading
          }
        })
      } else if (modal === 'trade') {
        set({
          tradeModal: {
            ...state.tradeModal,
            loading
          }
        })
      } else if (modal === 'wishlist') {
        set({
          wishlistModal: {
            ...state.wishlistModal,
            loading
          }
        })
      }
    },
    
    // Toast state
    toasts: [],
    
    addToast: (toast) => {
      const id = Math.random().toString(36).substr(2, 9)
      const newToast = {
        ...toast,
        id,
        createdAt: Date.now()
      }
      
      set(state => ({
        toasts: [...state.toasts, newToast]
      }))
      
      // Auto-remove toast after duration
      const duration = toast.duration || 5000
      if (duration > 0) {
        setTimeout(() => {
          set(state => ({
            toasts: state.toasts.filter(t => t.id !== id)
          }))
        }, duration)
      }
    },
    removeToast: (id) =>
      set(state => ({
        toasts: state.toasts.filter(t => t.id !== id)
      })),
    clearToasts: () => set({ toasts: [] }),
    
    // Confirmation state
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    onConfirm: null,
    onCancel: null,
    
    openConfirmation: (config) =>
      set({
        isOpen: true,
        title: config.title,
        message: config.message,
        confirmLabel: config.confirmLabel || 'Confirm',
        cancelLabel: config.cancelLabel || 'Cancel',
        onConfirm: config.onConfirm,
        onCancel: config.onCancel || null
      }),
    closeConfirmation: () =>
      set({
        isOpen: false,
        title: '',
        message: '',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        onConfirm: null,
        onCancel: null
      })
  }))
)

/**
 * Selector hooks for specific state slices to prevent unnecessary re-renders
 */
export const useAuth = () => useAppStore(state => ({
  user: state.user,
  session: state.session,
  loading: state.loading,
  error: state.error,
  setUser: state.setUser,
  setSession: state.setSession,
  setLoading: state.setLoading,
  setError: state.setError,
  clearAuth: state.clearAuth
}))

export const useProfile = () => useAppStore(state => ({
  profileData: state.profileData,
  loading: state.loading,
  error: state.error,
  setProfileData: state.setProfileData,
  setLoading: state.setLoading,
  setError: state.setError,
  updateProfileField: state.updateProfileField
}))

export const usePreferences = () => useAppStore(state => ({
  currency: state.currency,
  language: state.language,
  priceSource: state.priceSource,
  privacyLevel: state.privacyLevel,
  showCollectionValue: state.showCollectionValue,
  setCurrency: state.setCurrency,
  setLanguage: state.setLanguage,
  setPriceSource: state.setPriceSource,
  setPrivacyLevel: state.setPrivacyLevel,
  setShowCollectionValue: state.setShowCollectionValue,
  updatePreferences: state.updatePreferences
}))

export const useNavigation = () => useAppStore(state => ({
  currentPath: state.currentPath,
  isLoading: state.isLoading,
  megaMenuOpen: state.megaMenuOpen,
  mobileDrawerOpen: state.mobileDrawerOpen,
  setCurrentPath: state.setCurrentPath,
  setLoading: state.setLoading,
  setMegaMenuOpen: state.setMegaMenuOpen,
  setMobileDrawerOpen: state.setMobileDrawerOpen
}))

export const useModals = () => useAppStore(state => ({
  cardDetailsModal: state.cardDetailsModal,
  tradeModal: state.tradeModal,
  wishlistModal: state.wishlistModal,
  openCardDetailsModal: state.openCardDetailsModal,
  closeCardDetailsModal: state.closeCardDetailsModal,
  openTradeModal: state.openTradeModal,
  closeTradeModal: state.closeTradeModal,
  openWishlistModal: state.openWishlistModal,
  closeWishlistModal: state.closeWishlistModal,
  setModalLoading: state.setModalLoading
}))

export const useToasts = () => useAppStore(state => ({
  toasts: state.toasts,
  addToast: state.addToast,
  removeToast: state.removeToast,
  clearToasts: state.clearToasts
}))

export const useConfirmation = () => useAppStore(state => ({
  isOpen: state.isOpen,
  title: state.title,
  message: state.message,
  confirmLabel: state.confirmLabel,
  cancelLabel: state.cancelLabel,
  onConfirm: state.onConfirm,
  onCancel: state.onCancel,
  openConfirmation: state.openConfirmation,
  closeConfirmation: state.closeConfirmation
}))

/**
 * Store persistence middleware
 */
export const initializeStoreFromUser = (user: User | null) => {
  if (user) {
    useAppStore.getState().setUser(user)
    useAppStore.getState().updatePreferences({
      currency: user.preferred_currency,
      language: user.preferred_language,
      priceSource: user.preferred_price_source,
      privacyLevel: user.privacy_level,
      showCollectionValue: user.show_collection_value
    })
  }
}

/**
 * Store debugging helpers (development only)
 */
if (process.env.NODE_ENV === 'development') {
  // Log state changes in development
  useAppStore.subscribe(
    (state) => state,
    (state) => {
      console.log('🏪 Store updated:', state)
    }
  )
}