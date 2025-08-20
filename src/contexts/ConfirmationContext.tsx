'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'

interface ConfirmationOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'warning' | 'danger' | 'success' | 'info'
}

interface ConfirmationContextType {
  confirm: (options: ConfirmationOptions) => Promise<boolean>
}

const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined)

export function useConfirmation() {
  const context = useContext(ConfirmationContext)
  if (context === undefined) {
    throw new Error('useConfirmation must be used within a ConfirmationProvider')
  }
  return context
}

interface ConfirmationProviderProps {
  children: ReactNode
}

export function ConfirmationProvider({ children }: ConfirmationProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmationOptions | null>(null)
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null)

  const confirm = (confirmOptions: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions(confirmOptions)
      setResolvePromise(() => resolve)
      setIsOpen(true)
    })
  }

  const handleConfirm = () => {
    setIsOpen(false)
    if (resolvePromise) {
      resolvePromise(true)
      setResolvePromise(null)
    }
    setOptions(null)
  }

  const handleCancel = () => {
    setIsOpen(false)
    if (resolvePromise) {
      resolvePromise(false)
      setResolvePromise(null)
    }
    setOptions(null)
  }

  return (
    <ConfirmationContext.Provider value={{ confirm }}>
      {children}
      {options && (
        <ConfirmationModal
          isOpen={isOpen}
          onClose={handleCancel}
          onConfirm={handleConfirm}
          title={options.title}
          message={options.message}
          confirmText={options.confirmText}
          cancelText={options.cancelText}
          type={options.type}
        />
      )}
    </ConfirmationContext.Provider>
  )
}