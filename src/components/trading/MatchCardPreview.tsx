'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowLeftRight, ChevronDown, ChevronUp, Eye } from 'lucide-react'
import { PriceDisplay } from '@/components/PriceDisplay'
import Link from 'next/link'
import { CardDetailsModal } from '@/components/pokemon/CardDetailsModal'

interface WishlistMatch {
  card_id: string
  card_name: string
  card_image_small: string
  card_image_large: string
  card_price: number
  card_rarity: string
  card_number: string
  set_id: string
  set_name: string
  friend_id: string
  friend_username: string
  friend_display_name?: string
  friend_avatar_url?: string
}

interface MatchCardPreviewProps {
  friendId: string
  friendName: string
  friendDisplayName?: string
  friendAvatar?: string
  iWantCards: WishlistMatch[]
  theyWantCards: WishlistMatch[]
  onTradeClick: (friendId: string, friendName: string, friendAvatar?: string, card?: WishlistMatch, availableCards?: WishlistMatch[]) => void
  maxPreviewCards?: number
}

export default function MatchCardPreview({
  friendId,
  friendName,
  friendDisplayName,
  friendAvatar,
  iWantCards,
  theyWantCards,
  onTradeClick,
  maxPreviewCards = 6
}: MatchCardPreviewProps) {
  const [showAllIWant, setShowAllIWant] = useState(false)
  const [showAllTheyWant, setShowAllTheyWant] = useState(false)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [showCardModal, setShowCardModal] = useState(false)

  const displayName = friendDisplayName || friendName

  const handleCardClick = (cardId: string) => {
    setSelectedCardId(cardId)
    setShowCardModal(true)
  }

  const closeCardModal = () => {
    setShowCardModal(false)
    setSelectedCardId(null)
  }

  // Generate high-quality image URL from andrewbackes.com API
  const getHighQualityImageUrl = (card: WishlistMatch) => {
    // Use andrewbackes.com API for high-quality images
    // Format: https://andrewbackes.com/project/pokemon/cards/{set_id}/{card_number}.png
    if (card.set_id && card.card_number) {
      return `https://andrewbackes.com/project/pokemon/cards/${card.set_id}/${card.card_number}.png`
    }
    // Fallback to database images
    return card.card_image_large || card.card_image_small
  }

  const renderCardGrid = (cards: WishlistMatch[], showAll: boolean, type: 'iwant' | 'theywant') => {
    const displayCards = showAll ? cards : cards.slice(0, maxPreviewCards)
    const hasMore = cards.length > maxPreviewCards

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-6 gap-1">
          {displayCards.map((card) => (
            <div
              key={card.card_id}
              className="bg-pkmn-surface/50 rounded p-1 hover:bg-pkmn-surface/70 transition-colors group"
            >
              <div className="relative mb-1">
                <div
                  onClick={() => handleCardClick(card.card_id)}
                  className="cursor-pointer"
                >
                  <img
                    src={getHighQualityImageUrl(card)}
                    alt={card.card_name}
                    className="w-full h-full object-contain rounded-sm group-hover:scale-105 transition-transform duration-200"
                    onError={(e) => {
                      // Fallback to database images if andrewbackes.com fails
                      const target = e.target as HTMLImageElement
                      if (target.src.includes('andrewbackes.com')) {
                        target.src = card.card_image_large || card.card_image_small
                      }
                    }}
                  />
                </div>
                <div className="absolute top-0 right-0 bg-black/80 rounded-sm px-1">
                  <PriceDisplay
                    amount={card.card_price}
                    currency="EUR"
                    showConversion={true}
                    showOriginal={false}
                    className="text-xs font-bold text-yellow-400"
                  />
                </div>
              </div>
              <div className="space-y-0.5">
                <div
                  onClick={() => handleCardClick(card.card_id)}
                  className="cursor-pointer"
                >
                  <h4 className="text-xs font-medium text-white hover:text-pokemon-gold transition-colors line-clamp-1">
                    {card.card_name}
                  </h4>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 truncate flex-1">{card.set_name}</span>
                  <button
                    onClick={() => {
                      // When clicking on a specific card's trade button, only trade that card
                      onTradeClick(friendId, displayName, friendAvatar, card)
                    }}
                    className="p-0.5 bg-pokemon-gold/20 hover:bg-pokemon-gold/30 rounded transition-colors ml-1"
                    title="Propose Trade"
                  >
                    <ArrowLeftRight className="w-2.5 h-2.5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {hasMore && (
          <button
            onClick={() => {
              if (type === 'iwant') {
                setShowAllIWant(!showAll)
              } else {
                setShowAllTheyWant(!showAll)
              }
            }}
            className="w-full py-1 text-xs text-pokemon-gold hover:text-pokemon-gold/80 transition-colors flex items-center justify-center space-x-1"
          >
            {showAll ? (
              <>
                <ChevronUp className="w-3 h-3" />
                <span>Show Less</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                <span>Show {cards.length - maxPreviewCards} More</span>
              </>
            )}
          </button>
        )}
      </div>
    )
  }

  if (iWantCards.length === 0 && theyWantCards.length === 0) {
    return null
  }

  return (
    <>
      <div className="space-y-4">
        {/* Cards I Want */}
        {iWantCards.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium text-green-400 flex items-center space-x-1">
                <Eye className="w-4 h-4" />
                <span>Cards You Want ({iWantCards.length})</span>
              </h5>
            </div>
            {renderCardGrid(iWantCards, showAllIWant, 'iwant')}
          </div>
        )}

        {/* Cards They Want */}
        {theyWantCards.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium text-blue-400 flex items-center space-x-1">
                <ArrowLeftRight className="w-4 h-4" />
                <span>Cards They Want ({theyWantCards.length})</span>
              </h5>
            </div>
            {renderCardGrid(theyWantCards, showAllTheyWant, 'theywant')}
          </div>
        )}
      </div>

      {/* Card Details Modal */}
      <CardDetailsModal
        cardId={selectedCardId}
        isOpen={showCardModal}
        onClose={closeCardModal}
      />
    </>
  )
}