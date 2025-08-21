/**
 * Complete Price History Population Script
 * 
 * This script generates comprehensive historical pricing data for all cards
 * in the Supabase database, ensuring full coverage for:
 * - 7 days (daily data)
 * - 1 month (30 days daily data) 
 * - 3 months (90 days daily data)
 * - 1 year (365 days daily data)
 * 
 * Usage:
 * node scripts/populate-price-history.js
 * 
 * Or run the SQL script directly in Supabase:
 * scripts/populate-complete-price-history.sql
 */

// Check for required dependencies
try {
  const { createClient } = require('@supabase/supabase-js')
  require('dotenv').config({ path: '.env.local' })
} catch (error) {
  console.error('❌ Missing required dependencies. Please run:')
  console.error('npm install @supabase/supabase-js dotenv')
  process.exit(1)
}

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env.local file')
  console.error('Current values:')
  console.error(`NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'SET' : 'MISSING'}`)
  console.error(`SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? 'SET' : 'MISSING'}`)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function populatePriceHistory() {
  console.log('🚀 Starting complete price history population...')
  console.log('📅 Generating 365 days of historical data for all cards with pricing')
  
  try {
    // Get cards with pricing data
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select(`
        id,
        name,
        cardmarket_avg_sell_price,
        cardmarket_reverse_holo_sell,
        tcgplayer_price,
        cardmarket_avg_7_days,
        cardmarket_avg_30_days
      `)
      .not('cardmarket_avg_sell_price', 'is', null)
      .gt('cardmarket_avg_sell_price', 0)
      .order('cardmarket_avg_sell_price', { ascending: false })
      .limit(1000) // Process top 1000 cards
    
    if (cardsError) {
      throw new Error(`Failed to fetch cards: ${cardsError.message}`)
    }
    
    console.log(`📊 Found ${cards.length} cards with pricing data`)
    
    let totalRecordsInserted = 0
    const batchSize = 10 // Process 10 cards at a time
    
    for (let cardIndex = 0; cardIndex < cards.length; cardIndex += batchSize) {
      const cardBatch = cards.slice(cardIndex, cardIndex + batchSize)
      const historyBatch = []
      
      console.log(`📈 Processing cards ${cardIndex + 1}-${Math.min(cardIndex + batchSize, cards.length)} of ${cards.length}`)
      
      for (const card of cardBatch) {
        // Generate 365 days of historical data
        for (let i = 0; i < 365; i++) {
          const targetDate = new Date()
          targetDate.setDate(targetDate.getDate() - i)
          
          // Calculate realistic daily price with trends
          let dailyPrice = card.cardmarket_avg_sell_price
          
          if (i === 0) {
            // Today: use current price
            dailyPrice = card.cardmarket_avg_sell_price
          } else if (i <= 7 && card.cardmarket_avg_7_days) {
            // Last 7 days: interpolate between current and 7-day average
            const ratio = i / 7
            dailyPrice = card.cardmarket_avg_sell_price + 
                        (card.cardmarket_avg_7_days - card.cardmarket_avg_sell_price) * ratio
          } else if (i <= 30 && card.cardmarket_avg_30_days) {
            // Last 30 days: interpolate between 7-day and 30-day average
            const avg7Days = card.cardmarket_avg_7_days || card.cardmarket_avg_sell_price
            const ratio = (i - 7) / 23
            dailyPrice = avg7Days + (card.cardmarket_avg_30_days - avg7Days) * ratio
          } else {
            // Beyond 30 days: use 30-day average with slight appreciation
            const avg30Days = card.cardmarket_avg_30_days || card.cardmarket_avg_sell_price
            const monthsBack = (i - 30) / 30
            dailyPrice = avg30Days * (1 + monthsBack * 0.004) // 0.4% monthly appreciation
          }
          
          // Add realistic daily volatility based on card value
          let volatility = 0.06 // Default ±6%
          if (card.cardmarket_avg_sell_price > 100) {
            volatility = 0.03 // High value: ±3%
          } else if (card.cardmarket_avg_sell_price > 10) {
            volatility = 0.05 // Medium value: ±5%
          } else {
            volatility = 0.08 // Low value: ±8%
          }
          
          const variation = 1 + (Math.random() - 0.5) * volatility * 2
          dailyPrice = Math.max(0.01, dailyPrice * variation)
          
          // Calculate reverse holo price if available
          let dailyReverseHolo = null
          if (card.cardmarket_reverse_holo_sell) {
            const ratio = dailyPrice / card.cardmarket_avg_sell_price
            dailyReverseHolo = Math.max(0.01, card.cardmarket_reverse_holo_sell * ratio)
          }
          
          // Calculate TCGPlayer price if available
          let dailyTcgPlayer = null
          if (card.tcgplayer_price) {
            const ratio = dailyPrice / card.cardmarket_avg_sell_price
            dailyTcgPlayer = Math.max(0.01, card.tcgplayer_price * ratio)
          }
          
          historyBatch.push({
            card_id: card.id,
            date: targetDate.toISOString().split('T')[0],
            cardmarket_avg_sell_price: Math.round(dailyPrice * 100) / 100,
            cardmarket_low_price: Math.round(dailyPrice * 0.85 * 100) / 100,
            cardmarket_trend_price: Math.round(dailyPrice * 1.10 * 100) / 100,
            cardmarket_reverse_holo_sell: dailyReverseHolo ? Math.round(dailyReverseHolo * 100) / 100 : null,
            tcgplayer_price: dailyTcgPlayer ? Math.round(dailyTcgPlayer * 100) / 100 : null,
            data_source: 'complete_backfill_365d_js'
          })
        }
      }
      
      // Insert batch
      const { error: insertError } = await supabase
        .from('price_history')
        .upsert(historyBatch, {
          onConflict: 'card_id,date',
          ignoreDuplicates: false
        })
      
      if (insertError) {
        console.error(`❌ Error inserting batch ${cardIndex / batchSize + 1}:`, insertError.message)
        continue
      }
      
      totalRecordsInserted += historyBatch.length
      console.log(`✅ Inserted ${historyBatch.length} records for batch ${cardIndex / batchSize + 1}`)
      
      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    console.log('✅ Price history population completed!')
    console.log(`📈 Total records inserted: ${totalRecordsInserted}`)
    
    // Verify the results
    const { data: summary, error: summaryError } = await supabase
      .from('price_history')
      .select('card_id, date')
      .eq('data_source', 'complete_backfill_365d_js')
    
    if (!summaryError && summary) {
      const uniqueCards = new Set(summary.map(r => r.card_id)).size
      console.log(`📊 Verification: ${uniqueCards} cards now have historical data`)
      console.log(`📅 Date range: ${summary.length} total records`)
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message)
    process.exit(1)
  }
}

// Check if we're running this script directly
if (require.main === module) {
  populatePriceHistory()
    .then(() => {
      console.log('🎉 Script completed successfully!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Script failed:', error)
      process.exit(1)
    })
}

module.exports = { populatePriceHistory }