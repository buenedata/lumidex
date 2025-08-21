// Compound component patterns - complex reusable components built from base components

import { ReactNode, createContext, useContext, useState } from 'react'
import { Card, Button, LoadingWrapper } from './base-components'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

/**
 * Data list compound component for consistent list displays
 */
interface DataListContextType {
  loading: boolean
  error: string | null
  isEmpty: boolean
}

const DataListContext = createContext<DataListContextType | null>(null)

interface DataListProps {
  children: ReactNode
  loading?: boolean
  error?: string | null
  data?: any[]
  emptyMessage?: string
}

interface DataListItemProps {
  children: ReactNode
  onClick?: () => void
  className?: string
}

interface DataListHeaderProps {
  children: ReactNode
  className?: string
}

interface DataListActionsProps {
  children: ReactNode
  className?: string
}

const DataList = ({ children, loading = false, error = null, data = [], emptyMessage = 'No items found' }: DataListProps) => {
  const isEmpty = !loading && !error && data.length === 0

  return (
    <DataListContext.Provider value={{ loading, error, isEmpty }}>
      <div className="space-y-4">
        {children}
      </div>
    </DataListContext.Provider>
  )
}

const DataListHeader = ({ children, className = '' }: DataListHeaderProps) => (
  <div className={`flex items-center justify-between mb-4 ${className}`}>
    {children}
  </div>
)

const DataListActions = ({ children, className = '' }: DataListActionsProps) => (
  <div className={`flex items-center space-x-2 ${className}`}>
    {children}
  </div>
)

const DataListContent = ({ children }: { children: ReactNode }) => {
  const context = useContext(DataListContext)
  if (!context) {
    throw new Error('DataListContent must be used within DataList')
  }

  return (
    <LoadingWrapper
      loading={context.loading}
      error={context.error}
      isEmpty={context.isEmpty}
      emptyMessage="No items found"
    >
      <div className="space-y-2">
        {children}
      </div>
    </LoadingWrapper>
  )
}

const DataListItem = ({ children, onClick, className = '' }: DataListItemProps) => (
  <Card
    className={`transition-colors duration-200 ${onClick ? 'hover:bg-gray-50 cursor-pointer' : ''} ${className}`}
    onClick={onClick}
    padding="md"
    shadow="sm"
  >
    {children}
  </Card>
)

// Compound component assignment
DataList.Header = DataListHeader
DataList.Actions = DataListActions
DataList.Content = DataListContent
DataList.Item = DataListItem

/**
 * Modal compound component for consistent modal structure
 */
interface ModalContextType {
  isOpen: boolean
  close: () => void
}

const ModalContext = createContext<ModalContextType | null>(null)

interface ModalProps {
  children: ReactNode
  isOpen: boolean
  onClose: () => void
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

interface ModalHeaderProps {
  children: ReactNode
  showCloseButton?: boolean
}

interface ModalBodyProps {
  children: ReactNode
  className?: string
}

interface ModalFooterProps {
  children: ReactNode
  className?: string
}

const Modal = ({ children, isOpen, onClose, size = 'md' }: ModalProps) => {
  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full h-full'
  }

  return (
    <ModalContext.Provider value={{ isOpen, close: onClose }}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className={`
          relative bg-white rounded-lg shadow-xl 
          ${sizeClasses[size]} 
          w-full max-h-screen overflow-hidden
          transform transition-all
        `}>
          {children}
        </div>
      </div>
    </ModalContext.Provider>
  )
}

