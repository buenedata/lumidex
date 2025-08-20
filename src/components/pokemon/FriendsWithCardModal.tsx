'use client'

import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Users, ArrowLeftRight, MessageCircle, User } from 'lucide-react'
import { FriendCardOwnership } from '@/lib/card-social-service'
import { useTradeModal } from '@/contexts/TradeModalContext'
import Image from 'next/image'

interface FriendsWithCardModalProps {
  isOpen: boolean
  onClose: () => void
  friends: (FriendCardOwnership & { cardData?: any })[]
  cardName: string
  cardImage?: string
  cardId?: string
  cardPrice?: number
  cardSetName?: string
}

export function FriendsWithCardModal({
  isOpen,
  onClose,
  friends,
  cardName,
  cardImage,
  cardId,
  cardPrice,
  cardSetName
}: FriendsWithCardModalProps) {
  const { openTradeModal } = useTradeModal()

  const handleProposeTrade = (friendId: string, friendName: string, friendAvatar?: string) => {
    // Close the friends modal first
    onClose()
    
    // Find the specific friend to get their card data
    const friend = friends.find(f => f.friend_id === friendId)
    
    // For wishlist trading, we want to show the card the friend has that we want
    // The card information should represent what they're offering to us
    console.log('🔍 DEBUG: Opening trade modal with card data:', {
      cardId,
      cardName,
      cardImage,
      cardPrice,
      cardSetName,
      friendId,
      friendName,
      friendCardData: friend?.cardData
    })
    
    // Determine which card data to use
    let initialCardData = undefined
    
    if (cardId && cardId !== 'multiple' && cardName && cardImage) {
      // Single card scenario - use the modal's card data
      initialCardData = {
        id: cardId,
        name: cardName,
        image_small: cardImage,
        price: cardPrice || 0,
        set_name: cardSetName || ''
      }
    } else if (friend?.cardData) {
      // Multiple cards scenario - use the friend's specific card data
      initialCardData = {
        id: friend.cardData.id,
        name: friend.cardData.name,
        image_small: friend.cardData.image_small,
        price: friend.cardData.price || 0,
        set_name: friend.cardData.set_name || ''
      }
    }
    
    console.log('🔍 DEBUG: Final initialCard data:', initialCardData)
    
    openTradeModal({
      recipientId: friendId,
      recipientName: friendName,
      recipientAvatar: friendAvatar,
      initialCard: initialCardData
    })
  }

  const handleSendMessage = (friendId: string, friendName: string) => {
    // TODO: Implement messaging functionality
    alert(`Messaging with ${friendName} coming soon! This will open a chat interface.`)
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
          <div className="fixed inset-0 bg-black bg-opacity-75" />
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-pkmn-card p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-600 rounded-lg">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <Dialog.Title className="text-xl font-bold text-white">
                        Friends with {cardName}
                      </Dialog.Title>
                      <p className="text-sm text-gray-400">
                        {friends.length} friend{friends.length !== 1 ? 's' : ''} {friends.length === 1 ? 'has' : 'have'} this card
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={onClose}
                    className="p-2 bg-pkmn-surface rounded-full text-gray-400 hover:text-white hover:bg-gray-600 transition-colors"
                    aria-label="Close modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Card Preview */}
                {cardImage && (
                  <div className="flex justify-center mb-6">
                    <div className="relative w-24 h-32">
                      <Image
                        src={cardImage}
                        alt={cardName}
                        fill
                        className="object-contain rounded-lg shadow-lg"
                        sizes="96px"
                      />
                    </div>
                  </div>
                )}

                {/* Friends List */}
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {friends.filter(friend => friend.total_quantity > 0).map((friend) => (
                    <div
                      key={friend.friend_id}
                      className="bg-pkmn-surface rounded-lg p-4 border border-gray-600"
                    >
                      <div className="flex items-center justify-between">
                        {/* Friend Info */}
                        <div className="flex items-center space-x-3">
                          <div className="relative w-12 h-12">
                            {friend.friend_avatar_url ? (
                              <Image
                                src={friend.friend_avatar_url}
                                alt={friend.friend_display_name}
                                fill
                                className="object-cover rounded-full"
                                sizes="48px"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center">
                                <User className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                          </div>
                          
                          <div>
                            <h3 className="font-semibold text-white">
                              {friend.friend_display_name}
                            </h3>
                            <p className="text-sm text-gray-400">
                              @{friend.friend_username}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              {/* Show variant breakdown directly - no separate "X cards" text */}
                              <div className="flex items-center space-x-2 text-xs text-white font-medium">
                                {friend.variants.normal > 0 && (
                                  <span>{friend.variants.normal} Normal</span>
                                )}
                                {friend.variants.holo > 0 && (
                                  <span>{friend.variants.holo} Holo</span>
                                )}
                                {friend.variants.reverse_holo > 0 && (
                                  <span>{friend.variants.reverse_holo} Reverse</span>
                                )}
                                {friend.variants.pokeball_pattern > 0 && (
                                  <span>{friend.variants.pokeball_pattern} Poké Ball</span>
                                )}
                                {friend.variants.masterball_pattern > 0 && (
                                  <span>{friend.variants.masterball_pattern} Master Ball</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleProposeTrade(friend.friend_id, friend.friend_display_name, friend.friend_avatar_url || undefined)}
                            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            <ArrowLeftRight className="w-4 h-4" />
                            <span>Trade</span>
                          </button>
                          
                          <button
                            onClick={() => handleSendMessage(friend.friend_id, friend.friend_display_name)}
                            className="flex items-center space-x-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span>Message</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-gray-600">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-400">
                      Want to find more friends? Check out the community section!
                    </p>
                    <button
                      onClick={onClose}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}