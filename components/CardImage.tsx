/**
 * Responsive Card Image Component
 * Handles all card image sizing with CSS scaling
 * Uses single image with automatic fallback to placeholder
 */

import { getCardImageWithFallback } from '../lib/imageUpload'
import { PokemonCard } from '../types'

interface CardImageProps {
  card: PokemonCard
  size?: 'small' | 'medium' | 'large' | 'xlarge'
  className?: string
  alt?: string
}

export function CardImage({
  card,
  size,
  className = '',
  alt
}: CardImageProps) {
  // Get image URL with automatic fallback logic
  const imageUrl = getCardImageWithFallback(card)
  
  // Define responsive size classes
  const sizeClasses = {
    small: 'w-20 h-28',      // 80x112px - Small thumbnails
    medium: 'w-32 h-44',     // 128x176px - Card grid default
    large: 'w-48 h-66',      // 192x264px - Larger grid view
    xlarge: 'w-64 h-88'      // 256x352px - Detail/modal view
  }

  const sizeClass = size ? sizeClasses[size] : ''

  // Generate alt text if not provided
  const altText = alt || `${card.name || 'Pokemon Card'} ${card.set_id ? `(${card.set_id.toUpperCase()})` : ''}`

  return (
    <img
      src={imageUrl}
      alt={altText}
      className={`
        ${sizeClass}
        object-cover
        rounded-lg
        shadow-md
        transition-transform
        hover:scale-105
        ${className}
      `}
      loading="lazy"
      onError={(e) => {
        // Fallback to card backside if image fails to load
        const target = e.target as HTMLImageElement
        if (!target.src.endsWith('/pokemon_card_backside.png')) {
          target.src = '/pokemon_card_backside.png'
        }
      }}
    />
  )
}

// Specialized components for common use cases
export function CardThumbnail({ card, className = '' }: { card: PokemonCard; className?: string }) {
  return <CardImage card={card} size="small" className={className} />
}

export function CardGridItem({ card, className = '' }: { card: PokemonCard; className?: string }) {
  return <CardImage card={card} size="medium" className={className} />
}

export function CardDetail({ card, className = '' }: { card: PokemonCard; className?: string }) {
  return <CardImage card={card} size="xlarge" className={className} />
}