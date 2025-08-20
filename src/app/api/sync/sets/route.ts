import { NextRequest, NextResponse } from 'next/server'
import { dataSyncService } from '@/lib/data-sync'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { batchSize = 50 } = body

    console.log('Starting sets sync via API...')
    
    const result = await dataSyncService.syncSets({
      batchSize,
      onProgress: (progress) => {
        console.log(`Sets sync progress: ${progress.current}/${progress.total}`)
      }
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Sets sync completed successfully',
        errors: result.errors
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Sets sync completed with errors',
        errors: result.errors
      }, { status: 207 }) // 207 Multi-Status
    }

  } catch (error) {
    console.error('Error in sets sync API:', error)
    return NextResponse.json({
      success: false,
      message: 'Internal server error during sets sync',
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