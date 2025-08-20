import React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Badge, CurrencyBadge } from '@/components/ui'

interface PokemonCardProps {
  card: {
    id: string
    name: string
    imageSmall: string
    imageLarge: string
    rarity?: string
    setName?: string
    setSymbol?: string
    cardNumber?: string
    totalCards?: string
    estimatedValue?: number
  }
  variant?: 'grid' | 'list' | 'compact'
  showPrice?: boolean
  showRarity?: boolean
  showSet?: boolean
  onClick?: () => void
  className?: string
}

export const PokemonCard: React.FC<PokemonCardProps> = ({
  card,
  variant = 'grid',
  showPrice = true,
  showRarity = true,
  showSet = true,
  onClick,
  className
}) => {
  const getRarityVariant = (rarity?: string) => {
    if (!rarity) return 'common'
    const rarityLower = rarity.toLowerCase()
    if (rarityLower.includes('common')) return 'common'
    if (rarityLower.includes('uncommon')) return 'uncommon'
    if (rarityLower.includes('rare')) return 'rare'
    if (rarityLower.includes('ultra') || rarityLower.includes('secret')) return 'epic'
    if (rarityLower.includes('legendary')) return 'legendary'
    return 'rare'
  }

  const getRarityClass = (rarity?: string) => {
    if (!rarity) return 'rarity-common'
    const rarityLower = rarity.toLowerCase()
    if (rarityLower.includes('common')) return 'rarity-common'
    if (rarityLower.includes('uncommon')) return 'rarity-uncommon'
    if (rarityLower.includes('rare') && !rarityLower.includes('ultra')) return 'rarity-rare'
    if (rarityLower.includes('rare') && rarityLower.includes('holo')) return 'rarity-rare-holo'
    if (rarityLower.includes('ultra') || rarityLower.includes('secret')) return 'rarity-ultra-rare'
    return 'rarity-rare'
  }

  if (variant === 'list') {
    return (
      <div
        className={cn(
          'card-hover flex items-center space-x-4 p-4 cursor-pointer',
          getRarityClass(card.rarity),
          className
        )}
        onClick={onClick}
      >
        <div className="flex-shrink-0">
          <Image
            src={card.imageSmall}
            alt={card.name}
            width={80}
            height={112}
            className="rounded-lg"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {card.name}
          </h3>
          {showSet && card.setName && (
            <p className="text-sm text-gray-600 truncate">
              {card.setName}
              {card.cardNumber && card.totalCards && (
                <span className="ml-2 text-gray-500">
                  #{card.cardNumber}/{card.totalCards}
                </span>
              )}
            </p>
          )}
          <div className="flex items-center space-x-2 mt-2">
            {showRarity && card.rarity && (
              <Badge variant="rarity" rarity={getRarityVariant(card.rarity)}>
                {card.rarity}
              </Badge>
            )}
            {showPrice && card.estimatedValue && card.estimatedValue > 0 && (
              <CurrencyBadge amount={card.estimatedValue} size="sm" />
            )}
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'card-hover p-3 cursor-pointer',
          getRarityClass(card.rarity),
          className
        )}
        onClick={onClick}
      >
        <div className="flex items-center space-x-3">
          <Image
            src={card.imageSmall}
            alt={card.name}
            width={50}
            height={70}
            className="rounded"
          />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 truncate">
              {card.name}
            </h4>
            {showSet && card.setName && (
              <p className="text-xs text-gray-500 truncate">
                {card.setName}
              </p>
            )}
            {showPrice && card.estimatedValue && card.estimatedValue > 0 && (
              <CurrencyBadge amount={card.estimatedValue} size="sm" />
            )}
          </div>
        </div>
      </div>
    )
  }

  // Grid variant (default)
  return (
    <div
      className={cn(
        'pokemon-card group cursor-pointer',
        getRarityClass(card.rarity),
        className
      )}
      onClick={onClick}
    >
      <div className="relative">
        <Image
          src={card.imageSmall}
          alt={card.name}
          width={245}
          height={342}
          className="pokemon-card-image"
        />
        
        {/* Overlay with card info */}
        <div className="pokemon-card-overlay">
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <h3 className="text-lg font-semibold text-shadow-lg truncate">
              {card.name}
            </h3>
            {showSet && card.setName && (
              <p className="text-sm text-shadow truncate">
                {card.setName}
              </p>
            )}
          </div>
        </div>

        {/* Top badges */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
          {showRarity && card.rarity && (
            <Badge variant="rarity" rarity={getRarityVariant(card.rarity)}>
              {card.rarity}
            </Badge>
          )}
          {card.cardNumber && card.totalCards && (
            <Badge className="bg-black/50 text-white text-xs">
              #{card.cardNumber}/{card.totalCards}
            </Badge>
          )}
        </div>

        {/* Bottom price badge */}
        {showPrice && card.estimatedValue && card.estimatedValue > 0 && (
          <div className="absolute bottom-2 right-2">
            <CurrencyBadge amount={card.estimatedValue} />
          </div>
        )}
      </div>
    </div>
  )
}

interface PokemonCardGridProps {
  cards: Array<{
    id: string
    name: string
    imageSmall: string
    imageLarge: string
    rarity?: string
    setName?: string
    setSymbol?: string
    cardNumber?: string
    totalCards?: string
    estimatedValue?: number
  }>
  variant?: 'grid' | 'list' | 'compact'
  showPrice?: boolean
  showRarity?: boolean
  showSet?: boolean
  onCardClick?: (card: any) => void
  className?: string
}

export const PokemonCardGrid: React.FC<PokemonCardGridProps> = ({
  cards,
  variant = 'grid',
  showPrice = true,
  showRarity = true,
  showSet = true,
  onCardClick,
  className
}) => {
  const gridClasses = {
    grid: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4',
    list: 'space-y-4',
    compact: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2'
  }

  return (
    <div className={cn(gridClasses[variant], className)}>
      {cards.map((card) => (
        <PokemonCard
          key={card.id}
          card={card}
          variant={variant}
          showPrice={showPrice}
          showRarity={showRarity}
          showSet={showSet}
          onClick={() => onCardClick?.(card)}
        />
      ))}
    </div>
  )
}