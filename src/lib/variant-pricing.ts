import { CardVariant } from '@/types/pokemon'

export interface CardPricingData {
  cardmarket_avg_sell_price?: number | null
  cardmarket_low_price?: number | null
  cardmarket_trend_price?: number | null
  cardmarket_reverse_holo_sell?: number | null
  cardmarket_reverse_holo_low?: number | null
  cardmarket_reverse_holo_trend?: number | null
  tcgplayer_1st_edition_normal_market?: number | null
  tcgplayer_1st_edition_holofoil_market?: number | null
}

export interface VariantQuantities {
  normal?: number
  holo?: number
  reverseHolo?: number
  pokeballPattern?: number
  masterballPattern?: number
  firstEdition?: number
}

/**
 * Get the price for a specific variant of a card
 */
export function getVariantPrice(
  cardData: CardPricingData,
  variant: CardVariant,
  priceType: 'average' | 'low' | 'trend' = 'average'
): number {
  switch (variant) {
    case 'normal':
      // Normal variant uses standard pricing
      return getStandardPrice(cardData, priceType)
    
    case 'holo':
      // Holo variant uses standard pricing (holo is the default for most rare cards)
      return getStandardPrice(cardData, priceType)
    
    case 'reverse_holo':
      // Reverse holo has specific pricing fields
      return getReverseHoloPrice(cardData, priceType)
    
    case 'pokeball_pattern':
      // Pattern variants typically use standard pricing (no specific pricing data available)
      return getStandardPrice(cardData, priceType)
    
    case 'masterball_pattern':
      // Pattern variants typically use standard pricing (no specific pricing data available)
      return getStandardPrice(cardData, priceType)
    
    case '1st_edition':
      // 1st Edition has specific pricing or estimated multiplier
      return get1stEditionPrice(cardData, priceType)
    
    default:
      return getStandardPrice(cardData, priceType)
  }
}

/**
 * Calculate the total value of a card based on variant quantities
 */
export function calculateCardVariantValue(
  cardData: CardPricingData,
  variantQuantities: VariantQuantities,
  priceType: 'average' | 'low' | 'trend' = 'average'
): number {
  let totalValue = 0

  // Calculate value for each variant
  if (variantQuantities.normal) {
    totalValue += getVariantPrice(cardData, 'normal', priceType) * variantQuantities.normal
  }
  
  if (variantQuantities.holo) {
    totalValue += getVariantPrice(cardData, 'holo', priceType) * variantQuantities.holo
  }
  
  if (variantQuantities.reverseHolo) {
    totalValue += getVariantPrice(cardData, 'reverse_holo', priceType) * variantQuantities.reverseHolo
  }
  
  if (variantQuantities.pokeballPattern) {
    totalValue += getVariantPrice(cardData, 'pokeball_pattern', priceType) * variantQuantities.pokeballPattern
  }
  
  if (variantQuantities.masterballPattern) {
    totalValue += getVariantPrice(cardData, 'masterball_pattern', priceType) * variantQuantities.masterballPattern
  }
  
  if (variantQuantities.firstEdition) {
    totalValue += getVariantPrice(cardData, '1st_edition', priceType) * variantQuantities.firstEdition
  }

  return totalValue
}

/**
 * Get standard pricing (normal/holo variants)
 */
function getStandardPrice(
  cardData: CardPricingData,
  priceType: 'average' | 'low' | 'trend'
): number {
  switch (priceType) {
    case 'average':
      return cardData.cardmarket_avg_sell_price || 0
    case 'low':
      return cardData.cardmarket_low_price || 0
    case 'trend':
      return cardData.cardmarket_trend_price || 0
    default:
      return cardData.cardmarket_avg_sell_price || 0
  }
}

/**
 * Get reverse holo specific pricing
 */
function getReverseHoloPrice(
  cardData: CardPricingData,
  priceType: 'average' | 'low' | 'trend'
): number {
  switch (priceType) {
    case 'average':
      return cardData.cardmarket_reverse_holo_sell || getStandardPrice(cardData, priceType)
    case 'low':
      return cardData.cardmarket_reverse_holo_low || getStandardPrice(cardData, priceType)
    case 'trend':
      return cardData.cardmarket_reverse_holo_trend || getStandardPrice(cardData, priceType)
    default:
      return cardData.cardmarket_reverse_holo_sell || getStandardPrice(cardData, priceType)
  }
}

/**
 * Get 1st Edition pricing (with fallback estimation)
 */
function get1stEditionPrice(
  cardData: CardPricingData,
  priceType: 'average' | 'low' | 'trend'
): number {
  // Try to use actual 1st Edition pricing from TCGPlayer (convert USD to EUR roughly)
  if (cardData.tcgplayer_1st_edition_holofoil_market) {
    return cardData.tcgplayer_1st_edition_holofoil_market * 0.85 // Rough USD to EUR conversion
  }
  
  if (cardData.tcgplayer_1st_edition_normal_market) {
    return cardData.tcgplayer_1st_edition_normal_market * 0.85 // Rough USD to EUR conversion
  }
  
  // Fallback: Estimate 1st Edition value as 2.5x normal price
  const standardPrice = getStandardPrice(cardData, priceType)
  return standardPrice * 2.5
}