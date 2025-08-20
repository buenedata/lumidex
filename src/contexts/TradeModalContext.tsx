'use client'

import { createContext, useContext, useState, useRef, ReactNode } from 'react'
import TradeModal from '@/components/trading/TradeModal'

interface TradeModalContextType {
  openTradeModal: (params: {
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
    initialCards?: Array<{
      id: string
      name: string
      image_small: string
      price?: number
      set_name: string
    }>
    counterOfferData?: {
      originalTradeId: string
      theirCards: Array<{
        id: string
        name: string
        image_small: string
        price?: number
        set_name: string
        quantity: number
        condition: string
      }>
      myOriginalCards?: Array<{
        id: string
        name: string
        image_small: string
        price?: number
        set_name: string
        quantity: number
        condition: string
      }>
      theirMoney: number
      myOriginalMoney?: number
      theirShippingIncluded: boolean
      myOriginalShippingIncluded?: boolean
    }
  }) => void
  closeTradeModal: () => void
  isOpen: boolean
  setOnTradeCreated: (callback: (() => void) | null) => void
}

const TradeModalContext = createContext<TradeModalContextType | undefined>(undefined)

export function useTradeModal() {
  const context = useContext(TradeModalContext)
  if (context === undefined) {
    throw new Error('useTradeModal must be used within a TradeModalProvider')
  }
  return context
}

interface TradeModalProviderProps {
  children: ReactNode
}

export function TradeModalProvider({ children }: TradeModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const onTradeCreatedRef = useRef<(() => void) | null>(null)
  const [tradeParams, setTradeParams] = useState<{
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
    initialCards?: Array<{
      id: string
      name: string
      image_small: string
      price?: number
      set_name: string
    }>
    counterOfferData?: {
      originalTradeId: string
      theirCards: Array<{
        id: string
        name: string
        image_small: string
        price?: number
        set_name: string
        quantity: number
        condition: string
      }>
      myOriginalCards?: Array<{
        id: string
        name: string
        image_small: string
        price?: number
        set_name: string
        quantity: number
        condition: string
      }>
      theirMoney: number
      myOriginalMoney?: number
      theirShippingIncluded: boolean
      myOriginalShippingIncluded?: boolean
    }
  } | null>(null)

  const openTradeModal = (params: {
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
    initialCards?: Array<{
      id: string
      name: string
      image_small: string
      price?: number
      set_name: string
    }>
    counterOfferData?: {
      originalTradeId: string
      theirCards: Array<{
        id: string
        name: string
        image_small: string
        price?: number
        set_name: string
        quantity: number
        condition: string
      }>
      myOriginalCards?: Array<{
        id: string
        name: string
        image_small: string
        price?: number
        set_name: string
        quantity: number
        condition: string
      }>
      theirMoney: number
      myOriginalMoney?: number
      theirShippingIncluded: boolean
      myOriginalShippingIncluded?: boolean
    }
  }) => {
    setTradeParams(params)
    setIsOpen(true)
  }

  const closeTradeModal = () => {
    setIsOpen(false)
    setTradeParams(null)
  }

  const setOnTradeCreated = (callback: (() => void) | null) => {
    onTradeCreatedRef.current = callback
  }

  return (
    <TradeModalContext.Provider value={{ openTradeModal, closeTradeModal, isOpen, setOnTradeCreated }}>
      {children}
      {isOpen && tradeParams && (
        <TradeModal
          isOpen={isOpen}
          onClose={closeTradeModal}
          recipientId={tradeParams.recipientId}
          recipientName={tradeParams.recipientName}
          recipientAvatar={tradeParams.recipientAvatar}
          initialCard={tradeParams.initialCard}
          initialCards={tradeParams.initialCards}
          counterOfferData={tradeParams.counterOfferData}
          onTradeCreated={onTradeCreatedRef.current || undefined}
        />
      )}
    </TradeModalContext.Provider>
  )
}