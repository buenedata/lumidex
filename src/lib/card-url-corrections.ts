/**
 * Card URL Corrections Service
 * 
 * This service handles corrections for incorrect CardMarket URLs provided by the Pokemon TCG API.
 * Some cards have incorrect URL mappings that point to promotional variants or wrong products.
 */

interface CardUrlCorrection {
  cardId: string
  setId: string
  cardNumber: string
  cardName: string
  correctCardMarketUrl: string
  reason: string
  originalIncorrectUrl?: string
}

/**
 * Known incorrect CardMarket URL mappings that need correction
 */
const CARD_URL_CORRECTIONS: CardUrlCorrection[] = [
  {
    cardId: 'sv3pt5-4', // Confirmed correct card ID for Charmander #4 from 151 set
    setId: 'sv3pt5', // 151 set ID
    cardNumber: '4',
    cardName: 'Charmander',
    correctCardMarketUrl: 'https://www.cardmarket.com/en/Pokemon/Products/Singles/151/Charmander-V1-MEW004',
    reason: 'API returns GameStop promotional variant instead of regular MEW004 card'
  }
  // Add more corrections here as needed
]

/**
 * Alternative set IDs that might be used for the 151 set
 */
const SET_151_POSSIBLE_IDS = ['sv3pt5', 'sv45', 'MEW', '151']

/**
 * Get the correct CardMarket URL for a card if a correction exists
 */
export function getCorrectCardMarketUrl(
  cardId: string,
  setId: string,
  cardNumber: string,
  cardName: string,
  originalUrl?: string
): string | null {
  // First try exact card ID match
  const exactMatch = CARD_URL_CORRECTIONS.find(correction => 
    correction.cardId === cardId
  )
  
  if (exactMatch) {
    console.log(`🔧 Applying CardMarket URL correction for ${cardName} (${cardId}): ${exactMatch.reason}`)
    return exactMatch.correctCardMarketUrl
  }
  
  // Try set + number + name match for 151 set cards
  if (SET_151_POSSIBLE_IDS.includes(setId)) {
    const setMatch = CARD_URL_CORRECTIONS.find(correction => 
      SET_151_POSSIBLE_IDS.includes(correction.setId) &&
      correction.cardNumber === cardNumber &&
      correction.cardName.toLowerCase() === cardName.toLowerCase()
    )
    
    if (setMatch) {
      console.log(`🔧 Applying CardMarket URL correction for ${cardName} #${cardNumber} from 151 set: ${setMatch.reason}`)
      return setMatch.correctCardMarketUrl
    }
  }
  
  // No correction needed
  return null
}

/**
 * Check if a card needs CardMarket URL correction
 */
export function needsCardMarketUrlCorrection(
  cardId: string,
  setId: string,
  cardNumber: string,
  cardName: string
): boolean {
  return getCorrectCardMarketUrl(cardId, setId, cardNumber, cardName) !== null
}

/**
 * Add a new card URL correction (for future use or dynamic additions)
 */
export function addCardUrlCorrection(correction: CardUrlCorrection): void {
  const existingIndex = CARD_URL_CORRECTIONS.findIndex(c => c.cardId === correction.cardId)
  
  if (existingIndex >= 0) {
    CARD_URL_CORRECTIONS[existingIndex] = correction
    console.log(`📝 Updated CardMarket URL correction for ${correction.cardName} (${correction.cardId})`)
  } else {
    CARD_URL_CORRECTIONS.push(correction)
    console.log(`📝 Added new CardMarket URL correction for ${correction.cardName} (${correction.cardId})`)
  }
}

/**
 * Get all current corrections (for debugging/admin purposes)
 */
export function getAllCardUrlCorrections(): CardUrlCorrection[] {
  return [...CARD_URL_CORRECTIONS]
}

/**
 * Log correction statistics
 */
export function logCorrectionStats(): void {
  console.log(`📊 Card URL Corrections: ${CARD_URL_CORRECTIONS.length} corrections loaded`)
  CARD_URL_CORRECTIONS.forEach(correction => {
    console.log(`   - ${correction.cardName} (${correction.cardId}): ${correction.reason}`)
  })
}