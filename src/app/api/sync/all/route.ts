import { NextRequest, NextResponse } from 'next/server'
import { dataSyncService } from '@/lib/data-sync'

// Global sync lock to prevent multiple sync operations
let globalSyncRunning = false

// Helper function to update progress
async function updateProgress(operationKey: string, current: number, total: number, currentSet?: string) {
  try {
    await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/sync/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: operationKey,
        current,
        total,
        currentSet
      })
    })
  } catch (error) {
    console.error('Error updating progress:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      batchSize = 50,
      setsOnly = false,
      maxSets = 10, // Limit for initial sync to avoid overwhelming
      operationKey = 'sync-all' // Key for progress tracking
    } = body

    console.log('Starting full data sync via API...')
    
    const results = {
      sets: { success: false, errors: [] as string[] },
      cards: { success: false, errors: [] as string[], totalCards: 0 },
      overall: { success: false, message: '', totalTime: 0 }
    }

    const startTime = Date.now()

    try {
      // Step 1: Sync sets
      console.log('Step 1: Syncing sets...')
      const setsResult = await dataSyncService.syncSets({
        batchSize,
        onProgress: (progress) => {
          console.log(`Sets sync progress: ${progress.current}/${progress.total}`)
        }
      })

      results.sets = setsResult

      if (!setsResult.success) {
        return NextResponse.json({
          success: false,
          message: 'Sets sync failed, aborting full sync',
          results
        }, { status: 500 })
      }

      // Step 2: Sync cards (if not sets-only)
      if (!setsOnly) {
        console.log('Step 2: Syncing cards...')
        
        // Get a limited number of sets for initial sync
        const { data: sets, error: setsError } = await dataSyncService['supabase']
          .from('sets')
          .select('id, name')
          .order('release_date', { ascending: false })
          .limit(maxSets)

        if (setsError) {
          results.cards.errors.push(`Error fetching sets for cards sync: ${setsError.message}`)
        } else if (sets && sets.length > 0) {
          console.log(`Syncing cards for ${sets.length} most recent sets...`)
          
          // Initialize progress
          await updateProgress(operationKey, 0, sets.length, 'Starting sync...')
          
          for (let i = 0; i < sets.length; i++) {
            const set = sets[i]
            console.log(`Syncing cards for set ${i + 1}/${sets.length}: ${set.name}`)
            
            // Update progress with current set
            await updateProgress(operationKey, i, sets.length, set.name)
            
            const cardsResult = await dataSyncService.syncCardsFromSet(set.id, {
              batchSize: Math.min(batchSize, 20), // Smaller batches for cards
              onProgress: (progress) => {
                console.log(`Cards sync progress for ${set.name}: ${progress.current}/${progress.total}`)
              }
            })

            results.cards.errors.push(...cardsResult.errors)
            results.cards.totalCards += cardsResult.cardsProcessed

            // Update progress after completing set
            await updateProgress(operationKey, i + 1, sets.length, `Completed: ${set.name}`)

            // Delay between sets to respect rate limits
            if (i < sets.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000))
            }
          }

          // Mark as complete
          await updateProgress(operationKey, sets.length, sets.length, 'Sync completed!')

          results.cards.success = results.cards.errors.length === 0
        }
      } else {
        results.cards.success = true // Skip cards sync
      }

      const endTime = Date.now()
      results.overall.totalTime = endTime - startTime

      const overallSuccess = results.sets.success && results.cards.success
      results.overall.success = overallSuccess
      results.overall.message = overallSuccess 
        ? `Full sync completed successfully in ${Math.round(results.overall.totalTime / 1000)}s`
        : `Full sync completed with errors in ${Math.round(results.overall.totalTime / 1000)}s`

      return NextResponse.json({
        success: overallSuccess,
        message: results.overall.message,
        results
      }, { status: overallSuccess ? 200 : 207 })

    } catch (error) {
      const endTime = Date.now()
      results.overall.totalTime = endTime - startTime
      results.overall.message = `Fatal error during full sync: ${error}`

      console.error('Fatal error during full sync:', error)
      return NextResponse.json({
        success: false,
        message: results.overall.message,
        results,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in full sync API:', error)
    return NextResponse.json({
      success: false,
      message: 'Internal server error during full sync',
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