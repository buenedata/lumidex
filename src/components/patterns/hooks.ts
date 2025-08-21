// Custom hooks for component patterns - reusable logic for common UI patterns

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * Hook for managing modal state
 */
interface UseModalOptions {
  defaultOpen?: boolean
  onOpen?: () => void
  onClose?: () => void
}

export const useModal = (options: UseModalOptions = {}) => {
  const [isOpen, setIsOpen] = useState(options.defaultOpen || false)

  const open = useCallback(() => {
    setIsOpen(true)
    options.onOpen?.()
  }, [options])

  const close = useCallback(() => {
    setIsOpen(false)
    options.onClose?.()
  }, [options])

  const toggle = useCallback(() => {
    if (isOpen) {
      close()
    } else {
      open()
    }
  }, [isOpen, open, close])

  return {
    isOpen,
    open,
    close,
    toggle
  }
}

/**
 * Hook for managing tabs state
 */
interface UseTabsOptions {
  defaultTab: string
  onChange?: (tab: string) => void
}

export const useTabs = ({ defaultTab, onChange }: UseTabsOptions) => {
  const [activeTab, setActiveTab] = useState(defaultTab)

  const setTab = useCallback((tab: string) => {
    setActiveTab(tab)
    onChange?.(tab)
  }, [onChange])

  return {
    activeTab,
    setTab
  }
}

/**
 * Hook for managing form state with validation
 */
interface UseFormOptions<T> {
  initialValues: T
  validate?: (values: T) => Record<string, string>
  onSubmit: (values: T) => Promise<void> | void
}

export const useForm = <T extends Record<string, any>>({
  initialValues,
  validate,
  onSubmit
}: UseFormOptions<T>) => {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const setValue = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }))
    
    // Clear error when value changes
    if (errors[field as string]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field as string]
        return newErrors
      })
    }
  }, [errors])

  const setFieldTouched = useCallback((field: keyof T, isTouched = true) => {
    setTouched(prev => ({ ...prev, [field]: isTouched }))
  }, [])

  const validateForm = useCallback(() => {
    if (!validate) return true

    const validationErrors = validate(values)
    setErrors(validationErrors)
    return Object.keys(validationErrors).length === 0
  }, [validate, values])

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    
    setIsSubmitting(true)
    
    // Mark all fields as touched
    const allFields = Object.keys(values)
    setTouched(allFields.reduce((acc, field) => ({ ...acc, [field]: true }), {}))

    try {
      if (validateForm()) {
        await onSubmit(values)
      }
    } catch (error) {
      if (error instanceof Error) {
        setErrors(prev => ({ ...prev, submit: error.message }))
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [values, validateForm, onSubmit])

  const resetForm = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
    setIsSubmitting(false)
  }, [initialValues])

  return {
    values,
    errors,
    touched,
    isSubmitting,
    setValue,
    setFieldTouched,
    handleSubmit,
    resetForm,
    isValid: Object.keys(errors).length === 0
  }
}

/**
 * Hook for managing pagination
 */
interface UsePaginationOptions {
  total: number
  pageSize: number
  initialPage?: number
}

export const usePagination = ({ total, pageSize, initialPage = 1 }: UsePaginationOptions) => {
  const [currentPage, setCurrentPage] = useState(initialPage)
  
  const totalPages = Math.ceil(total / pageSize)
  const hasNext = currentPage < totalPages
  const hasPrev = currentPage > 1
  
  const nextPage = useCallback(() => {
    if (hasNext) {
      setCurrentPage(prev => prev + 1)
    }
  }, [hasNext])
  
  const prevPage = useCallback(() => {
    if (hasPrev) {
      setCurrentPage(prev => prev - 1)
    }
  }, [hasPrev])
  
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }, [totalPages])

  const getPageItems = useCallback(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return { startIndex, endIndex }
  }, [currentPage, pageSize])

  return {
    currentPage,
    totalPages,
    hasNext,
    hasPrev,
    nextPage,
    prevPage,
    goToPage,
    getPageItems
  }
}

/**
 * Hook for debounced values
 */
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Hook for managing search with debounce
 */
