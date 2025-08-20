import { PriceSource } from './user-preferences-service'

export interface CardPriceData {
  // CardMarket pricing (EUR)
  cardmarket_avg_sell_price?: number | null
  cardmarket_low_price?: number | null
  cardmarket_trend_price?: number | null
  cardmarket_reverse_holo_sell?: number | null
  cardmarket_reverse_holo_low?: number | null
  cardmarket_reverse_holo_trend?: number | null
  cardmarket_1st_edition_avg?: number | null
  cardmarket_1st_edition_low?: number | null
  cardmarket_1st_edition_trend?: number | null
  
  // TCGPlayer pricing (USD)
  tcgplayer_price?: number | null
  tcgplayer_1st_edition_normal_market?: number | null
  tcgplayer_1st_edition_normal_low?: number | null
  tcgplayer_1st_edition_normal_mid?: number | null
  tcgplayer_1st_edition_holofoil_market?: number | null
  tcgplayer_1st_edition_holofoil_low?: number | null
  tcgplayer_1st_edition_holofoil_mid?: number | null
  tcgplayer_reverse_foil_market?: number | null
  tcgplayer_reverse_foil_low?: number | null
  tcgplayer_reverse_foil_mid?: number | null
  tcgplayer_unlimited_normal_market?: number | null
  tcgplayer_unlimited_holofoil_market?: number | null
}

export interface PriceResult {
  amount: number
  currency: 'EUR' | 'USD'
  source: PriceSource
  note?: string
}

export type CardVariant = 'normal' | 'holo' | 'reverse_holo' | '1st_edition' | 'pokeball_pattern' | 'masterball_pattern'
export type PriceType = 'average' | 'low' | 'trend'

export interface VariantPricing {
  name: string
  color: string
  gradient: boolean
  average: number | null
  low: number | null
  trend: number | null
  note?: string
  currency: 'EUR' | 'USD'
}

/**
 * Get the appropriate price for a card variant based on the user's preferred price source
 */
export function getCardPrice(
  cardData: CardPriceData,
  priceSource: PriceSource,
  priceType: PriceType = 'average',
  variant: CardVariant = 'normal'
): PriceResult | null {
  
  if (priceSource === 'tcgplayer') {
    // Try TCGPlayer first when user prefers it
    const tcgPrice = getTCGPlayerPrice(cardData, priceType, variant)
    if (tcgPrice) {
      return {
        amount: tcgPrice.amount,
        currency: 'USD',
        source: 'tcgplayer'
      }
    }
    
    // Fallback to CardMarket if TCGPlayer data not available
    const cardmarketPrice = getCardMarketPrice(cardData, priceType, variant)
    if (cardmarketPrice) {
      return {
        amount: cardmarketPrice,
        currency: 'EUR',
        source: 'cardmarket',
        note: 'CardMarket EUR pricing (TCGPlayer unavailable)'
      }
    }
  } else {
    // Try CardMarket first when user prefers it (default)
    const cardmarketPrice = getCardMarketPrice(cardData, priceType, variant)
    if (cardmarketPrice) {
      return {
        amount: cardmarketPrice,
        currency: 'EUR',
        source: 'cardmarket'
      }
    }
    
    // Fallback to TCGPlayer if CardMarket data not available
    const tcgPrice = getTCGPlayerPrice(cardData, priceType, variant)
    if (tcgPrice) {
      return {
        amount: tcgPrice.amount,
        currency: 'USD',
        source: 'tcgplayer',
        note: 'TCGPlayer USD pricing (CardMarket unavailable)'
      }
    }
  }
  
  return null
}

/**
 * Get variant pricing data for display in modals/cards
 */
export function getVariantPricing(cardData: CardPriceData, availableVariants: CardVariant[], priceSource: PriceSource = 'cardmarket'): VariantPricing[] {
  const variantPricing: VariantPricing[] = []

  for (const variant of availableVariants) {
    const pricing = getVariantPricingData(cardData, variant, priceSource)
    if (pricing) {
      variantPricing.push(pricing)
    }
  }

  return variantPricing
}

