import { NextRequest, NextResponse } from 'next/server'
import { dataSyncService } from '@/lib/data-sync'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { setId, batchSize = 50 } = body

    if (!setId) {
      return NextResponse.json({
        success: false,
        message: 'setId is required'
      }, { status: 400 })
    }

    console.log(`Starting cards sync for set ${setId} via API...`)
    
    const result = await dataSyncService.syncCardsFromSet(setId, {
      batchSize,
      onProgress: (progress: { current: number; total: number }) => {
        console.log(`Cards sync progress for set ${setId}: ${progress.current}/${progress.total}`)
      }
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Cards sync for set ${setId} completed successfully`,
        errors: result.errors
      })
    } else {
      return NextResponse.json({
        success: false,
        message: `Cards sync for set ${setId} completed with errors`,
        errors: result.errors
      }, { status: 207 }) // 207 Multi-Status
    }

  } catch (error) {
    console.error('Error in cards sync API:', error)
    return NextResponse.json({
      success: false,
      message: 'Internal server error during cards sync',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { setIds, batchSize = 50 } = body

    if (!setIds || !Array.isArray(setIds)) {
      return NextResponse.json({
        success: false,
        message: 'setIds array is required'
      }, { status: 400 })
    }

    console.log(`Starting cards sync for ${setIds.length} sets via API...`)
    
    const results = []
    
    for (const setId of setIds) {
      console.log(`Syncing cards for set: ${setId}`)
      
      const result = await dataSyncService.syncCardsFromSet(setId, {
        batchSize,
        onProgress: (progress: { current: number; total: number }) => {
          console.log(`Cards sync progress for set ${setId}: ${progress.current}/${progress.total}`)
        }
      })
      
      results.push({
        setId,
        success: result.success,
        errors: result.errors
      })
    }

    const allSuccessful = results.every(r => r.success)
    const totalErrors = results.reduce((acc, r) => acc + r.errors.length, 0)

    return NextResponse.json({
      success: allSuccessful,
      message: allSuccessful 
        ? `Cards sync completed successfully for all ${setIds.length} sets`
        : `Cards sync completed with ${totalErrors} total errors across ${setIds.length} sets`,
      results
    }, { status: allSuccessful ? 200 : 207 })

  } catch (error) {
    console.error('Error in bulk cards sync API:', error)
    return NextResponse.json({
      success: false,
      message: 'Internal server error during bulk cards sync',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}