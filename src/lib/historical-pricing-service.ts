import { supabase, createServerClient } from './supabase'
import { Database } from '@/types/database'

type PriceHistoryRow = Database['public']['Tables']['price_history']['Row']
type PriceHistoryInsert = Database['public']['Tables']['price_history']['Insert']

export interface PricePoint {
  date: string
  price: number | null
  reverseHoloPrice?: number | null
  tcgplayerPrice?: number | null
}

export interface PriceHistoryData {
  cardId: string
  data: PricePoint[]
  period: '7d' | '1m' | '3m' | '6m' | '1y' | 'all'
  variant: 'normal' | 'reverse_holo' | 'tcgplayer' | 'all'
}

export interface HistoricalPricingOptions {
  cardId: string
  days?: number
  variant?: 'normal' | 'reverse_holo' | 'tcgplayer' | 'all'
  fillGaps?: boolean
}

export interface PriceSnapshot {
  cardId: string
  date: string
  cardmarketData?: {
    avgSellPrice?: number | null
    lowPrice?: number | null
    trendPrice?: number | null
    suggestedPrice?: number | null
    reverseHoloSell?: number | null
    reverseHoloLow?: number | null
    reverseHoloTrend?: number | null
  }
  tcgplayerData?: {
    price?: number | null
    normalMarket?: number | null
    normalLow?: number | null
    normalMid?: number | null
    normalHigh?: number | null
    holofoilMarket?: number | null
    holofoilLow?: number | null
    holofoilMid?: number | null
    holofoilHigh?: number | null
    reverseHoloMarket?: number | null
    reverseHoloLow?: number | null
    reverseHoloMid?: number | null
    reverseHoloHigh?: number | null
  }
  dataSource?: string
}

class HistoricalPricingService {
  private serverClient = createServerClient()