function getVariantPricingData(cardData: CardPriceData, variant: CardVariant): VariantPricing | null {
  switch (variant) {
    case 'normal':
      if (cardData.cardmarket_avg_sell_price || cardData.cardmarket_low_price || cardData.cardmarket_trend_price) {
        return {
          name: 'Normal',
          color: 'bg-yellow-500',
          gradient: false,
          average: cardData.cardmarket_avg_sell_price ?? null,
          low: cardData.cardmarket_low_price ?? null,
          trend: cardData.cardmarket_trend_price ?? null,
          currency: 'EUR'
        }
      }
      // Fallback to TCGPlayer
      if (cardData.tcgplayer_unlimited_normal_market) {
        return {
          name: 'Normal',
          color: 'bg-yellow-500',
          gradient: false,
          average: cardData.tcgplayer_unlimited_normal_market,
          low: null,
          trend: null,
          note: 'TCGPlayer USD pricing',
          currency: 'USD'
        }
      }
      break

    case 'holo':
      if (cardData.cardmarket_avg_sell_price || cardData.cardmarket_low_price || cardData.cardmarket_trend_price) {
        return {
          name: 'Holo',
          color: 'bg-purple-500',
          gradient: false,
          average: cardData.cardmarket_avg_sell_price,
          low: cardData.cardmarket_low_price,
          trend: cardData.cardmarket_trend_price,
          currency: 'EUR'
        }
      }
      // Fallback to TCGPlayer
      if (cardData.tcgplayer_unlimited_holofoil_market) {
        return {
          name: 'Holo',
          color: 'bg-purple-500',
          gradient: false,
          average: cardData.tcgplayer_unlimited_holofoil_market,
          low: null,
          trend: null,
          note: 'TCGPlayer USD pricing',
          currency: 'USD'
        }
      }
      break

    case 'reverse_holo':
      // Try CardMarket reverse holo first
      if (cardData.cardmarket_reverse_holo_sell || cardData.cardmarket_reverse_holo_low || cardData.cardmarket_reverse_holo_trend) {
        return {
          name: 'Reverse Holo',
          color: 'bg-blue-500',
          gradient: false,
          average: cardData.cardmarket_reverse_holo_sell,
          low: cardData.cardmarket_reverse_holo_low,
          trend: cardData.cardmarket_reverse_holo_trend,
          currency: 'EUR'
        }
      }
      // Fallback to TCGPlayer
      if (cardData.tcgplayer_reverse_foil_market || cardData.tcgplayer_reverse_foil_low) {
        return {
          name: 'Reverse Holo',
          color: 'bg-blue-500',
          gradient: false,
          average: cardData.tcgplayer_reverse_foil_market,
          low: cardData.tcgplayer_reverse_foil_low,
          trend: cardData.tcgplayer_reverse_foil_mid,
          note: 'TCGPlayer USD pricing',
          currency: 'USD'
        }
      }
      break

    case '1st_edition':
      // Try CardMarket 1st Edition first
      if (cardData.cardmarket_1st_edition_avg || cardData.cardmarket_1st_edition_low) {
        return {
          name: '1st Edition',
          color: 'bg-green-500',
          gradient: false,
          average: cardData.cardmarket_1st_edition_avg,
          low: cardData.cardmarket_1st_edition_low,
          trend: cardData.cardmarket_1st_edition_trend,
          currency: 'EUR'
        }
      }
      // Fallback to TCGPlayer
      if (cardData.tcgplayer_1st_edition_normal_market || cardData.tcgplayer_1st_edition_holofoil_market) {
        // For 1st edition, we might have both normal and holo variants
        const hasNormal = cardData.tcgplayer_1st_edition_normal_market || cardData.tcgplayer_1st_edition_normal_low
        const hasHolo = cardData.tcgplayer_1st_edition_holofoil_market || cardData.tcgplayer_1st_edition_holofoil_low
        
        if (hasHolo) {
          return {
            name: '1st Edition Holo',
            color: 'bg-gradient-to-r from-green-500 to-purple-500',
            gradient: true,
            average: cardData.tcgplayer_1st_edition_holofoil_market,
            low: cardData.tcgplayer_1st_edition_holofoil_low,
            trend: cardData.tcgplayer_1st_edition_holofoil_mid,
            note: 'TCGPlayer USD pricing',
            currency: 'USD'
          }
        } else if (hasNormal) {
          return {
            name: '1st Edition Normal',
            color: 'bg-green-500',
            gradient: false,
            average: cardData.tcgplayer_1st_edition_normal_market,
            low: cardData.tcgplayer_1st_edition_normal_low,
            trend: cardData.tcgplayer_1st_edition_normal_mid,
            note: 'TCGPlayer USD pricing',
            currency: 'USD'
          }
        }
      }
      // Final fallback: estimate based on normal pricing
      if (cardData.cardmarket_avg_sell_price || cardData.cardmarket_low_price || cardData.cardmarket_trend_price) {
        return {
          name: '1st Edition',
          color: 'bg-green-500',
          gradient: false,
          average: cardData.cardmarket_avg_sell_price ? cardData.cardmarket_avg_sell_price * 2.5 : null,
          low: cardData.cardmarket_low_price ? cardData.cardmarket_low_price * 2.0 : null,
          trend: cardData.cardmarket_trend_price ? cardData.cardmarket_trend_price * 2.2 : null,
          note: 'Estimated pricing (typically 2-3x normal variant)',
          currency: 'EUR'
        }
      }
      break

    case 'pokeball_pattern':
      if (cardData.cardmarket_avg_sell_price || cardData.cardmarket_low_price || cardData.cardmarket_trend_price) {
        return {
          name: 'Poké Ball Pattern',
          color: 'bg-gradient-to-r from-red-500 to-white',
          gradient: true,
          average: cardData.cardmarket_avg_sell_price,
          low: cardData.cardmarket_low_price,
          trend: cardData.cardmarket_trend_price,
          note: 'Estimated pricing based on normal variant',
          currency: 'EUR'
        }
      }
      break

    case 'masterball_pattern':
      if (cardData.cardmarket_avg_sell_price || cardData.cardmarket_low_price || cardData.cardmarket_trend_price) {
        return {
          name: 'Master Ball Pattern',
          color: 'bg-gradient-to-r from-purple-600 to-blue-600',
          gradient: true,
          average: cardData.cardmarket_avg_sell_price ? cardData.cardmarket_avg_sell_price * 1.2 : null,
          low: cardData.cardmarket_low_price ? cardData.cardmarket_low_price * 1.1 : null,
          trend: cardData.cardmarket_trend_price ? cardData.cardmarket_trend_price * 1.15 : null,
          note: 'Estimated pricing (typically 10-20% premium)',
          currency: 'EUR'
        }
      }
      break
  }

  return null
}

