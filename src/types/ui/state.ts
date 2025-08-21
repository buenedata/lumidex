// UI state types - loading states, form states, and component-specific types

import { LoadingState, AsyncState, AppError } from '../core/common'

/**
 * Generic form state for all forms
 */
export interface FormState<T = Record<string, any>> {
  data: T
  errors: Record<keyof T, string[]>
  touched: Record<keyof T, boolean>
  isValid: boolean
  isSubmitting: boolean
  submitError?: string
  submitSuccess?: boolean
}

/**
 * Modal state management
 */
export interface ModalState<T = any> {
  isOpen: boolean
  data?: T
  loading: boolean
  error?: string
}

/**
 * List view state (for tables, grids, etc.)
 */
export interface ListViewState<T = any> {
  items: T[]
  loading: boolean
  error?: AppError
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
  }
  filters: Record<string, any>
  sorting: {
    field: string
    direction: 'asc' | 'desc'
  }
  selection: {
    selectedIds: Set<string>
    selectAll: boolean
  }
}

/**
 * Search state
 */
export interface SearchState<T = any> {
  query: string
  results: T[]
  suggestions: string[]
  loading: boolean
  error?: string
  hasSearched: boolean
  recentSearches: string[]
}

/**
 * Toast notification state
 */
export interface ToastState {
  id: string
  type: 'success' | 'error' | 'warning' | 'info' | 'achievement'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
  isVisible: boolean
  createdAt: number
}

/**
 * Navigation state
 */
export interface NavigationState {
  currentPath: string
  breadcrumbs: BreadcrumbItem[]
  isLoading: boolean
  backStack: string[]
  forwardStack: string[]
}

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  label: string
  path: string
  isActive: boolean
}

/**
 * Tab state management
 */
export interface TabState<T extends string | number | symbol = string> {
  activeTab: T
  tabs: TabItem<T>[]
  loading: Record<T, boolean>
  errors: Record<T, string | undefined>
}

/**
 * Tab item definition
 */
export interface TabItem<T extends string | number | symbol = string> {
  id: T
  label: string
  icon?: string
  badge?: number | string
  disabled?: boolean
}

/**
 * Drawer/Sidebar state
 */
export interface DrawerState {
  isOpen: boolean
  size: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  position: 'left' | 'right' | 'top' | 'bottom'
  overlay: boolean
  persistent: boolean
}

/**
 * Card details modal state
 */
export interface CardDetailsModalState {
  isOpen: boolean
  cardId?: string
  tab: 'details' | 'collection' | 'trading' | 'history'
  loading: boolean
  error?: string
}

/**
 * Trade modal state
 */
export interface TradeModalState {
  isOpen: boolean
  mode: 'create' | 'view' | 'respond'
  tradeId?: string
  recipientId?: string
  initialCards?: string[]
  step: 'select_cards' | 'configure' | 'review' | 'confirm'
  loading: boolean
  error?: string
}

/**
 * Wishlist modal state
 */
export interface WishlistModalState {
  isOpen: boolean
  mode: 'add' | 'edit' | 'bulk_add'
  cardIds: string[]
  selectedListId?: string
  defaultPriority: number
  loading: boolean
  error?: string
}

/**
 * Collection view state
 */
export interface CollectionViewState extends ListViewState {
  viewMode: 'grid' | 'list' | 'compact'
  groupBy: 'none' | 'set' | 'rarity' | 'type'
  showVariants: boolean
  showValues: boolean
  cardSize: 'sm' | 'md' | 'lg'
}

/**
 * Dashboard state
 */
export interface DashboardState {
  widgets: DashboardWidget[]
  layout: DashboardLayout
  customizing: boolean
  loading: boolean
  lastRefresh?: string
}

/**
 * Dashboard widget configuration
 */
export interface DashboardWidget {
  id: string
  type: 'stats' | 'recent_activity' | 'achievements' | 'friends' | 'collection_insights' | 'wanted_board'
  title: string
  size: 'sm' | 'md' | 'lg'
  position: { x: number; y: number }
  visible: boolean
  loading: boolean
  error?: string
  data?: any
}

/**
 * Dashboard layout configuration
 */
export interface DashboardLayout {
  columns: number
  gap: number
  responsive: boolean
}

/**
 * Theme state
 */
export interface ThemeState {
  mode: 'light' | 'dark' | 'auto'
  primaryColor: string
  accentColor: string
  fontSize: 'sm' | 'md' | 'lg'
  compactMode: boolean
  animations: boolean
}

/**
 * Notification preferences state
 */
