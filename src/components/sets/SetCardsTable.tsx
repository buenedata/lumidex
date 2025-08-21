'use client'

import { Eye, ShoppingCart } from 'lucide-react'
import { PriceDisplay } from '@/components/PriceDisplay'
import { FallbackImage } from '@/components/ui/FallbackImage'

interface CardData {
  id: string
  name: string
  number: string
  rarity: string
  types: string[]
  image_small: string
  image_large: string
  cardmarket_avg_sell_price: number | null
  cardmarket_low_price: number | null
  cardmarket_trend_price: number | null
}

interface SetCardsTableProps {
  cards: CardData[]
  user?: any
  userCollection: Record<string, number>
  loadingStates: Record<string, boolean>
  highlightedCardId: string | null
  collectionMode: 'regular' | 'master'
  isCardCompletedInMode: (card: CardData) => boolean
  isCardCollected: (card: CardData) => boolean
  isCardComplete: (card: CardData) => boolean
  onToggleCollection: (cardId: string) => void
  onViewDetails: (cardId: string) => void
}

export function SetCardsTable({
  cards,
  user,
  userCollection,
  loadingStates,
  highlightedCardId,
  collectionMode,
  isCardCompletedInMode,
  isCardCollected,
  isCardComplete,
  onToggleCollection,
  onViewDetails
}: SetCardsTableProps) {
  return (
    <div className="card-container overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-3 px-4 text-gray-300 font-medium">Number</th>
            <th className="text-left py-3 px-4 text-gray-300 font-medium">Name</th>
            <th className="text-left py-3 px-4 text-gray-300 font-medium">Rarity</th>
            <th className="text-left py-3 px-4 text-gray-300 font-medium">Price</th>
            {user && <th className="text-left py-3 px-4 text-gray-300 font-medium">Owned</th>}
            <th className="text-left py-3 px-4 text-gray-300 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => {
            const cardComplete = isCardCompletedInMode(card)
            const cardCollected = isCardCollected(card)
            const cardMasterComplete = isCardComplete(card)
            
            return (
              <tr
                key={card.id}
                data-card-id={card.id}
                className={`border-b border-gray-800 hover:bg-pkmn-surface/30 transition-colors ${
                  highlightedCardId === card.id ? 'bg-pokemon-gold/20 ring-2 ring-pokemon-gold ring-opacity-50' : ''
                } ${cardComplete ? 'opacity-60' : ''}`}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-pokemon-gold font-medium">#{card.number}</span>
                    {cardComplete && (
                      <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full font-medium">
                        ✓ {collectionMode === 'master' ? 'Master' : 'Complete'}
                      </span>
                    )}
                    {collectionMode === 'regular' && cardCollected && cardMasterComplete && (
                      <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full font-medium">
                        ★ Master
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <FallbackImage
                        src={card.image_small}
                        alt={card.name}
                        width={40}
                        height={56}
                        className={`rounded ${cardComplete ? 'grayscale' : ''}`}
                        fallbackSrc="/placeholder-card.png"
                      />
                      {cardComplete && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                            ✓
                          </div>
                        </div>
                      )}
                    </div>
                    <span className={`font-medium ${cardComplete ? 'text-gray-400' : 'text-white'}`}>
                      {card.name}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={cardComplete ? 'text-gray-500' : 'text-gray-300'}>{card.rarity}</span>
                </td>
                <td className="py-3 px-4">
                  <span className={`font-medium ${cardComplete ? 'text-gray-500' : 'text-green-400'}`}>
                    <PriceDisplay
                      amount={card.cardmarket_avg_sell_price || 0}
                      currency="EUR"
                      showOriginal={false}
                    />
                  </span>
                </td>
                {user && (
                  <td className="py-3 px-4">
                    <span className={`font-medium ${userCollection[card.id] > 0 ? 'text-pokemon-gold' : 'text-gray-500'}`}>
                      {userCollection[card.id] || 0}
                    </span>
                  </td>
                )}
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onViewDetails(card.id)}
                      className="p-2 text-gray-400 hover:text-pokemon-gold transition-colors"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {user && (
                      <button
                        onClick={() => onToggleCollection(card.id)}
                        className="p-2 text-gray-400 hover:text-green-400 transition-colors"
                        title="Add to collection"
                        disabled={loadingStates[card.id]}
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}