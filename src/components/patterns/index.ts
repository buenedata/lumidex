// Component patterns exports - unified access to all pattern components and hooks

// Base components
export {
  Container,
  Card,
  Button,
  Input,
  LoadingWrapper
} from './base-components'

// Compound components
export {
  DataList,
  Modal,
  Form,
  Tabs,
  StatsCard
} from './compound-components'

// Error handling components
export {
  ErrorBoundary,
  AsyncErrorBoundary,
  ErrorToast,
  InlineError,
  ErrorRetryWrapper,
  NetworkErrorWrapper
} from './error-handling'

// Loading state components
export {
  LoadingSpinner,
  LoadingSkeleton,
  LoadingOverlay,
  ProgressiveLoading,
  LazyLoadWrapper,
  LoadingButton,
  DataLoadingState,
  LoadingBoundary,
  StaggeredLoading
} from './loading-states'

// Custom hooks
export {
  useModal,
  useTabs,
  useForm,
  usePagination,
  useDebounce,
  useSearch,
  useLocalStorage,
  useAsync,
  useKeyboardShortcut,
  useClickOutside,
  useDataFetch,
  useDataMutation
} from './hooks'

// Re-export types for convenience
export type {
  ContainerProps,
  CardProps,
  ButtonProps,
  InputProps,
  LoadingWrapperProps
} from './base-components'