'use client'

import { useState, createContext, useContext, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

interface TabsContextType {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TabsContext = createContext<TabsContextType | undefined>(undefined)

interface TabsProps {
  defaultValue: string
  children: React.ReactNode
  className?: string
  urlParam?: string // Optional URL parameter name for persistence
}

export function Tabs({ defaultValue, children, className, urlParam }: TabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Initialize tab from URL parameter if provided, otherwise use defaultValue
  const initialTab = urlParam ? (searchParams.get(urlParam) || defaultValue) : defaultValue
  const [activeTab, setActiveTab] = useState(initialTab)

  // Update URL when tab changes (if urlParam is provided)
  const handleSetActiveTab = (tab: string) => {
    setActiveTab(tab)
    
    if (urlParam) {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === defaultValue) {
        // Remove parameter if it's the default value to keep URL clean
        params.delete(urlParam)
      } else {
        params.set(urlParam, tab)
      }
      
      const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
      router.replace(newUrl, { scroll: false })
    }
  }

  // Sync with URL parameter changes
  useEffect(() => {
    if (urlParam) {
      const urlTab = searchParams.get(urlParam)
      if (urlTab && urlTab !== activeTab) {
        setActiveTab(urlTab)
      } else if (!urlTab && activeTab !== defaultValue) {
        setActiveTab(defaultValue)
      }
    }
  }, [searchParams, urlParam, activeTab, defaultValue])

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleSetActiveTab }}>
      <div className={cn('w-full', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

interface TabsListProps {
  children: React.ReactNode
  className?: string
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div className={cn(
      'inline-flex h-12 items-center justify-center rounded-lg bg-pkmn-surface p-1 text-gray-400',
      'border border-gray-700',
      className
    )}>
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const context = useContext(TabsContext)
  if (!context) throw new Error('TabsTrigger must be used within Tabs')
  
  const { activeTab, setActiveTab } = context
  const isActive = activeTab === value

  return (
    <button
      onClick={() => setActiveTab(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium',
        'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pokemon-gold',
        'disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-pokemon-gold text-white shadow-sm'
          : 'text-gray-400 hover:text-white hover:bg-pkmn-card',
        className
      )}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const context = useContext(TabsContext)
  if (!context) throw new Error('TabsContent must be used within Tabs')
  
  const { activeTab } = context
  
  if (activeTab !== value) return null

  return (
    <div className={cn(
      'mt-6 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}>
      {children}
    </div>
  )
}