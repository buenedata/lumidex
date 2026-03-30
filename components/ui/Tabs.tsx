'use client'

import { createContext, useContext, useState } from 'react'
import { cn } from '@/lib/utils'

// ── Context ──────────────────────────────────────────────────────
interface TabsContextValue { active: string; setActive: (v: string) => void }
const TabsCtx = createContext<TabsContextValue>({ active: '', setActive: () => {} })

// ── Root ─────────────────────────────────────────────────────────
interface TabsProps {
  defaultValue: string
  children: React.ReactNode
  className?: string
  onChange?: (value: string) => void
}

export function Tabs({ defaultValue, children, className, onChange }: TabsProps) {
  const [active, setActive] = useState(defaultValue)
  function handleChange(v: string) {
    setActive(v)
    onChange?.(v)
  }
  return (
    <TabsCtx.Provider value={{ active, setActive: handleChange }}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  )
}

// ── List (tab bar) ────────────────────────────────────────────────
export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      className={cn('flex items-center gap-0 border-b border-subtle', className)}
    >
      {children}
    </div>
  )
}

// ── Trigger ────────────────────────────────────────────────────────
interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { active, setActive } = useContext(TabsCtx)
  const isActive = active === value
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActive(value)}
      className={cn(
        'px-4 py-2.5 text-sm font-medium transition-all duration-150 -mb-px',
        isActive ? 'tab-active' : 'tab-inactive',
        className
      )}
    >
      {children}
    </button>
  )
}

// ── Content ────────────────────────────────────────────────────────
interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { active } = useContext(TabsCtx)
  if (active !== value) return null
  return <div className={className}>{children}</div>
}

// ── Legacy default export (backward compat) ───────────────────────
interface LegacyTabItem {
  label: string
  content?: React.ReactNode
  count?: number
}

interface LegacyTabsProps {
  tabs: LegacyTabItem[]
  selectedIndex?: number
  onChange?: (index: number) => void
  className?: string
}

export default function LegacyTabs({
  tabs,
  selectedIndex = 0,
  onChange,
  className = '',
}: LegacyTabsProps) {
  const [selected, setSelected] = useState(selectedIndex)

  const handleChange = (index: number) => {
    setSelected(index)
    onChange?.(index)
  }

  return (
    <div className={className}>
      <div role="tablist" className="flex items-center gap-0 border-b border-subtle">
        {tabs.map((tab, index) => (
          <button
            key={index}
            role="tab"
            aria-selected={selected === index}
            onClick={() => handleChange(index)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-all duration-150 -mb-px',
              selected === index ? 'tab-active' : 'tab-inactive'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1 text-xs opacity-70">({tab.count})</span>
            )}
          </button>
        ))}
      </div>
      {tabs.some(tab => tab.content) && (
        <div className="mt-4">
          {tabs[selected]?.content}
        </div>
      )}
    </div>
  )
}
