'use client'

import { Fragment, useEffect } from 'react'
import { Transition } from '@headlessui/react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastProps {
  id: string
  type: ToastType
  title: string
  message?: string
  isVisible: boolean
  onClose: (id: string) => void
  duration?: number
}

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle
}

const toastStyles = {
  success: 'bg-green-600 border-green-500',
  error: 'bg-red-600 border-red-500',
  info: 'bg-blue-600 border-blue-500',
  warning: 'bg-yellow-600 border-yellow-500'
}

export function Toast({ 
  id, 
  type, 
  title, 
  message, 
  isVisible, 
  onClose, 
  duration = 4000 
}: ToastProps) {
  const Icon = toastIcons[type]

  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose(id)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [isVisible, duration, id, onClose])

  return (
    <Transition
      show={isVisible}
      as={Fragment}
      enter="transform ease-out duration-300 transition"
      enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
      enterTo="translate-y-0 opacity-100 sm:translate-x-0"
      leave="transition ease-in duration-100"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div className={`max-w-sm w-full shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden ${toastStyles[type]}`}>
        <div className="p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Icon className="h-6 w-6 text-white" aria-hidden="true" />
            </div>
            <div className="ml-3 w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium text-white">{title}</p>
              {message && (
                <p className="mt-1 text-sm text-gray-100">{message}</p>
              )}
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button
                className="rounded-md inline-flex text-gray-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
                onClick={() => onClose(id)}
              >
                <span className="sr-only">Close</span>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  )
}