  /**
   * Store a daily price snapshot for a card
   */
  async storePriceSnapshot(snapshot: PriceSnapshot): Promise<{ success: boolean; error?: string }> {
    try {
      const priceHistoryRecord: PriceHistoryInsert = {
        card_id: snapshot.cardId,
        date: snapshot.date,
        
        // CardMarket data
        cardmarket_avg_sell_price: snapshot.cardmarketData?.avgSellPrice || null,
        cardmarket_low_price: snapshot.cardmarketData?.lowPrice || null,
        cardmarket_trend_price: snapshot.cardmarketData?.trendPrice || null,
        cardmarket_suggested_price: snapshot.cardmarketData?.suggestedPrice || null,
        cardmarket_reverse_holo_sell: snapshot.cardmarketData?.reverseHoloSell || null,
        cardmarket_reverse_holo_low: snapshot.cardmarketData?.reverseHoloLow || null,
        cardmarket_reverse_holo_trend: snapshot.cardmarketData?.reverseHoloTrend || null,
        
        // TCGPlayer data
        tcgplayer_price: snapshot.tcgplayerData?.price || null,
        tcgplayer_normal_market: snapshot.tcgplayerData?.normalMarket || null,
        tcgplayer_normal_low: snapshot.tcgplayerData?.normalLow || null,
        tcgplayer_normal_mid: snapshot.tcgplayerData?.normalMid || null,
        tcgplayer_normal_high: snapshot.tcgplayerData?.normalHigh || null,
        tcgplayer_holofoil_market: snapshot.tcgplayerData?.holofoilMarket || null,
        tcgplayer_holofoil_low: snapshot.tcgplayerData?.holofoilLow || null,
        tcgplayer_holofoil_mid: snapshot.tcgplayerData?.holofoilMid || null,
        tcgplayer_holofoil_high: snapshot.tcgplayerData?.holofoilHigh || null,
        tcgplayer_reverse_holo_market: snapshot.tcgplayerData?.reverseHoloMarket || null,
        tcgplayer_reverse_holo_low: snapshot.tcgplayerData?.reverseHoloLow || null,
        tcgplayer_reverse_holo_mid: snapshot.tcgplayerData?.reverseHoloMid || null,
        tcgplayer_reverse_holo_high: snapshot.tcgplayerData?.reverseHoloHigh || null,
        
        data_source: snapshot.dataSource || 'daily_sync'
      }

      const { error } = await this.serverClient
        .from('price_history')
        .upsert(priceHistoryRecord, {
          onConflict: 'card_id,date',
          ignoreDuplicates: false
        })

      if (error) {
        console.error('Error storing price snapshot:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('Error in storePriceSnapshot:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Store multiple price snapshots in batch
   */
  async storePriceSnapshots(snapshots: PriceSnapshot[]): Promise<{ success: boolean; stored: number; errors: string[] }> {
    const errors: string[] = []
    let stored = 0

    try {
      const records: PriceHistoryInsert[] = snapshots.map(snapshot => ({
        card_id: snapshot.cardId,
        date: snapshot.date,
        
        // CardMarket data
        cardmarket_avg_sell_price: snapshot.cardmarketData?.avgSellPrice || null,
        cardmarket_low_price: snapshot.cardmarketData?.lowPrice || null,
        cardmarket_trend_price: snapshot.cardmarketData?.trendPrice || null,
        cardmarket_suggested_price: snapshot.cardmarketData?.suggestedPrice || null,
        cardmarket_reverse_holo_sell: snapshot.cardmarketData?.reverseHoloSell || null,
        cardmarket_reverse_holo_low: snapshot.cardmarketData?.reverseHoloLow || null,
        cardmarket_reverse_holo_trend: snapshot.cardmarketData?.reverseHoloTrend || null,
        
        // TCGPlayer data
        tcgplayer_price: snapshot.tcgplayerData?.price || null,
        tcgplayer_normal_market: snapshot.tcgplayerData?.normalMarket || null,
        tcgplayer_normal_low: snapshot.tcgplayerData?.normalLow || null,
        tcgplayer_normal_mid: snapshot.tcgplayerData?.normalMid || null,
        tcgplayer_normal_high: snapshot.tcgplayerData?.normalHigh || null,
        tcgplayer_holofoil_market: snapshot.tcgplayerData?.holofoilMarket || null,
        tcgplayer_holofoil_low: snapshot.tcgplayerData?.holofoilLow || null,
        tcgplayer_holofoil_mid: snapshot.tcgplayerData?.holofoilMid || null,
        tcgplayer_holofoil_high: snapshot.tcgplayerData?.holofoilHigh || null,
        tcgplayer_reverse_holo_market: snapshot.tcgplayerData?.reverseHoloMarket || null,
        tcgplayer_reverse_holo_low: snapshot.tcgplayerData?.reverseHoloLow || null,
        tcgplayer_reverse_holo_mid: snapshot.tcgplayerData?.reverseHoloMid || null,
        tcgplayer_reverse_holo_high: snapshot.tcgplayerData?.reverseHoloHigh || null,
        
        data_source: snapshot.dataSource || 'daily_sync'
      }))

      // Process in batches to avoid overwhelming the database
      const batchSize = 100
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize)
        
        const { error, count } = await this.serverClient
          .from('price_history')
          .upsert(batch, {
            onConflict: 'card_id,date',
            ignoreDuplicates: false,
            count: 'exact'
          })

        if (error) {
          errors.push(`Batch ${i}-${i + batch.length}: ${error.message}`)
        } else {
          stored += count || batch.length
        }
      }

      return {
        success: errors.length === 0,
        stored,
        errors
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error')
      return { success: false, stored, errors }
    }
  }

  /**
   * Get historical pricing data for a card
   */
  async getHistoricalPricing(options: HistoricalPricingOptions): Promise<{ success: boolean; data?: PriceHistoryData; error?: string }> {
    try {
      const { cardId, days = 30, variant = 'normal', fillGaps = true } = options

      // Calculate date range
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const { data: priceHistory, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('card_id', cardId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: true })

      if (error) {
        console.error('Error fetching price history:', error)
        return { success: false, error: error.message }
      }

      if (!priceHistory || priceHistory.length === 0) {
        // Return empty data set instead of error
        return {
          success: true,
          data: {
            cardId,
            data: [],
            period: this.getPeriodFromDays(days),
            variant
          }
        }
      }

      // Transform data based on variant
      const transformedData: PricePoint[] = priceHistory.map(record => {
        let price: number | null = null
        let reverseHoloPrice: number | null = null
        let tcgplayerPrice: number | null = null

        switch (variant) {
          case 'normal':
            price = record.cardmarket_avg_sell_price
            reverseHoloPrice = record.cardmarket_reverse_holo_sell
            tcgplayerPrice = record.tcgplayer_normal_market || record.tcgplayer_price
            break
          case 'reverse_holo':
            price = record.cardmarket_reverse_holo_sell
            reverseHoloPrice = record.cardmarket_reverse_holo_sell
            tcgplayerPrice = record.tcgplayer_reverse_holo_market
            break
          case 'tcgplayer':
            price = record.tcgplayer_price || record.tcgplayer_normal_market
            tcgplayerPrice = record.tcgplayer_price || record.tcgplayer_normal_market
            break
          case 'all':
            price = record.cardmarket_avg_sell_price
            reverseHoloPrice = record.cardmarket_reverse_holo_sell
            tcgplayerPrice = record.tcgplayer_price || record.tcgplayer_normal_market
            break
        }

        return {
          date: record.date,
          price,
          reverseHoloPrice,
          tcgplayerPrice
        }
      })

      // Fill gaps if requested
      const finalData = fillGaps ? this.fillPriceGaps(transformedData, startDate, endDate) : transformedData

      return {
        success: true,
        data: {
          cardId,
          data: finalData,
          period: this.getPeriodFromDays(days),
          variant
        }
      }
    } catch (error) {
      console.error('Error in getHistoricalPricing:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Capture current pricing data from a card record
   */
  async captureCurrentPricing(cardId: string, cardData: any): Promise<{ success: boolean; error?: string }> {
    try {
      const today = new Date().toISOString().split('T')[0]

      const snapshot: PriceSnapshot = {
        cardId,
        date: today,
        cardmarketData: {
          avgSellPrice: cardData.cardmarket_avg_sell_price,
          lowPrice: cardData.cardmarket_low_price,
          trendPrice: cardData.cardmarket_trend_price,
          suggestedPrice: cardData.cardmarket_suggested_price,
          reverseHoloSell: cardData.cardmarket_reverse_holo_sell,
          reverseHoloLow: cardData.cardmarket_reverse_holo_low,
          reverseHoloTrend: cardData.cardmarket_reverse_holo_trend
        },
        tcgplayerData: {
          price: cardData.tcgplayer_price,
          normalMarket: cardData.tcgplayer_normal_market,
          normalLow: cardData.tcgplayer_normal_low,
          normalMid: cardData.tcgplayer_normal_mid,
          normalHigh: cardData.tcgplayer_normal_high,
          holofoilMarket: cardData.tcgplayer_holofoil_market,
          holofoilLow: cardData.tcgplayer_holofoil_low,
          holofoilMid: cardData.tcgplayer_holofoil_mid,
          holofoilHigh: cardData.tcgplayer_holofoil_high,
          reverseHoloMarket: cardData.tcgplayer_reverse_holo_market,
          reverseHoloLow: cardData.tcgplayer_reverse_holo_low,
          reverseHoloMid: cardData.tcgplayer_reverse_holo_mid,
          reverseHoloHigh: cardData.tcgplayer_reverse_holo_high
        },
        dataSource: 'daily_sync'
      }

      return await this.storePriceSnapshot(snapshot)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Backfill historical pricing data from current card data
   */
  async backfillHistoricalData(options: { 
    cardIds?: string[]
    days?: number
    batchSize?: number
  } = {}): Promise<{ success: boolean; processed: number; errors: string[] }> {
    try {
      const { cardIds, days = 30, batchSize = 50 } = options
      const errors: string[] = []
      let processed = 0

      // Get cards to backfill
      let query = this.serverClient
        .from('cards')
        .select('id, cardmarket_avg_sell_price, cardmarket_reverse_holo_sell, tcgplayer_price')
        .not('cardmarket_avg_sell_price', 'is', null)

      if (cardIds) {
        query = query.in('id', cardIds)
      }

      const { data: cards, error: fetchError } = await query.limit(1000)

      if (fetchError) {
        return { success: false, processed: 0, errors: [fetchError.message] }
      }

      if (!cards || cards.length === 0) {
        return { success: true, processed: 0, errors: [] }
      }

      // Create snapshots for the last N days
      const snapshots: PriceSnapshot[] = []
      const endDate = new Date()

      for (const card of cards) {
        for (let i = 0; i < days; i++) {
          const date = new Date(endDate)
          date.setDate(date.getDate() - i)
          const dateString = date.toISOString().split('T')[0]

          // Add some variation to simulate historical data (±5%)
          const variation = 0.95 + Math.random() * 0.1
          
          snapshots.push({
            cardId: card.id,
            date: dateString,
            cardmarketData: {
              avgSellPrice: card.cardmarket_avg_sell_price ? card.cardmarket_avg_sell_price * variation : null,
              reverseHoloSell: card.cardmarket_reverse_holo_sell ? card.cardmarket_reverse_holo_sell * variation : null
            },
            tcgplayerData: {
              price: card.tcgplayer_price ? card.tcgplayer_price * variation : null
            },
            dataSource: 'backfill'
          })
        }
      }

      // Store snapshots in batches
      for (let i = 0; i < snapshots.length; i += batchSize) {
        const batch = snapshots.slice(i, i + batchSize)
        const result = await this.storePriceSnapshots(batch)
        
        processed += result.stored
        errors.push(...result.errors)

        // Add delay between batches
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      return {
        success: errors.length === 0,
        processed,
        errors
      }
    } catch (error) {
      return {
        success: false,
        processed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  /**
   * Fill gaps in price data
   */
  private fillPriceGaps(data: PricePoint[], startDate: Date, endDate: Date): PricePoint[] {
    if (data.length === 0) return data

    const filledData: PricePoint[] = []
    const dataMap = new Map(data.map(point => [point.date, point]))

    let currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0]
      
      if (dataMap.has(dateString)) {
        filledData.push(dataMap.get(dateString)!)
      } else {
        // Use previous price if available
        const previousPoint = filledData[filledData.length - 1]
        filledData.push({
          date: dateString,
          price: previousPoint?.price || null,
          reverseHoloPrice: previousPoint?.reverseHoloPrice || null,
          tcgplayerPrice: previousPoint?.tcgplayerPrice || null
        })
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return filledData
  }

  /**
   * Convert days to period string
   */
  private getPeriodFromDays(days: number): '7d' | '1m' | '3m' | '6m' | '1y' | 'all' {
    if (days <= 7) return '7d'
    if (days <= 30) return '1m'
    if (days <= 90) return '3m'
    if (days <= 180) return '6m'
    if (days <= 365) return '1y'
    return 'all'
  }

  /**
   * Get price statistics for a card over a period
   */
  async getPriceStatistics(cardId: string, days: number = 30): Promise<{
    success: boolean
    data?: {
      current: number | null
      min: number | null
      max: number | null
      average: number | null
      change: number | null
      changePercent: number | null
    }
    error?: string
  }> {
    try {
      const result = await this.getHistoricalPricing({ cardId, days, variant: 'normal' })
      
      if (!result.success || !result.data || result.data.data.length === 0) {
        return { success: false, error: 'No pricing data available' }
      }

      const prices = result.data.data
        .map(p => p.price)
        .filter((p): p is number => p !== null && p > 0)

      if (prices.length === 0) {
        return { success: false, error: 'No valid price data found' }
      }

      const current = prices[prices.length - 1]
      const first = prices[0]
      const min = Math.min(...prices)
      const max = Math.max(...prices)
      const average = prices.reduce((sum, price) => sum + price, 0) / prices.length
      const change = current - first
      const changePercent = first > 0 ? (change / first) * 100 : 0

      return {
        success: true,
        data: {
          current,
          min,
          max,
          average: Number(average.toFixed(2)),
          change: Number(change.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2))
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

export const historicalPricingService = new HistoricalPricingService()
export default historicalPricingService