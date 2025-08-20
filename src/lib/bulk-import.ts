import { dataSyncService } from './data-sync'

interface BulkImportOptions {
  maxSets?: number
  cardsPerSet?: number
  batchSize?: number
  onProgress?: (progress: BulkImportProgress) => void
  onSetComplete?: (setId: string, cardsImported: number) => void
}

interface BulkImportProgress {
  stage: 'sets' | 'cards' | 'pricing' | 'complete'
  currentSet?: string
  setProgress: {
    current: number
    total: number
  }
  cardProgress: {
    current: number
    total: number
  }
  overallProgress: {
    current: number
    total: number
  }
  errors: string[]
  startTime: Date
  estimatedTimeRemaining?: number
}

interface BulkImportResult {
  success: boolean
  setsImported: number
  cardsImported: number
  errors: string[]
  duration: number
}

class BulkImportService {
  private isRunning = false
  private shouldStop = false

  async importPopularSets(options: BulkImportOptions = {}): Promise<BulkImportResult> {
    const {
      maxSets = 10,
      cardsPerSet = 50,
      batchSize = 20,
      onProgress,
      onSetComplete
    } = options

    if (this.isRunning) {
      throw new Error('Bulk import is already running')
    }

    this.isRunning = true
    this.shouldStop = false

    const startTime = new Date()
    const errors: string[] = []
    let setsImported = 0
    let cardsImported = 0

    try {
      console.log(`Starting bulk import of ${maxSets} popular sets...`)

      // Step 1: Ensure sets are synced
      const setsResult = await dataSyncService.syncSets({
        batchSize: 50,
        onProgress: (progress) => {
          onProgress?.({
            stage: 'sets',
            setProgress: { current: progress.current, total: progress.total },
            cardProgress: { current: 0, total: 0 },
            overallProgress: { current: progress.current, total: progress.total + (maxSets * cardsPerSet) },
            errors: progress.errors,
            startTime
          })
        }
      })

      if (!setsResult.success) {
        errors.push(...setsResult.errors)
      }

      // Step 2: Get popular sets to import
      const popularSets = await this.getPopularSets(maxSets)
      
      if (popularSets.length === 0) {
        throw new Error('No sets found to import')
      }

      console.log(`Found ${popularSets.length} popular sets to import`)

      // Step 3: Import cards for each set
      for (let i = 0; i < popularSets.length && !this.shouldStop; i++) {
        const set = popularSets[i]
        console.log(`Importing cards for set ${i + 1}/${popularSets.length}: ${set.name} (${set.id})`)

        try {
          const cardsResult = await dataSyncService.syncCardsFromSet(set.id, {
            batchSize,
            onProgress: (progress) => {
              const overallCardProgress = (i * cardsPerSet) + progress.current
              const totalCards = popularSets.length * cardsPerSet

              onProgress?.({
                stage: 'cards',
                currentSet: set.name,
                setProgress: { current: i + 1, total: popularSets.length },
                cardProgress: { current: progress.current, total: progress.total },
                overallProgress: { 
                  current: setsResult.success ? progress.total + overallCardProgress : overallCardProgress,
                  total: (setsResult.success ? 168 : 0) + totalCards
                },
                errors: [...errors, ...progress.errors],
                startTime,
                estimatedTimeRemaining: this.calculateETA(startTime, overallCardProgress, totalCards)
              })
            }
          })

          if (cardsResult.success) {
            setsImported++
            cardsImported += cardsResult.cardsProcessed
            onSetComplete?.(set.id, cardsResult.cardsProcessed)
          } else {
            errors.push(...cardsResult.errors)
          }

          // Delay between sets to respect rate limits
          if (i < popularSets.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000))
          }

        } catch (error) {
          const errorMsg = `Error importing set ${set.id}: ${error}`
          errors.push(errorMsg)
          console.error(errorMsg)
        }
      }

      // Step 4: Update pricing for imported cards
      if (cardsImported > 0 && !this.shouldStop) {
        console.log('Updating pricing for imported cards...')
        
        const pricingResult = await dataSyncService.updateCardPricing({
          batchSize: 30,
          onProgress: (progress) => {
            onProgress?.({
              stage: 'pricing',
              setProgress: { current: popularSets.length, total: popularSets.length },
              cardProgress: { current: progress.current, total: progress.total },
              overallProgress: { 
                current: 168 + cardsImported + progress.current,
                total: 168 + cardsImported + progress.total
              },
              errors: [...errors, ...progress.errors],
              startTime
            })
          }
        })

        if (!pricingResult.success) {
          errors.push(...pricingResult.errors)
        }
      }

      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      onProgress?.({
        stage: 'complete',
        setProgress: { current: popularSets.length, total: popularSets.length },
        cardProgress: { current: cardsImported, total: cardsImported },
        overallProgress: { current: 168 + cardsImported, total: 168 + cardsImported },
        errors,
        startTime
      })

      console.log(`Bulk import completed in ${Math.round(duration / 1000)}s. ${setsImported} sets, ${cardsImported} cards imported.`)

      return {
        success: errors.length === 0,
        setsImported,
        cardsImported,
        errors,
        duration
      }

    } catch (error) {
      const errorMsg = `Fatal error during bulk import: ${error}`
      errors.push(errorMsg)
      console.error(errorMsg)

      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      return {
        success: false,
        setsImported,
        cardsImported,
        errors,
        duration
      }
    } finally {
      this.isRunning = false
      this.shouldStop = false
    }
  }

  private async getPopularSets(maxSets: number): Promise<Array<{ id: string; name: string }>> {
    try {
      // Get popular/recent sets from our database
      const { data: sets, error } = await dataSyncService['supabase']
        .from('sets')
        .select('id, name, release_date, total_cards')
        .order('release_date', { ascending: false })
        .limit(maxSets * 2) // Get more than needed to filter

      if (error) {
        console.error('Error fetching sets:', error.message)
        return []
      }

      if (!sets || sets.length === 0) {
        return []
      }

      // Filter to sets with reasonable card counts and prioritize recent ones
      const popularSets = sets
        .filter(set => set.total_cards > 50 && set.total_cards < 300) // Reasonable set sizes
        .slice(0, maxSets)

      return popularSets.map(set => ({
        id: set.id,
        name: set.name
      }))

    } catch (error) {
      console.error('Error getting popular sets:', error)
      return []
    }
  }

  private calculateETA(startTime: Date, current: number, total: number): number {
    if (current === 0) return 0
    
    const elapsed = Date.now() - startTime.getTime()
    const rate = current / elapsed // items per ms
    const remaining = total - current
    
    return remaining / rate // ms remaining
  }

  stopImport() {
    this.shouldStop = true
  }

  isImportRunning(): boolean {
    return this.isRunning
  }
}

export const bulkImportService = new BulkImportService()
export default bulkImportService