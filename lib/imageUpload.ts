/**
 * Image Upload Utilities
 * Handles Pokemon card image uploads to Cloudflare R2
 * with automatic filename generation and database updates
 */

import type { PokemonCard } from '../types'

/**
 * Generate standardized filename for card images.
 * When cardId is supplied the filename is unique per card row, preventing
 * collisions between two cards in the same set that share the same number
 * (e.g. a Pokémon and an Energy both numbered "3").
 *
 * With cardId    → "{setId}-{cardNumber}-{cardId}.webp"  (new uploads)
 * Without cardId → "{setId}-{cardNumber}.jpg"            (legacy fallback only)
 */
export function generateImageFilename(setId: string, number: string, cardId?: string): string {
  // Extract card number (before slash): "50/64" → "50", "4" → "4"
  const cardNumber = number.split('/')[0]
  if (cardId) {
    return `${setId}-${cardNumber}-${cardId}.webp`
  }
  return `${setId}-${cardNumber}.jpg`
}

/**
 * Get the public R2 URL for a card image (legacy key format).
 * New uploads store their URL directly in the cards.image column —
 * this function is only used as a last-resort fallback.
 */
export function getCardImageUrl(setId: string, number: string): string {
  const filename = generateImageFilename(setId, number)
  const base     = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '').replace(/\/$/, '')
  return `${base}/card-images/${filename}`
}

/**
 * Upload card image via the server-side API route.
 * The route uses supabaseAdmin (service role) so it bypasses storage RLS.
 */
export async function uploadCardImage(
  card: PokemonCard,
  imageFile: File
): Promise<{ success: boolean; error?: string; imageUrl?: string }> {
  try {
    if (!card.set_id || !card.number) {
      return {
        success: false,
        error: 'Card must have set_id and number to generate filename',
      }
    }

    const formData = new FormData()
    formData.append('file', imageFile)
    formData.append('cardId', card.id)
    formData.append('setId', card.set_id)
    formData.append('cardNumber', card.number)

    const response = await fetch('/api/upload-card-image', {
      method: 'POST',
      body: formData,
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      return {
        success: false,
        error: result.error || `Upload failed: ${response.status}`,
      }
    }

    return { success: true, imageUrl: result.imageUrl }
  } catch (error) {
    console.error('Unexpected error:', error)
    return {
      success: false,
      error: `Unexpected error: ${error}`,
    }
  }
}

/**
 * Upload card image via the server-side API route using a remote source URL.
 * The server fetches the image from the allowed domain and stores it directly.
 * This avoids sending the raw image bytes through the browser at all.
 */
export async function uploadCardImageFromUrl(
  card: PokemonCard,
  sourceUrl: string
): Promise<{ success: boolean; error?: string; imageUrl?: string }> {
  try {
    if (!card.set_id || !card.number) {
      return {
        success: false,
        error: 'Card must have set_id and number to generate filename',
      }
    }

    const formData = new FormData()
    formData.append('sourceUrl', sourceUrl)
    formData.append('cardId', card.id)
    formData.append('setId', card.set_id)
    formData.append('cardNumber', card.number)

    const response = await fetch('/api/upload-card-image', {
      method: 'POST',
      body: formData,
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      return {
        success: false,
        error: result.error || `Upload failed: ${response.status}`,
      }
    }

    return { success: true, imageUrl: result.imageUrl }
  } catch (error) {
    console.error('Unexpected error:', error)
    return {
      success: false,
      error: `Unexpected error: ${error}`,
    }
  }
}

/**
 * Check if card has an image in R2 Storage via a lightweight HEAD request.
 */
export async function checkCardImageExists(card: PokemonCard): Promise<boolean> {
  if (!card.set_id || !card.number) return false

  try {
    const url      = getCardImageUrl(card.set_id, card.number)
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Get card image URL with fallback to placeholder
 */
export function getCardImageWithFallback(card: PokemonCard): string {
  // New single image field takes priority
  if (card.image) {
    return card.image
  }
  
  // Backward compatibility with old fields
  if (card.image_large || card.image_small) {
    return card.image_large || card.image_small || '/pokemon_card_backside.png'
  }
  
  // Generate URL based on card info
  if (card.set_id && card.number) {
    return getCardImageUrl(card.set_id, card.number)
  }
  
  return '/pokemon_card_backside.png'
}
