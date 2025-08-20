import { NextRequest, NextResponse } from 'next/server'
import { historicalPricingService } from '@/lib/historical-pricing-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cardId = searchParams.get('cardId')
    const days = parseInt(searchParams.get('days') || '30')
    const variant = searchParams.get('variant') as 'normal' | 'reverse_holo' | 'tcgplayer' | 'all' || 'normal'
    const fillGaps = searchParams.get('fillGaps') === 'true'

    if (!cardId) {
      return NextResponse.json({
        success: false,
        error: 'cardId parameter is required'
      }, { status: 400 })
    }

    console.log(`Fetching price history for card ${cardId}, ${days} days, variant: ${variant}`)

    const result = await historicalPricingService.getHistoricalPricing({
      cardId,
      days,
      variant,
      fillGaps
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: result.data
    })

  } catch (error) {
    console.error('Error in pricing history API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...options } = body

    if (action === 'backfill') {
      console.log('Starting historical data backfill...')
      
      const result = await historicalPricingService.backfillHistoricalData(options)
      
      return NextResponse.json({
        success: result.success,
        message: `Backfill completed. ${result.processed} records processed.`,
        processed: result.processed,
        errors: result.errors
      })
    }

    if (action === 'capture') {
      const { cardId, cardData } = options
      
      if (!cardId || !cardData) {
        return NextResponse.json({
          success: false,
          error: 'cardId and cardData are required for capture action'
        }, { status: 400 })
      }

      const result = await historicalPricingService.captureCurrentPricing(cardId, cardData)
      
      return NextResponse.json({
        success: result.success,
        message: result.success ? 'Price snapshot captured' : result.error
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action. Supported actions: backfill, capture'
    }, { status: 400 })

  } catch (error) {
    console.error('Error in pricing history POST API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}