/**
 * Responsive Card Image Component
 * Handles all card image sizing with CSS scaling
 * Uses single image with automatic fallback to placeholder
 *
 * Images are served directly from Cloudflare R2 (already WebP-compressed CDN).
 * We use a plain <img> tag so no next/image remotePatterns are required and
 * no double-optimisation is applied to already-compressed assets.
 */
'use client'

import { useState } from 'react'
import { getCardImageWithFallback } from '../lib/imageUpload'
import { PokemonCard } from '../types'

interface CardImageProps {
  card: PokemonCard
  size?: 'small' | 'medium' | 'large' | 'xlarge'
  className?: string
  alt?: string
}

/** Intrinsic pixel dimensions per size variant (portrait ~2.5:3.5 aspect ratio). */
const sizeDims = {
  small:  { width: 64,  height: 89  },
  medium: { width: 128, height: 179 },
  large:  { width: 256, height: 358 },
  xlarge: { width: 256, height: 358 },
} as const

export function CardImage({
  card,
  size,
  className = '',
  alt
}: CardImageProps) {
  // Get image URL with automatic fallback logic
  const imageUrl = getCardImageWithFallback(card)
  // State-based src so we can swap to the backside on error
  // (next/image does not support imperative src mutation via e.target.src)
  const [imgSrc, setImgSrc] = useState(imageUrl)
  
  // Define responsive size classes
  const sizeClasses = {
    small: 'w-20 h-28',      // 80x112px - Small thumbnails
    medium: 'w-32 h-44',     // 128x176px - Card grid default
    large: 'w-48 h-66',      // 192x264px - Larger grid view
    xlarge: 'w-64 h-88'      // 256x352px - Detail/modal view
  }

  const sizeClass = size ? sizeClasses[size] : ''
  const dims = size ? sizeDims[size] : sizeDims.medium

  // Generate alt text if not provided
  const altText = alt || `${card.name || 'Pokemon Card'} ${card.set_id ? `(${card.set_id.toUpperCase()})` : ''}`

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imgSrc}
      alt={altText}
      width={dims.width}
      height={dims.height}
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
      onError={() => {
        // Fallback to card backside if image fails to load
        if (!imgSrc.endsWith('/pokemon_card_backside.png')) {
          setImgSrc('/pokemon_card_backside.png')
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