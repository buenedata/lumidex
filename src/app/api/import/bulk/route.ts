import { NextRequest, NextResponse } from 'next/server'
import { bulkImportService } from '@/lib/bulk-import'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      maxSets = 5, 
      cardsPerSet = 50, 
      batchSize = 20 
    } = body

    if (bulkImportService.isImportRunning()) {
      return NextResponse.json({
        success: false,
        message: 'Bulk import is already running'
      }, { status: 409 })
    }

    console.log(`Starting bulk import via API: ${maxSets} sets, ${cardsPerSet} cards per set`)
    
    const result = await bulkImportService.importPopularSets({
      maxSets,
      cardsPerSet,
      batchSize,
      onProgress: (progress) => {
        console.log(`Bulk import progress: ${progress.stage} - Overall: ${progress.overallProgress.current}/${progress.overallProgress.total}`)
        if (progress.currentSet) {
          console.log(`Current set: ${progress.currentSet} - Cards: ${progress.cardProgress.current}/${progress.cardProgress.total}`)
        }
      },
      onSetComplete: (setId, cardsImported) => {
        console.log(`✓ Completed set ${setId}: ${cardsImported} cards imported`)
      }
    })

    const statusCode = result.success ? 200 : 207 // 207 Multi-Status for partial success

    return NextResponse.json({
      success: result.success,
      message: result.success 
        ? `Bulk import completed successfully in ${Math.round(result.duration / 1000)}s`
        : `Bulk import completed with errors in ${Math.round(result.duration / 1000)}s`,
      data: {
        setsImported: result.setsImported,
        cardsImported: result.cardsImported,
        duration: result.duration,
        errors: result.errors
      }
    }, { status: statusCode })

  } catch (error) {
    console.error('Error in bulk import API:', error)
    return NextResponse.json({
      success: false,
      message: 'Internal server error during bulk import',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const isRunning = bulkImportService.isImportRunning()
    
    return NextResponse.json({
      success: true,
      data: {
        isRunning,
        status: isRunning ? 'running' : 'idle'
      }
    })

  } catch (error) {
    console.error('Error getting bulk import status:', error)
    return NextResponse.json({
      success: false,
      message: 'Error getting bulk import status',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    bulkImportService.stopImport()
    
    return NextResponse.json({
      success: true,
      message: 'Bulk import stop requested'
    })

  } catch (error) {
    console.error('Error stopping bulk import:', error)
    return NextResponse.json({
      success: false,
      message: 'Error stopping bulk import',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}