'use client'

import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import Image from 'next/image'
import { X, ArrowLeftRight, Check } from 'lucide-react'
import { PriceDisplay } from '@/components/PriceDisplay'

interface Card {
  id: string
  name: string
  image_small: string
  price?: number
  set_name: string
}

interface CardSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  cards: Card[]
  recipientName: string
  onSelectCards: (selectedCards: Card[]) => void
}

export default function CardSelectionModal({
  isOpen,
  onClose,
  cards,
  recipientName,
  onSelectCards
}: CardSelectionModalProps) {
  const handleSingleCardTrade = (card: Card) => {
    onSelectCards([card])
    onClose()
  }

  const handleBothCardsTrade = () => {
    onSelectCards(cards)
    onClose()
  }

  // Always show the modal if there are cards - let user choose even with single cards
  if (cards.length === 0) {
    onClose()
    return null
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
          <div className="fixed inset-0 bg-black/75" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-pkmn-dark border border-gray-700 p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title className="text-xl font-bold text-white flex items-center">
                    <ArrowLeftRight className="w-5 h-5 mr-3 text-pokemon-gold" />
                    Choose Cards to Trade with {recipientName}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* Description */}
                <div className="mb-6">
                  <p className="text-gray-300 text-sm">
                    You have cards that {recipientName} wants. Choose which cards you'd like to offer in your trade:
                  </p>
                </div>

                {/* Cards Display */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {cards.map((card) => (
                    <div key={card.id} className="bg-pkmn-card rounded-xl p-4 border border-gray-700">
                      <div className="relative mb-3">
                        <Image
                          src={card.image_small}
                          alt={card.name}
                          width={150}
                          height={210}
                          className="w-full h-auto rounded-lg"
                        />
                        {card.price && (
                          <div className="absolute top-2 right-2 bg-black/70 rounded-lg px-2 py-1">
                            <PriceDisplay
                              amount={card.price}
                              currency="EUR"
                              showConversion={true}
                              showOriginal={false}
                              className="text-xs font-bold text-yellow-400"
                            />
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-white line-clamp-2">
                          {card.name}
                        </h3>
                        <p className="text-xs text-gray-400">{card.set_name}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  {/* Individual card buttons */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-300">Offer individual cards:</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {cards.map((card) => (
                        <button
                          key={card.id}
                          onClick={() => handleSingleCardTrade(card)}
                          className="w-full px-4 py-3 bg-pkmn-surface hover:bg-pkmn-card border border-gray-600 hover:border-pokemon-gold/50 rounded-lg transition-colors text-left"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-white">{card.name}</div>
                              <div className="text-xs text-gray-400">{card.set_name}</div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {card.price && (
                                <PriceDisplay
                                  amount={card.price}
                                  currency="EUR"
                                  showConversion={true}
                                  showOriginal={false}
                                  className="text-sm font-bold text-yellow-400"
                                />
                              )}
                              <ArrowLeftRight className="w-4 h-4 text-pokemon-gold" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Both cards button */}
                  <div className="pt-3 border-t border-gray-600">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Or offer both cards together:</h4>
                    <button
                      onClick={handleBothCardsTrade}
                      className="w-full px-4 py-3 bg-pokemon-gold/20 hover:bg-pokemon-gold/30 border border-pokemon-gold/50 hover:border-pokemon-gold rounded-lg transition-colors"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <Check className="w-4 h-4 text-pokemon-gold" />
                        <span className="text-sm font-medium text-white">
                          Offer Both Cards
                        </span>
                        <span className="text-xs text-gray-300">
                          ({cards.length} cards total)
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Cancel Button */}
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    Cancel
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