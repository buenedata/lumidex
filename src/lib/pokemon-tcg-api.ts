import { PokemonCard, PokemonSet, CardMarketPricing, PokemonTCGApiResponse } from '@/types'
import { validateAndCorrectCardPricing } from './price-validation'
import { getCorrectCardMarketUrl, needsCardMarketUrlCorrection } from './card-url-corrections'

// Pokemon TCG API configuration
const POKEMON_TCG_API_BASE_URL = 'https://api.pokemontcg.io/v2'
const API_KEY = process.env.POKEMON_TCG_API_KEY

// Rate limiting configuration - Aligned with Pokemon TCG API limits
const RATE_LIMIT = {
  requestsPerSecond: 0.4, // Conservative: 24 requests per minute (under 30/min limit)
  requestsPerHour: API_KEY ? 19000 : 900, // Leave buffer under daily limits
  burstLimit: 1000,
}

class PokemonTCGClient {
  private requestQueue: Array<() => Promise<any>> = []
  private isProcessing = false
  private requestCount = 0
  private lastReset = Date.now()
  private lastRequest = 0

  /**
   * Make a rate-limited request to the Pokemon TCG API
   */
  private async makeRequest<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          // Reset counter every hour
          if (Date.now() - this.lastReset > 3600000) {
            this.requestCount = 0
            this.lastReset = Date.now()
          }

          // Check rate limits
          if (this.requestCount >= RATE_LIMIT.requestsPerHour - 100) {
            throw new Error('Rate limit approaching - pausing requests')
          }

          // Enforce minimum time between requests
          const now = Date.now()
          const timeSinceLastRequest = now - this.lastRequest
          const minInterval = 1000 / RATE_LIMIT.requestsPerSecond

          if (timeSinceLastRequest < minInterval) {
            await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest))
          }

          // Build URL with parameters
          const url = new URL(`${POKEMON_TCG_API_BASE_URL}${endpoint}`)
          if (params) {
            Object.entries(params).forEach(([key, value]) => {
              url.searchParams.append(key, value)
            })
          }

          // Make the request
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          }

          if (API_KEY) {
            headers['X-Api-Key'] = API_KEY
          }

          // Add retry logic for 504 errors
          let response: Response | undefined
          let retries = 3
          
          while (retries > 0) {
            try {
              response = await fetch(url.toString(), { headers })
              
              if (response.ok) {
                break // Success, exit retry loop
              }
              
              if (response.status === 504 && retries > 1) {
                console.log(`504 Gateway Timeout, retrying... (${retries - 1} retries left)`)
                retries--
                await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries))) // Exponential backoff
                continue
              }
              
              throw new Error(`Pokemon TCG API error: ${response.status} ${response.statusText}`)
            } catch (error) {
              if (retries === 1) {
                throw error
              }
              console.log(`Request failed, retrying... (${retries - 1} retries left)`)
              retries--
              await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)))
            }
          }

          if (!response) {
            throw new Error('Failed to get response after retries')
          }

          const data = await response.json()
          this.requestCount++
          this.lastRequest = Date.now()

          resolve(data)
        } catch (error) {
          reject(error)
        }
      })

      this.processQueue()
    })
  }

  /**
   * Process the request queue with rate limiting
   */
  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return

    this.isProcessing = true

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()
      if (request) {
        await request()
      }
    }

    this.isProcessing = false
  }

  /**
   * Get all Pokemon card sets
   */
  async getSets(params?: {
    page?: number
    pageSize?: number
    orderBy?: string
  }): Promise<PokemonTCGApiResponse<PokemonSet[]>> {
    const queryParams: Record<string, string> = {}

    if (params?.page) queryParams.page = params.page.toString()
    if (params?.pageSize) queryParams.pageSize = params.pageSize.toString()
    if (params?.orderBy) queryParams.orderBy = params.orderBy

    return this.makeRequest<PokemonTCGApiResponse<PokemonSet[]>>('/sets', queryParams)
  }

  /**
   * Get a specific set by ID
   */
  async getSet(setId: string): Promise<PokemonTCGApiResponse<PokemonSet>> {
    return this.makeRequest<PokemonTCGApiResponse<PokemonSet>>(`/sets/${setId}`)
  }

  /**
   * Get cards with optional filtering
   */
  async getCards(params?: {
    page?: number
    pageSize?: number
    q?: string // Query string for filtering
    orderBy?: string
    select?: string // Fields to select
  }): Promise<PokemonTCGApiResponse<PokemonCard[]>> {
    const queryParams: Record<string, string> = {}

    if (params?.page) queryParams.page = params.page.toString()
    if (params?.pageSize) queryParams.pageSize = params.pageSize.toString()
    if (params?.q) queryParams.q = params.q
    if (params?.orderBy) queryParams.orderBy = params.orderBy
    if (params?.select) queryParams.select = params.select

    return this.makeRequest<PokemonTCGApiResponse<PokemonCard[]>>('/cards', queryParams)
  }

  /**
   * Get cards from a specific set
   */
  async getCardsFromSet(setId: string, params?: {
    page?: number
    pageSize?: number
    orderBy?: string
  }): Promise<PokemonTCGApiResponse<PokemonCard[]>> {
    const query = `set.id:${setId}`
    return this.getCards({
      ...params,
      q: query,
    })
  }

  /**
   * Get a specific card by ID
   */
  async getCard(cardId: string): Promise<PokemonTCGApiResponse<PokemonCard>> {
    return this.makeRequest<PokemonTCGApiResponse<PokemonCard>>(`/cards/${cardId}`)
  }

  /**
   * Search cards by name
   */
  async searchCardsByName(name: string, params?: {
    page?: number
    pageSize?: number
  }): Promise<PokemonTCGApiResponse<PokemonCard[]>> {
    const query = `name:"${name}*"`
    return this.getCards({
      ...params,
      q: query,
    })
  }

  /**
   * Get cards by rarity
   */
  async getCardsByRarity(rarity: string, params?: {
    page?: number
    pageSize?: number
    setId?: string
  }): Promise<PokemonTCGApiResponse<PokemonCard[]>> {
    let query = `rarity:"${rarity}"`
    if (params?.setId) {
      query += ` set.id:${params.setId}`
    }

    return this.getCards({
      page: params?.page,
      pageSize: params?.pageSize,
      q: query,
    })
  }

  /**
   * Get cards by type
   */
  async getCardsByType(type: string, params?: {
    page?: number
    pageSize?: number
    setId?: string
  }): Promise<PokemonTCGApiResponse<PokemonCard[]>> {
    let query = `types:"${type}"`
    if (params?.setId) {
      query += ` set.id:${params.setId}`
    }

    return this.getCards({
      page: params?.page,
      pageSize: params?.pageSize,
      q: query,
    })
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus() {
    const now = Date.now()
    const timeUntilReset = 3600000 - (now - this.lastReset)
    const remainingRequests = RATE_LIMIT.requestsPerHour - this.requestCount

    return {
      requestsUsed: this.requestCount,
      requestsRemaining: remainingRequests,
      timeUntilReset: Math.max(0, timeUntilReset),
      queueLength: this.requestQueue.length,
    }
  }
}