interface UseSearchOptions {
  onSearch: (query: string) => void
  debounceMs?: number
  minLength?: number
}

export const useSearch = ({ onSearch, debounceMs = 300, minLength = 2 }: UseSearchOptions) => {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const debouncedQuery = useDebounce(query, debounceMs)

  useEffect(() => {
    if (debouncedQuery.length >= minLength) {
      setIsSearching(true)
      onSearch(debouncedQuery)
      setIsSearching(false)
    }
  }, [debouncedQuery, onSearch, minLength])

  const clearSearch = useCallback(() => {
    setQuery('')
  }, [])

  return {
    query,
    setQuery,
    isSearching,
    clearSearch
  }
}

/**
 * Hook for managing local storage
 */
export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window !== 'undefined') {
        const item = window.localStorage.getItem(key)
        return item ? JSON.parse(item) : initialValue
      }
      return initialValue
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error)
    }
  }, [key, storedValue])

  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue)
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key)
      }
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error)
    }
  }, [key, initialValue])

  return [storedValue, setValue, removeValue] as const
}

/**
 * Hook for managing async operations with loading states
 */
interface UseAsyncOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

export const useAsync = <T>(
  asyncFunction: () => Promise<T>,
  options: UseAsyncOptions<T> = {}
) => {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await asyncFunction()
      setData(result)
      options.onSuccess?.(result)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An error occurred')
      setError(error)
      options.onError?.(error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [asyncFunction, options])

  return {
    data,
    loading,
    error,
    execute
  }
}

/**
 * Hook for managing keyboard shortcuts
 */
interface UseKeyboardShortcutOptions {
  enabled?: boolean
  preventDefault?: boolean
}

export const useKeyboardShortcut = (
  keys: string[],
  callback: () => void,
  options: UseKeyboardShortcutOptions = {}
) => {
  const { enabled = true, preventDefault = true } = options

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const pressedKeys: string[] = []
      
      if (event.ctrlKey) pressedKeys.push('ctrl')
      if (event.metaKey) pressedKeys.push('cmd')
      if (event.shiftKey) pressedKeys.push('shift')
      if (event.altKey) pressedKeys.push('alt')
      
      pressedKeys.push(event.key.toLowerCase())

      const isMatch = keys.every(key => pressedKeys.includes(key.toLowerCase()))
      
      if (isMatch) {
        if (preventDefault) {
          event.preventDefault()
        }
        callback()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [keys, callback, enabled, preventDefault])
}

/**
 * Hook for managing click outside detection
 */
export const useClickOutside = (
  ref: React.RefObject<HTMLElement>,
  callback: () => void,
  enabled = true
) => {
  useEffect(() => {
    if (!enabled) return

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [ref, callback, enabled])
}

/**
 * Hook for managing data fetching with React Query integration
 */
interface UseDataFetchOptions<T> {
  queryKey: string[]
  fetchFn: () => Promise<T>
  enabled?: boolean
  staleTime?: number
  gcTime?: number
}

export const useDataFetch = <T>({
  queryKey,
  fetchFn,
  enabled = true,
  staleTime = 5 * 60 * 1000, // 5 minutes
  gcTime = 10 * 60 * 1000 // 10 minutes
}: UseDataFetchOptions<T>) => {
  return useQuery({
    queryKey,
    queryFn: fetchFn,
    enabled,
    staleTime,
    gcTime
  })
}

/**
 * Hook for managing mutations with optimistic updates
 */
interface UseMutationOptions<T, V> {
  mutationFn: (variables: V) => Promise<T>
  onSuccess?: (data: T, variables: V) => void
  onError?: (error: Error, variables: V) => void
  invalidateQueries?: string[][]
}

export const useDataMutation = <T, V>({
  mutationFn,
  onSuccess,
  onError,
  invalidateQueries = []
}: UseMutationOptions<T, V>) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      // Invalidate related queries
      invalidateQueries.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey })
      })
      
      onSuccess?.(data, variables)
    },
    onError: (error: Error, variables) => {
      onError?.(error, variables)
    }
  })
}