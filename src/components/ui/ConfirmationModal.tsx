'use client'

import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react'

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'warning' | 'danger' | 'success' | 'info'
  isLoading?: boolean
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  isLoading = false
}: ConfirmationModalProps) {
  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <XCircle className="w-8 h-8 text-red-400" />
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-400" />
      case 'info':
        return <Info className="w-8 h-8 text-blue-400" />
      default:
        return <AlertTriangle className="w-8 h-8 text-yellow-400" />
    }
  }

  const getConfirmButtonStyles = () => {
    switch (type) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
      case 'success':
        return 'bg-green-600 hover:bg-green-700 disabled:bg-green-400'
      case 'info':
        return 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400'
      default:
        return 'bg-pokemon-gold hover:bg-pokemon-gold/90 disabled:bg-pokemon-gold/50 text-black'
    }
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-pkmn-card border border-gray-700/50 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex-shrink-0">
                    {getIcon()}
                  </div>
                  <div className="flex-1">
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-semibold text-white"
                    >
                      {title}
                    </Dialog.Title>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-gray-300 whitespace-pre-line">
                    {message}
                  </p>
                </div>

                <div className="flex space-x-3 justify-end">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-gray-300 bg-pkmn-surface hover:bg-pkmn-surface/80 border border-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={onClose}
                    disabled={isLoading}
                  >
                    {cancelText}
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:cursor-not-allowed flex items-center space-x-2 ${getConfirmButtonStyles()}`}
                    onClick={onConfirm}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>Processing...</span>
                      </>
                    ) : (
                      <span>{confirmText}</span>
                    )}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}