// Create singleton instance
export const pokemonTCGClient = new PokemonTCGClient()

/**
 * Transform Pokemon TCG API card data to our database format
 */
export function transformCardData(apiCard: any): PokemonCard {
  const cardData: PokemonCard = {
    id: apiCard.id,
    name: apiCard.name,
    set_id: apiCard.set.id,
    number: apiCard.number,
    rarity: apiCard.rarity || 'Common',
    types: apiCard.types || [],
    hp: apiCard.hp ? parseInt(apiCard.hp) : undefined,
    image_small: apiCard.images.small,
    image_large: apiCard.images.large,
    
    // Structured pricing data
    cardmarket: {},
    tcgplayer: {},
    
    cardmarket_url: undefined,
    cardmarket_updated_at: undefined,
    cardmarket_avg_sell_price: undefined,
    cardmarket_low_price: undefined,
    cardmarket_trend_price: undefined,
    cardmarket_suggested_price: undefined,
    cardmarket_german_pro_low: undefined,
    cardmarket_low_price_ex_plus: undefined,
    cardmarket_reverse_holo_sell: undefined,
    cardmarket_reverse_holo_low: undefined,
    cardmarket_reverse_holo_trend: undefined,
    cardmarket_avg_1_day: undefined,
    cardmarket_avg_7_days: undefined,
    cardmarket_avg_30_days: undefined,
    cardmarket_last_sync: undefined,
    cardmarket_sync_status: undefined,
    tcgplayer_price: undefined,
    tcgplayer_url: undefined,
    tcgplayer_normal_available: undefined,
    tcgplayer_holofoil_available: undefined,
    tcgplayer_reverse_holo_available: undefined,
    tcgplayer_1st_edition_available: undefined,
    tcgplayer_last_sync: undefined,
    tcgplayer_sync_status: undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Extract CardMarket pricing if available
  if (apiCard.cardmarket) {
    const cm = apiCard.cardmarket
    cardData.cardmarket_url = cm.url
    cardData.cardmarket_updated_at = cm.updatedAt

    if (cm.prices) {
      cardData.cardmarket_avg_sell_price = cm.prices.averageSellPrice
      cardData.cardmarket_low_price = cm.prices.lowPrice
      cardData.cardmarket_trend_price = cm.prices.trendPrice
      cardData.cardmarket_suggested_price = cm.prices.suggestedPrice
      cardData.cardmarket_german_pro_low = cm.prices.germanProLow
      cardData.cardmarket_low_price_ex_plus = cm.prices.lowPriceExPlus
      cardData.cardmarket_reverse_holo_sell = cm.prices.reverseHoloSell
      cardData.cardmarket_reverse_holo_low = cm.prices.reverseHoloLow
      cardData.cardmarket_reverse_holo_trend = cm.prices.reverseHoloTrend
      cardData.cardmarket_avg_1_day = cm.prices.avg1
      cardData.cardmarket_avg_7_days = cm.prices.avg7
      cardData.cardmarket_avg_30_days = cm.prices.avg30
    }

    cardData.cardmarket_last_sync = new Date().toISOString()
    cardData.cardmarket_sync_status = 'success'
  }

  // Apply CardMarket URL corrections if needed
  const correctedUrl = getCorrectCardMarketUrl(
    cardData.id,
    cardData.set_id,
    cardData.number,
    cardData.name,
    cardData.cardmarket_url || undefined
  )
  
  if (correctedUrl) {
    console.log(`🔧 Correcting CardMarket URL for ${cardData.name} (${cardData.id}): ${cardData.cardmarket_url} → ${correctedUrl}`)
    cardData.cardmarket_url = correctedUrl
  }

  // Extract TCGPlayer variant availability (for determining which variants exist)
  if (apiCard.tcgplayer) {
    const tcg = apiCard.tcgplayer
    cardData.tcgplayer_url = tcg.url

    if (tcg.prices) {
      // Check which variants are available based on pricing data existence
      cardData.tcgplayer_normal_available = !!(
        tcg.prices.normal?.market ||
        tcg.prices['1stEditionNormal']?.market ||
        tcg.prices.unlimited?.market
      )
      
      cardData.tcgplayer_holofoil_available = !!(
        tcg.prices.holofoil?.market ||
        tcg.prices['1stEditionHolofoil']?.market ||
        tcg.prices.unlimitedHolofoil?.market
      )
      
      cardData.tcgplayer_reverse_holo_available = !!(tcg.prices.reverseHolofoil?.market)
      
      // Check for 1st Edition variants specifically
      const has1stEditionNormal = !!(tcg.prices['1stEditionNormal']?.market)
      const has1stEditionHolo = !!(tcg.prices['1stEditionHolofoil']?.market)
      cardData.tcgplayer_1st_edition_available = has1stEditionNormal || has1stEditionHolo

      // Extract 1st Edition Normal pricing data
      if (tcg.prices['1stEditionNormal']) {
        const normalPrices = tcg.prices['1stEditionNormal']
        cardData.tcgplayer_1st_edition_normal_market = normalPrices.market
        cardData.tcgplayer_1st_edition_normal_low = normalPrices.low
        cardData.tcgplayer_1st_edition_normal_mid = normalPrices.mid
        cardData.tcgplayer_1st_edition_normal_high = normalPrices.high
      }

      // Extract 1st Edition Holofoil pricing data
      if (tcg.prices['1stEditionHolofoil']) {
        const holoPrices = tcg.prices['1stEditionHolofoil']
        cardData.tcgplayer_1st_edition_holofoil_market = holoPrices.market
        cardData.tcgplayer_1st_edition_holofoil_low = holoPrices.low
        cardData.tcgplayer_1st_edition_holofoil_mid = holoPrices.mid
        cardData.tcgplayer_1st_edition_holofoil_high = holoPrices.high
      }

      // Legacy single price field for backward compatibility (CardMarket should be primary)
      cardData.tcgplayer_price = tcg.prices.holofoil?.market || tcg.prices.normal?.market
    }

    cardData.tcgplayer_last_sync = new Date().toISOString()
    cardData.tcgplayer_sync_status = 'success'
  }

  // Validate and correct pricing data before returning
  return validateAndCorrectCardPricing(cardData, {
    correctInvalidPrices: true,
    logIssues: true,
    cardId: cardData.id,
    cardName: cardData.name
  })
}

/**
 * Transform Pokemon TCG API set data to our database format
 */
export function transformSetData(apiSet: any): PokemonSet {
  return {
    id: apiSet.id,
    name: apiSet.name,
    series: apiSet.series,
    total_cards: apiSet.total,
    release_date: apiSet.releaseDate,
    symbol_url: apiSet.images?.symbol || null,
    logo_url: apiSet.images?.logo || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

/**
 * Utility functions for common queries
 */
export const pokemonTCGQueries = {
  /**
   * Get all sets ordered by release date
   */
  async getAllSets() {
    return pokemonTCGClient.getSets({
      orderBy: '-releaseDate',
      pageSize: 250,
    })
  },

  /**
   * Get recent sets (last 2 years)
   */
  async getRecentSets() {
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    const dateString = twoYearsAgo.toISOString().split('T')[0]

    return pokemonTCGClient.getSets({
      orderBy: '-releaseDate',
      pageSize: 50,
    })
  },

  /**
   * Get popular Pokemon cards (by name)
   */
  async getPopularCards() {
    const popularNames = ['Charizard', 'Pikachu', 'Mewtwo', 'Lugia', 'Rayquaza']
    const results = []

    for (const name of popularNames) {
      try {
        const response = await pokemonTCGClient.searchCardsByName(name, { pageSize: 5 })
        results.push(...response.data)
      } catch (error) {
        console.error(`Error fetching ${name}:`, error)
      }
    }

    return results
  },

  /**
   * Get cards with CardMarket pricing
   */
  async getCardsWithPricing(params?: { page?: number; pageSize?: number }) {
    return pokemonTCGClient.getCards({
      ...params,
      q: 'cardmarket.prices.averageSellPrice:[1 TO *]', // Cards with pricing data
    })
  },
}

export default pokemonTCGClient