const ModalHeader = ({ children, showCloseButton = true }: ModalHeaderProps) => {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('ModalHeader must be used within Modal')
  }

  return (
    <div className="flex items-center justify-between p-6 border-b border-gray-200">
      <div className="text-lg font-semibold text-gray-900">
        {children}
      </div>
      {showCloseButton && (
        <button
          onClick={context.close}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

const ModalBody = ({ children, className = '' }: ModalBodyProps) => (
  <div className={`p-6 overflow-y-auto ${className}`}>
    {children}
  </div>
)

const ModalFooter = ({ children, className = '' }: ModalFooterProps) => (
  <div className={`flex items-center justify-end space-x-2 p-6 border-t border-gray-200 bg-gray-50 ${className}`}>
    {children}
  </div>
)

// Compound component assignment
Modal.Header = ModalHeader
Modal.Body = ModalBody
Modal.Footer = ModalFooter

/**
 * Form compound component for consistent form structure
 */
interface FormContextType {
  isSubmitting: boolean
  errors: Record<string, string>
  values: Record<string, any>
  setValue: (field: string, value: any) => void
  setError: (field: string, error: string) => void
}

const FormContext = createContext<FormContextType | null>(null)

interface FormProps {
  children: ReactNode
  onSubmit: (values: Record<string, any>) => Promise<void> | void
  initialValues?: Record<string, any>
  className?: string
}

interface FormFieldProps {
  name: string
  children: ReactNode
  className?: string
}

interface FormActionsProps {
  children: ReactNode
  className?: string
}

const Form = ({ children, onSubmit, initialValues = {}, className = '' }: FormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [values, setValues] = useState<Record<string, any>>(initialValues)

  const setValue = (field: string, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }))
    // Clear error when value changes
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const setError = (field: string, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})

    try {
      await onSubmit(values)
    } catch (error) {
      if (error instanceof Error) {
        setError('submit', error.message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <FormContext.Provider value={{ isSubmitting, errors, values, setValue, setError }}>
      <form onSubmit={handleSubmit} className={className}>
        {children}
      </form>
    </FormContext.Provider>
  )
}

const FormField = ({ name, children, className = '' }: FormFieldProps) => {
  const context = useContext(FormContext)
  if (!context) {
    throw new Error('FormField must be used within Form')
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {children}
      {context.errors[name] && (
        <p className="text-sm text-red-600">{context.errors[name]}</p>
      )}
    </div>
  )
}

const FormActions = ({ children, className = '' }: FormActionsProps) => (
  <div className={`flex items-center justify-end space-x-2 pt-4 ${className}`}>
    {children}
  </div>
)

// Compound component assignment
Form.Field = FormField
Form.Actions = FormActions

/**
 * Tabs compound component for consistent tab structure
 */
interface TabsContextType {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TabsContext = createContext<TabsContextType | null>(null)

interface TabsProps {
  children: ReactNode
  defaultTab: string
  onChange?: (tab: string) => void
  className?: string
}

interface TabListProps {
  children: ReactNode
  className?: string
}

interface TabProps {
  id: string
  children: ReactNode
  disabled?: boolean
  className?: string
}

interface TabPanelProps {
  id: string
  children: ReactNode
  className?: string
}

const Tabs = ({ children, defaultTab, onChange, className = '' }: TabsProps) => {
  const [activeTab, setActiveTab] = useState(defaultTab)

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    onChange?.(tab)
  }

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

const TabList = ({ children, className = '' }: TabListProps) => (
  <div className={`flex border-b border-gray-200 ${className}`}>
    {children}
  </div>
)

const Tab = ({ id, children, disabled = false, className = '' }: TabProps) => {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('Tab must be used within Tabs')
  }

  const isActive = context.activeTab === id

  return (
    <button
      type="button"
      className={`
        px-4 py-2 text-sm font-medium border-b-2 transition-colors
        ${isActive 
          ? 'border-blue-500 text-blue-600' 
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      onClick={() => !disabled && context.setActiveTab(id)}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

const TabPanel = ({ id, children, className = '' }: TabPanelProps) => {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('TabPanel must be used within Tabs')
  }

  if (context.activeTab !== id) {
    return null
  }

  return (
    <div className={`py-4 ${className}`}>
      {children}
    </div>
  )
}

// Compound component assignment
Tabs.List = TabList
Tabs.Tab = Tab
Tabs.Panel = TabPanel

/**
 * Statistics card compound component
 */
interface StatsCardProps {
  children: ReactNode
  className?: string
}

interface StatsCardValueProps {
  children: ReactNode
  loading?: boolean
  className?: string
}

interface StatsCardLabelProps {
  children: ReactNode
  className?: string
}

interface StatsCardChangeProps {
  value: number
  className?: string
}

const StatsCard = ({ children, className = '' }: StatsCardProps) => (
  <Card className={`text-center ${className}`} padding="lg">
    {children}
  </Card>
)

const StatsCardValue = ({ children, loading = false, className = '' }: StatsCardValueProps) => (
  <div className={`text-2xl font-bold text-gray-900 ${className}`}>
    {loading ? <LoadingSpinner size="sm" /> : children}
  </div>
)

const StatsCardLabel = ({ children, className = '' }: StatsCardLabelProps) => (
  <div className={`text-sm text-gray-500 mt-1 ${className}`}>
    {children}
  </div>
)

const StatsCardChange = ({ value, className = '' }: StatsCardChangeProps) => {
  const isPositive = value > 0
  const isZero = value === 0
  
  return (
    <div className={`
      text-xs mt-2 flex items-center justify-center
      ${isZero ? 'text-gray-500' : isPositive ? 'text-green-600' : 'text-red-600'}
      ${className}
    `}>
      {!isZero && (
        <span className="mr-1">
          {isPositive ? '↗' : '↘'}
        </span>
      )}
      {Math.abs(value)}%
    </div>
  )
}

// Compound component assignment
StatsCard.Value = StatsCardValue
StatsCard.Label = StatsCardLabel
StatsCard.Change = StatsCardChange

export {
  DataList,
  Modal,
  Form,
  Tabs,
  StatsCard
}