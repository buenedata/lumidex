import { NextRequest, NextResponse } from 'next/server'
import { dataSyncService } from '@/lib/data-sync'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { batchSize = 50, source = 'all' } = body

    console.log(`Starting pricing update via API for source: ${source}...`)
    
    const result = await dataSyncService.updateCardPricing({
      batchSize,
      source, // Pass the source parameter
      onProgress: (progress: { current: number; total: number }) => {
        console.log(`Pricing update progress (${source}): ${progress.current}/${progress.total}`)
      }
    })

    const sourceLabel = source === 'all' ? 'all sources' : source === 'cardmarket' ? 'CardMarket' : 'TCGPlayer'

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `${sourceLabel} pricing update completed successfully. ${result.cardsUpdated} cards updated.`,
        cardsUpdated: result.cardsUpdated,
        errors: result.errors,
        source
      })
    } else {
      return NextResponse.json({
        success: false,
        message: `${sourceLabel} pricing update completed with errors. ${result.cardsUpdated} cards updated.`,
        cardsUpdated: result.cardsUpdated,
        errors: result.errors,
        source
      }, { status: 207 }) // 207 Multi-Status
    }

  } catch (error) {
    console.error('Error in pricing update API:', error)
    return NextResponse.json({
      success: false,
      message: 'Internal server error during pricing update',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const status = await dataSyncService.getSyncStatus()
    
    return NextResponse.json({
      success: true,
      data: status
    })

  } catch (error) {
    console.error('Error getting sync status:', error)
    return NextResponse.json({
      success: false,
      message: 'Error getting sync status',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}