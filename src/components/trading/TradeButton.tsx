'use client'

import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { useTradeModal } from '@/contexts/TradeModalContext'
import CardSelectionModal from './CardSelectionModal'

interface TradeButtonProps {
  recipientId: string
  recipientName: string
  recipientAvatar?: string
  initialCard?: {
    id: string
    name: string
    image_small: string
    price?: number
    set_name: string
  }
  availableCards?: Array<{
    id: string
    name: string
    image_small: string
    price?: number
    set_name: string
  }>
  variant?: 'default' | 'compact' | 'icon-only'
  className?: string
  disabled?: boolean
}

export default function TradeButton({
  recipientId,
  recipientName,
  recipientAvatar,
  initialCard,
  availableCards,
  variant = 'default',
  className = '',
  disabled = false
}: TradeButtonProps) {
  const { openTradeModal } = useTradeModal()
  const [showCardSelection, setShowCardSelection] = useState(false)

  const handleClick = () => {
    if (disabled) return
    
    // If we have multiple available cards, show selection modal
    if (availableCards && availableCards.length > 1) {
      setShowCardSelection(true)
    } else {
      // Single card or no available cards, proceed directly
      openTradeModal({
        recipientId,
        recipientName,
        recipientAvatar,
        initialCard
      })
    }
  }

  const handleCardSelection = (selectedCards: Array<{
    id: string
    name: string
    image_small: string
    price?: number
    set_name: string
  }>) => {
    if (selectedCards.length === 1) {
      // Single card selected
      openTradeModal({
        recipientId,
        recipientName,
        recipientAvatar,
        initialCard: selectedCards[0]
      })
    } else if (selectedCards.length > 1) {
      // Multiple cards selected
      openTradeModal({
        recipientId,
        recipientName,
        recipientAvatar,
        initialCards: selectedCards
      })
    }
  }

  const baseClasses = "transition-colors flex items-center justify-center"
  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"

  const renderButton = () => {
    switch (variant) {
      case 'compact':
        return (
          <button
            onClick={handleClick}
            disabled={disabled}
            className={`px-3 py-1.5 bg-pokemon-gold/20 hover:bg-pokemon-gold/30 rounded-lg space-x-1.5 ${baseClasses} ${disabledClasses} ${className}`}
            title="Propose Trade"
          >
            <ShoppingCart className="w-4 h-4 text-white" />
            <span className="text-xs font-medium text-white">Trade</span>
          </button>
        )
      
      case 'icon-only':
        return (
          <button
            onClick={handleClick}
            disabled={disabled}
            className={`p-2 bg-pokemon-gold/20 hover:bg-pokemon-gold/30 rounded-lg ${baseClasses} ${disabledClasses} ${className}`}
            title="Propose Trade"
          >
            <ShoppingCart className="w-4 h-4 text-white" />
          </button>
        )
      
      default:
        return (
          <button
            onClick={handleClick}
            disabled={disabled}
            className={`px-4 py-2 bg-pokemon-gold/20 hover:bg-pokemon-gold/30 rounded-lg space-x-2 ${baseClasses} ${disabledClasses} ${className}`}
            title="Propose Trade"
          >
            <ShoppingCart className="w-5 h-5 text-white" />
            <span className="text-sm font-medium text-white">Propose Trade</span>
          </button>
        )
    }
  }

  return (
    <>
      {renderButton()}
      
      {/* Card Selection Modal */}
      {availableCards && availableCards.length > 1 && (
        <CardSelectionModal
          isOpen={showCardSelection}
          onClose={() => setShowCardSelection(false)}
          cards={availableCards}
          recipientName={recipientName}
          onSelectCards={handleCardSelection}
        />
      )}
    </>
  )
}