export interface NotificationState {
  email: boolean
  push: boolean
  desktop: boolean
  sound: boolean
  types: {
    trades: boolean
    friends: boolean
    achievements: boolean
    priceAlerts: boolean
    collectionMatches: boolean
  }
  doNotDisturb: {
    enabled: boolean
    startTime: string
    endTime: string
  }
}

/**
 * Offline state management
 */
export interface OfflineState {
  isOnline: boolean
  lastOnline?: string
  pendingSync: PendingSyncItem[]
  syncInProgress: boolean
  syncError?: string
}

/**
 * Pending sync item for offline support
 */
export interface PendingSyncItem {
  id: string
  type: 'collection_update' | 'wishlist_update' | 'profile_update'
  action: 'create' | 'update' | 'delete'
  data: any
  timestamp: string
  retryCount: number
}

/**
 * Performance monitoring state
 */
export interface PerformanceState {
  loadTimes: Record<string, number>
  errorCounts: Record<string, number>
  memoryUsage?: number
  renderCounts: Record<string, number>
  apiLatency: Record<string, number[]>
}

/**
 * Global UI state combining all component states
 */
export interface UIState {
  navigation: NavigationState
  theme: ThemeState
  notifications: NotificationState
  toasts: ToastState[]
  modals: {
    cardDetails: CardDetailsModalState
    trade: TradeModalState
    wishlist: WishlistModalState
    [key: string]: ModalState
  }
  drawers: {
    main: DrawerState
    filters: DrawerState
    [key: string]: DrawerState
  }
  dashboard: DashboardState
  collection: CollectionViewState
  search: SearchState
  offline: OfflineState
  performance: PerformanceState
}

/**
 * Action types for UI state management
 */
export type UIAction = 
  | { type: 'NAVIGATION_SET_PATH'; payload: string }
  | { type: 'NAVIGATION_SET_LOADING'; payload: boolean }
  | { type: 'THEME_SET_MODE'; payload: 'light' | 'dark' | 'auto' }
  | { type: 'THEME_SET_COLOR'; payload: { primary?: string; accent?: string } }
  | { type: 'TOAST_ADD'; payload: Omit<ToastState, 'id' | 'isVisible' | 'createdAt'> }
  | { type: 'TOAST_REMOVE'; payload: string }
  | { type: 'MODAL_OPEN'; payload: { name: string; data?: any } }
  | { type: 'MODAL_CLOSE'; payload: string }
  | { type: 'DRAWER_TOGGLE'; payload: string }
  | { type: 'COLLECTION_SET_VIEW_MODE'; payload: 'grid' | 'list' | 'compact' }
  | { type: 'COLLECTION_SET_FILTERS'; payload: Record<string, any> }
  | { type: 'SEARCH_SET_QUERY'; payload: string }
  | { type: 'SEARCH_SET_RESULTS'; payload: any[] }
  | { type: 'OFFLINE_SET_STATUS'; payload: boolean }
  | { type: 'PERFORMANCE_LOG_LOAD_TIME'; payload: { page: string; time: number } }

/**
 * UI hook return types for consistent interfaces
 */
export interface UseModalReturn<T = any> {
  isOpen: boolean
  data?: T
  loading: boolean
  error?: string
  open: (data?: T) => void
  close: () => void
  setLoading: (loading: boolean) => void
  setError: (error?: string) => void
}

export interface UseFormReturn<T = any> {
  values: T
  errors: Record<keyof T, string[]>
  touched: Record<keyof T, boolean>
  isValid: boolean
  isSubmitting: boolean
  setValue: (field: keyof T, value: any) => void
  setError: (field: keyof T, error: string) => void
  setTouched: (field: keyof T, touched: boolean) => void
  submit: () => Promise<void>
  reset: () => void
  validate: () => boolean
}

export interface UseListReturn<T = any> {
  items: T[]
  loading: boolean
  error?: AppError
  pagination: ListViewState['pagination']
  filters: Record<string, any>
  sorting: ListViewState['sorting']
  selection: ListViewState['selection']
  refresh: () => Promise<void>
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  setFilters: (filters: Record<string, any>) => void
  setSorting: (field: string, direction?: 'asc' | 'desc') => void
  selectItem: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
}

/**
 * Component prop types for consistent interfaces
 */
export interface BaseComponentProps {
  className?: string
  testId?: string
  loading?: boolean
  disabled?: boolean
  error?: string | AppError
}

export interface ListComponentProps<T = any> extends BaseComponentProps {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  emptyState?: React.ReactNode
  loadingState?: React.ReactNode
  errorState?: React.ReactNode
  pagination?: boolean
  selection?: boolean
  onSelectionChange?: (selectedIds: string[]) => void
}

export interface ModalComponentProps extends BaseComponentProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closable?: boolean
  maskClosable?: boolean
}