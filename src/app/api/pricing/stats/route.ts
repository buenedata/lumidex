import { NextRequest, NextResponse } from 'next/server'
import { historicalPricingService } from '@/lib/historical-pricing-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cardId = searchParams.get('cardId')
    const days = parseInt(searchParams.get('days') || '30')

    if (!cardId) {
      return NextResponse.json({
        success: false,
        error: 'cardId parameter is required'
      }, { status: 400 })
    }

    console.log(`Fetching price statistics for card ${cardId}, ${days} days`)

    const result = await historicalPricingService.getPriceStatistics(cardId, days)

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
    console.error('Error in pricing stats API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}