function getCardMarketPrice(cardData: CardPriceData, priceType: PriceType, variant: CardVariant = 'normal'): number | null {
  switch (variant) {
    case 'reverse_holo':
      switch (priceType) {
        case 'average':
          return cardData.cardmarket_reverse_holo_sell || null
        case 'low':
          return cardData.cardmarket_reverse_holo_low || null
        case 'trend':
          return cardData.cardmarket_reverse_holo_trend || null
      }
      break
    case '1st_edition':
      switch (priceType) {
        case 'average':
          return cardData.cardmarket_1st_edition_avg || null
        case 'low':
          return cardData.cardmarket_1st_edition_low || null
        case 'trend':
          return cardData.cardmarket_1st_edition_trend || null
      }
      break
    default:
      // Normal, holo, and pattern variants use regular pricing
      switch (priceType) {
        case 'average':
          return cardData.cardmarket_avg_sell_price || null
        case 'low':
          return cardData.cardmarket_low_price || null
        case 'trend':
          return cardData.cardmarket_trend_price || null
      }
  }
  return null
}

function getTCGPlayerPrice(cardData: CardPriceData, priceType: PriceType, variant: CardVariant): { amount: number } | null {
  switch (variant) {
    case 'normal':
      if (priceType === 'average' && cardData.tcgplayer_unlimited_normal_market) {
        return { amount: cardData.tcgplayer_unlimited_normal_market }
      }
      break
    case 'holo':
      if (priceType === 'average' && cardData.tcgplayer_unlimited_holofoil_market) {
        return { amount: cardData.tcgplayer_unlimited_holofoil_market }
      }
      break
    case 'reverse_holo':
      switch (priceType) {
        case 'average':
          if (cardData.tcgplayer_reverse_foil_market) return { amount: cardData.tcgplayer_reverse_foil_market }
          break
        case 'low':
          if (cardData.tcgplayer_reverse_foil_low) return { amount: cardData.tcgplayer_reverse_foil_low }
          break
        case 'trend':
          if (cardData.tcgplayer_reverse_foil_mid) return { amount: cardData.tcgplayer_reverse_foil_mid }
          break
      }
      break
    case '1st_edition':
      // Try holo first, then normal
      switch (priceType) {
        case 'average':
          if (cardData.tcgplayer_1st_edition_holofoil_market) return { amount: cardData.tcgplayer_1st_edition_holofoil_market }
          if (cardData.tcgplayer_1st_edition_normal_market) return { amount: cardData.tcgplayer_1st_edition_normal_market }
          break
        case 'low':
          if (cardData.tcgplayer_1st_edition_holofoil_low) return { amount: cardData.tcgplayer_1st_edition_holofoil_low }
          if (cardData.tcgplayer_1st_edition_normal_low) return { amount: cardData.tcgplayer_1st_edition_normal_low }
          break
        case 'trend':
          if (cardData.tcgplayer_1st_edition_holofoil_mid) return { amount: cardData.tcgplayer_1st_edition_holofoil_mid }
          if (cardData.tcgplayer_1st_edition_normal_mid) return { amount: cardData.tcgplayer_1st_edition_normal_mid }
          break
      }
      break
  }
  return null
}

/**
 * Calculate total value for a collection of cards
 */
export function calculateTotalValue(
  cards: Array<{ card: CardPriceData; quantity: number }>,
  priceSource: PriceSource
): PriceResult | null {
  let totalEur = 0
  let totalUsd = 0
  let hasEurPrices = false
  let hasUsdPrices = false
  
  for (const item of cards) {
    const price = getCardPrice(item.card, priceSource)
    if (price) {
      if (price.currency === 'EUR') {
        totalEur += price.amount * item.quantity
        hasEurPrices = true
      } else {
        totalUsd += price.amount * item.quantity
        hasUsdPrices = true
      }
    }
  }
  
  // Return the total in the preferred currency
  if (priceSource === 'tcgplayer' && hasUsdPrices) {
    return {
      amount: totalUsd,
      currency: 'USD',
      source: 'tcgplayer'
    }
  } else if (hasEurPrices) {
    return {
      amount: totalEur,
      currency: 'EUR',
      source: 'cardmarket'
    }
  } else if (hasUsdPrices) {
    return {
      amount: totalUsd,
      currency: 'USD',
      source: 'tcgplayer'
    }
  }
  
  return null
}