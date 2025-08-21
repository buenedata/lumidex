'use client'

import { AlertTriangle, Trash2 } from 'lucide-react'

interface ResetSetConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isResetting: boolean
  setName: string
  collectedCardsCount: number
}

export function ResetSetConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  isResetting,
  setName,
  collectedCardsCount
}: ResetSetConfirmationDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-pkmn-card rounded-lg max-w-md w-full p-6 border border-gray-700">
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex-shrink-0">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Reset Set Collection</h3>
            <p className="text-sm text-gray-400">This action cannot be undone</p>
          </div>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-300 mb-3">
            Are you sure you want to remove all <strong>{collectedCardsCount}</strong> cards from <strong>{setName}</strong> from your collection?
          </p>
          <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
            <p className="text-red-300 text-sm">
              <strong>Warning:</strong> This will permanently delete all variants and quantities of every card you own from this set.
            </p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            disabled={isResetting}
            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-pkmn-card"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isResetting}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-pkmn-card flex items-center justify-center space-x-2"
          >
            {isResetting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Resetting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Reset Set</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}