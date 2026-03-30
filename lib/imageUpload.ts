/**
 * Image Upload Utilities
 * Handles Pokemon card image uploads to Supabase Storage
 * with automatic filename generation and database updates
 */

import { supabase } from './supabase'
import type { PokemonCard } from '../types'

/**
 * Generate standardized filename for card images
 * Examples: "neo3-50.jpg", "base1-4.jpg"
 */
export function generateImageFilename(setId: string, number: string): string {
  // Extract card number (before slash): "50/64" → "50", "4" → "4"
  const cardNumber = number.split('/')[0]
  return `${setId}-${cardNumber}.jpg`
}

/**
 * Get the public URL for a card image
 */
export function getCardImageUrl(setId: string, number: string): string {
  const filename = generateImageFilename(setId, number)
  const { data } = supabase.storage
    .from('card-images')
    .getPublicUrl(filename)
  
  return data.publicUrl
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
 * Check if card has an image in Supabase Storage
 */
export async function checkCardImageExists(card: PokemonCard): Promise<boolean> {
  if (!card.set_id || !card.number) return false
  
  try {
    const filename = generateImageFilename(card.set_id, card.number)
    const { data, error } = await supabase.storage
      .from('card-images')
      .list('', { search: filename })
    
    return !error && data && data.length > 0
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
    return card.image_large || card.image_small || '/placeholder-card.jpg'
  }
  
  // Generate URL based on card info
  if (card.set_id && card.number) {
    return getCardImageUrl(card.set_id, card.number)
  }
  
  return '/placeholder-card.jpg'
}