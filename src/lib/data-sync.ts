import { createServerClient } from '@/lib/supabase'
import { pokemonTCGClient, transformCardData, transformSetData } from '@/lib/pokemon-tcg-api'
import { historicalPricingService } from '@/lib/historical-pricing-service'
import { Card, Set } from '@/types'

interface SyncProgress {
  stage: 'sets' | 'cards' | 'complete'
  current: number
  total: number
  errors: string[]
  startTime: Date
}

interface SyncOptions {
  batchSize?: number
  maxRetries?: number
  onProgress?: (progress: SyncProgress) => void
  setsOnly?: boolean
  specificSetId?: string
  forceResync?: boolean
  source?: 'cardmarket' | 'tcgplayer' | 'all'
}

class DataSyncService {
  private supabase = createServerClient()
  private isRunning = false
  private currentProgress: SyncProgress | null = null

  /**
   * Sync all Pokemon sets from the API to the database
   */
  async syncSets(options: SyncOptions = {}): Promise<{ success: boolean; errors: string[] }> {
    const { batchSize = 50, maxRetries = 3, onProgress } = options
    const errors: string[] = []

    try {
      console.log('Starting sets sync...')
      
      // Get all sets from Pokemon TCG API
      const response = await pokemonTCGClient.getSets({
        pageSize: 250,
        orderBy: '-releaseDate'
      })

      const apiSets = response.data
      const total = apiSets.length

      this.currentProgress = {
        stage: 'sets',
        current: 0,
        total,
        errors: [],
        startTime: new Date()
      }

      // Process sets in batches
      for (let i = 0; i < apiSets.length; i += batchSize) {
        const batch = apiSets.slice(i, i + batchSize)
        
        try {
          const transformedSets = batch.map(transformSetData)
          
          // Upsert sets to database
          const { error } = await this.supabase
            .from('sets')
            .upsert(transformedSets, { 
              onConflict: 'id',
              ignoreDuplicates: false 
            })

          if (error) {
            const errorMsg = `Error upserting sets batch ${i}-${i + batch.length}: ${error.message}`
            errors.push(errorMsg)
            console.error(errorMsg)
          } else {
            console.log(`Successfully synced sets ${i + 1}-${Math.min(i + batch.length, total)}`)
          }

        } catch (error) {
          const errorMsg = `Error processing sets batch ${i}-${i + batch.length}: ${error}`
          errors.push(errorMsg)
          console.error(errorMsg)
        }

        this.currentProgress.current = Math.min(i + batch.length, total)
        this.currentProgress.errors = errors
        
        if (onProgress) {
          onProgress(this.currentProgress)
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      console.log(`Sets sync completed. ${total - errors.length} successful, ${errors.length} errors`)
      
      // Consider sync successful if we have some sets synced, even with some errors
      const successfulSets = total - errors.length
      const isSuccessful = successfulSets > 0 && (errors.length / total) < 0.5 // Less than 50% errors
      
      return { success: isSuccessful, errors }

    } catch (error) {
      const errorMsg = `Fatal error during sets sync: ${error}`
      errors.push(errorMsg)
      console.error(errorMsg)
      
      // If it's just an API timeout, don't fail the entire sync
      if (error instanceof Error && error.message.includes('504 Gateway Timeout')) {
        console.log('API timeout detected, but continuing with partial sync...')
        return { success: true, errors }
      }
      
      return { success: false, errors }
    }
  }

  /**
   * Sync cards from a specific set
   */
  async syncCardsFromSet(
    setId: string,
    options: SyncOptions = {}
  ): Promise<{ success: boolean; errors: string[]; cardsProcessed: number }> {
    const { batchSize = 20, maxRetries = 3, onProgress } = options
    const errors: string[] = []
    let cardsProcessed = 0

    try {
      console.log(`Starting cards sync for set: ${setId}`)

      // Check if this set already has cards synced
      const { count: existingCardsCount, error: checkError } = await this.supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .eq('set_id', setId)

      if (checkError) {
        console.error(`Error checking existing cards for set ${setId}:`, checkError.message)
      } else if (existingCardsCount && existingCardsCount > 0) {
        console.log(`Set ${setId} already has ${existingCardsCount} cards synced, skipping...`)
        return { success: true, errors: [], cardsProcessed: 0 }
      }

      // Get all cards from the set
      let page = 1
      let hasMore = true
      const allCards: any[] = []

      // Fetch all pages of cards for this set
      while (hasMore) {
        try {
          const response = await pokemonTCGClient.getCardsFromSet(setId, {
            page,
            pageSize: 250,
            orderBy: 'number'
          })

          allCards.push(...response.data)
          hasMore = response.data.length === 250 // If we got a full page, there might be more
          page++

          // Small delay between pages
          await new Promise(resolve => setTimeout(resolve, 200))

        } catch (error) {
          console.error(`Error fetching page ${page} for set ${setId}:`, error)
          hasMore = false
        }
      }

      console.log(`Found ${allCards.length} cards in set ${setId}`)

      if (allCards.length === 0) {
        return { success: true, errors: [], cardsProcessed: 0 }
      }

      this.currentProgress = {
        stage: 'cards',
        current: 0,
        total: allCards.length,
        errors: [],
        startTime: new Date()
      }

      // Process cards in smaller batches
      for (let i = 0; i < allCards.length; i += batchSize) {
        const batch = allCards.slice(i, i + batchSize)
        
        try {
          const transformedCards = batch.map(transformCardData)
          
          // Upsert cards to database
          const { error } = await this.supabase
            .from('cards')
            .upsert(transformedCards, { 
              onConflict: 'id',
              ignoreDuplicates: false 
            })

          if (error) {
            const errorMsg = `Error upserting cards batch ${i}-${i + batch.length} for set ${setId}: ${error.message}`
            errors.push(errorMsg)
            console.error(errorMsg)
          } else {
            cardsProcessed += batch.length
            console.log(`Successfully synced cards ${i + 1}-${Math.min(i + batch.length, allCards.length)} for set ${setId}`)
          }

        } catch (error) {
          const errorMsg = `Error processing cards batch ${i}-${i + batch.length} for set ${setId}: ${error}`
          errors.push(errorMsg)
          console.error(errorMsg)
        }

        this.currentProgress.current = Math.min(i + batch.length, allCards.length)
        this.currentProgress.errors = errors
        
        if (onProgress) {
          onProgress(this.currentProgress)
        }

        // Delay between batches to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 300))
      }

      console.log(`Cards sync completed for set ${setId}. ${cardsProcessed} cards processed, ${errors.length} errors`)
      return { success: errors.length === 0, errors, cardsProcessed }

    } catch (error) {
      const errorMsg = `Fatal error during cards sync for set ${setId}: ${error}`
      errors.push(errorMsg)
      console.error(errorMsg)
      return { success: false, errors, cardsProcessed }
    }
  }

  /**
   * Sync all cards from all sets (use with caution - this is a lot of data!)
   */
  async syncAllCards(options: SyncOptions = {}): Promise<{ success: boolean; errors: string[]; totalCards: number }> {
    const { onProgress } = options
    const errors: string[] = []
    let totalCards = 0

    if (this.isRunning) {
      console.log('Sync already running, skipping cards sync...')
      return { success: false, errors: ['Sync operation already in progress'], totalCards: 0 }
    }

    this.isRunning = true

    try {
      // First get all sets from our database
      const { data: sets, error: setsError } = await this.supabase
        .from('sets')
        .select('id, name')
        .order('release_date', { ascending: false })

      if (setsError) {
        errors.push(`Error fetching sets: ${setsError.message}`)
        return { success: false, errors, totalCards: 0 }
      }

      if (!sets || sets.length === 0) {
        errors.push('No sets found in database. Please sync sets first.')
        return { success: false, errors, totalCards: 0 }
      }

      console.log(`Starting full cards sync for ${sets.length} sets...`)

      // Sync cards for each set
      for (let i = 0; i < sets.length; i++) {
        const set = sets[i]
        console.log(`Syncing cards for set ${i + 1}/${sets.length}: ${set.name} (${set.id})`)

        const result = await this.syncCardsFromSet(set.id, {
          ...options,
          onProgress: (progress) => {
            // Adjust progress to show overall progress across all sets
            const overallProgress: SyncProgress = {
              ...progress,
              current: (i * 1000) + progress.current, // Rough estimate
              total: sets.length * 1000, // Rough estimate
            }
            if (onProgress) onProgress(overallProgress)
          }
        })

        errors.push(...result.errors)
        totalCards += result.cardsProcessed

        // Longer delay between sets
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      console.log(`Full cards sync completed. ${totalCards} total cards processed, ${errors.length} errors`)
      return { success: errors.length === 0, errors, totalCards }

    } catch (error) {
      const errorMsg = `Fatal error during full cards sync: ${error}`
      errors.push(errorMsg)
      console.error(errorMsg)
      return { success: false, errors, totalCards }
    }
  }

  /**
   * Update pricing data for existing cards
   */
  async updateCardPricing(options: SyncOptions = {}): Promise<{ success: boolean; errors: string[]; cardsUpdated: number }> {
    const { batchSize = 50, onProgress } = options
    const errors: string[] = []
    let cardsUpdated = 0

    try {
      console.log('Starting pricing update...')

      // Get cards that need pricing updates (older than 24 hours or no pricing data)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
      const { data: cardsToUpdate, error: fetchError } = await this.supabase
        .from('cards')
        .select('id')
        .or(`cardmarket_last_sync.is.null,cardmarket_last_sync.lt.${twentyFourHoursAgo}`)
        .limit(1000) // Limit to avoid overwhelming the API

      if (fetchError) {
        errors.push(`Error fetching cards for pricing update: ${fetchError.message}`)
        return { success: false, errors, cardsUpdated: 0 }
      }

      if (!cardsToUpdate || cardsToUpdate.length === 0) {
        console.log('No cards need pricing updates')
        return { success: true, errors: [], cardsUpdated: 0 }
      }

      console.log(`Found ${cardsToUpdate.length} cards that need pricing updates`)

      this.currentProgress = {
        stage: 'cards',
        current: 0,
        total: cardsToUpdate.length,
        errors: [],
        startTime: new Date()
      }

      // Process cards in batches
      for (let i = 0; i < cardsToUpdate.length; i += batchSize) {
        const batch = cardsToUpdate.slice(i, i + batchSize)
        
        for (const card of batch) {
          try {
            // Fetch updated card data from API
            const response = await pokemonTCGClient.getCard(card.id)
            const updatedCardData = transformCardData(response.data)

            // Update only pricing-related fields
            const { error: updateError } = await this.supabase
              .from('cards')
              .update({
                cardmarket_url: updatedCardData.cardmarket_url,
                cardmarket_updated_at: updatedCardData.cardmarket_updated_at,
                cardmarket_avg_sell_price: updatedCardData.cardmarket_avg_sell_price,
                cardmarket_low_price: updatedCardData.cardmarket_low_price,
                cardmarket_trend_price: updatedCardData.cardmarket_trend_price,
                cardmarket_suggested_price: updatedCardData.cardmarket_suggested_price,
                cardmarket_german_pro_low: updatedCardData.cardmarket_german_pro_low,
                cardmarket_low_price_ex_plus: updatedCardData.cardmarket_low_price_ex_plus,
                cardmarket_reverse_holo_sell: updatedCardData.cardmarket_reverse_holo_sell,
                cardmarket_reverse_holo_low: updatedCardData.cardmarket_reverse_holo_low,
                cardmarket_reverse_holo_trend: updatedCardData.cardmarket_reverse_holo_trend,
                cardmarket_avg_1_day: updatedCardData.cardmarket_avg_1_day,
                cardmarket_avg_7_days: updatedCardData.cardmarket_avg_7_days,
                cardmarket_avg_30_days: updatedCardData.cardmarket_avg_30_days,
                cardmarket_last_sync: new Date().toISOString(),
                cardmarket_sync_status: 'success',
                tcgplayer_price: updatedCardData.tcgplayer_price,
                tcgplayer_url: updatedCardData.tcgplayer_url,
                tcgplayer_normal_available: updatedCardData.tcgplayer_normal_available,
                tcgplayer_holofoil_available: updatedCardData.tcgplayer_holofoil_available,
                tcgplayer_reverse_holo_available: updatedCardData.tcgplayer_reverse_holo_available,
                tcgplayer_1st_edition_available: updatedCardData.tcgplayer_1st_edition_available,
                tcgplayer_1st_edition_normal_market: updatedCardData.tcgplayer_1st_edition_normal_market,
                tcgplayer_1st_edition_normal_low: updatedCardData.tcgplayer_1st_edition_normal_low,
                tcgplayer_1st_edition_normal_mid: updatedCardData.tcgplayer_1st_edition_normal_mid,
                tcgplayer_1st_edition_normal_high: updatedCardData.tcgplayer_1st_edition_normal_high,
                tcgplayer_1st_edition_holofoil_market: updatedCardData.tcgplayer_1st_edition_holofoil_market,
                tcgplayer_1st_edition_holofoil_low: updatedCardData.tcgplayer_1st_edition_holofoil_low,
                tcgplayer_1st_edition_holofoil_mid: updatedCardData.tcgplayer_1st_edition_holofoil_mid,
                tcgplayer_1st_edition_holofoil_high: updatedCardData.tcgplayer_1st_edition_holofoil_high,
                tcgplayer_last_sync: updatedCardData.tcgplayer_last_sync,
                tcgplayer_sync_status: updatedCardData.tcgplayer_sync_status,
              })
              .eq('id', card.id)

            if (updateError) {
              errors.push(`Error updating card ${card.id}: ${updateError.message}`)
            } else {
              cardsUpdated++
              
              // Capture pricing snapshot for historical data
              try {
                await historicalPricingService.captureCurrentPricing(card.id, updatedCardData)
              } catch (snapshotError) {
                console.warn(`Failed to capture price snapshot for card ${card.id}:`, snapshotError)
                // Don't fail the entire operation if snapshot fails
              }
            }

          } catch (error) {
            errors.push(`Error fetching pricing for card ${card.id}: ${error}`)
          }

          // Rate limiting delay
          await new Promise(resolve => setTimeout(resolve, 200))
        }

        this.currentProgress.current = Math.min(i + batch.length, cardsToUpdate.length)
        this.currentProgress.errors = errors
        
        if (onProgress) {
          onProgress(this.currentProgress)
        }

        console.log(`Updated pricing for ${Math.min(i + batch.length, cardsToUpdate.length)}/${cardsToUpdate.length} cards`)
      }

      console.log(`Pricing update completed. ${cardsUpdated} cards updated, ${errors.length} errors`)
      return { success: errors.length === 0, errors, cardsUpdated }

    } catch (error) {
      const errorMsg = `Fatal error during pricing update: ${error}`
      errors.push(errorMsg)
      console.error(errorMsg)
      return { success: false, errors, cardsUpdated: 0 }
    }
  }

  /**
   * Get sync status and statistics
   */
  async getSyncStatus() {
    try {
      const [setsResult, cardsResult, pricingResult] = await Promise.all([
        this.supabase.from('sets').select('count', { count: 'exact', head: true }),
        this.supabase.from('cards').select('count', { count: 'exact', head: true }),
        this.supabase
          .from('cards')
          .select('count', { count: 'exact', head: true })
          .not('cardmarket_avg_sell_price', 'is', null)
      ])

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const recentPricingResult = await this.supabase
        .from('cards')
        .select('count', { count: 'exact', head: true })
        .gte('cardmarket_last_sync', twentyFourHoursAgo)

      return {
        sets: {
          total: setsResult.count || 0,
          lastSync: null, // Could add this to track last sync time
        },
        cards: {
          total: cardsResult.count || 0,
          withPricing: pricingResult.count || 0,
          recentPricingUpdates: recentPricingResult.count || 0,
        },
        isRunning: this.isRunning,
        currentProgress: this.currentProgress,
      }
    } catch (error) {
      console.error('Error getting sync status:', error)
      return null
    }
  }

  /**
   * Stop any running sync operation
   */
  stopSync() {
    this.isRunning = false
    this.currentProgress = null
  }
}

// Create singleton instance
export const dataSyncService = new DataSyncService()

export default dataSyncService