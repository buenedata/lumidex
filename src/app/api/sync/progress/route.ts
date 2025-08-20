import { NextRequest, NextResponse } from 'next/server'

// In-memory progress storage (in production, use Redis or database)
const progressStore = new Map<string, {
  operation: string
  current: number
  total: number
  percentage: number
  currentSet?: string
  estimatedTimeRemaining?: number
  startTime: number
}>()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const operation = searchParams.get('operation')
    
    if (!operation) {
      return NextResponse.json({
        success: false,
        message: 'Operation parameter is required'
      }, { status: 400 })
    }

    const progressData = progressStore.get(operation)
    
    if (!progressData) {
      return NextResponse.json({
        success: false,
        message: 'No progress data found for this operation'
      }, { status: 404 })
    }

    // Calculate estimated time remaining
    const elapsed = Date.now() - progressData.startTime
    const rate = progressData.current / elapsed // items per ms
    const remaining = progressData.total - progressData.current
    const estimatedTimeRemaining = rate > 0 ? remaining / rate : 0

    const responseData = {
      ...progressData,
      estimatedTimeRemaining: Math.max(0, estimatedTimeRemaining)
    }

    return NextResponse.json({
      success: true,
      data: responseData
    })

  } catch (error) {
    console.error('Error getting progress:', error)
    return NextResponse.json({
      success: false,
      message: 'Error getting progress',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { operation, current, total, currentSet } = body
    
    if (!operation || current === undefined || total === undefined) {
      return NextResponse.json({
        success: false,
        message: 'Operation, current, and total are required'
      }, { status: 400 })
    }

    const percentage = total > 0 ? (current / total) * 100 : 0
    
    const existingProgress = progressStore.get(operation)
    const startTime = existingProgress?.startTime || Date.now()
    
    progressStore.set(operation, {
      operation,
      current,
      total,
      percentage,
      currentSet,
      startTime
    })

    // Clean up completed operations after 5 minutes
    if (percentage >= 100) {
      setTimeout(() => {
        progressStore.delete(operation)
      }, 5 * 60 * 1000)
    }

    return NextResponse.json({
      success: true,
      message: 'Progress updated'
    })

  } catch (error) {
    console.error('Error updating progress:', error)
    return NextResponse.json({
      success: false,
      message: 'Error updating progress',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const operation = searchParams.get('operation')
    
    if (!operation) {
      return NextResponse.json({
        success: false,
        message: 'Operation parameter is required'
      }, { status: 400 })
    }

    progressStore.delete(operation)

    return NextResponse.json({
      success: true,
      message: 'Progress cleared'
    })

  } catch (error) {
    console.error('Error clearing progress:', error)
    return NextResponse.json({
      success: false,
      message: 'Error clearing progress',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}