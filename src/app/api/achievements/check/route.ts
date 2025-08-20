import { NextRequest, NextResponse } from 'next/server'
import { achievementService } from '@/lib/achievement-service'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    console.log(`🔧 Manual achievement check for user: ${userId}`)
    
    // Get detailed user stats for debugging
    const statsResult = await (achievementService as any).getUserStats(userId)
    console.log('📊 User stats:', statsResult)
    
    // Get current achievements
    const currentAchievements = await achievementService.getUserAchievements(userId)
    console.log('🏆 Current achievements:', currentAchievements)
    
    // Check achievements for the user
    const result = await achievementService.checkAchievements(userId)
    console.log('✅ Achievement check result:', result)
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error, debug: { stats: statsResult, currentAchievements } },
        { status: 500 }
      )
    }

    // Get updated achievement progress
    const progressResult = await achievementService.getAchievementProgress(userId)
    
    return NextResponse.json({
      success: true,
      newAchievements: result.newAchievements || [],
      revokedAchievements: result.revokedAchievements || [],
      progress: progressResult.success ? progressResult.data : null,
      debug: {
        userStats: statsResult,
        currentAchievements: currentAchievements,
        checkResult: result
      }
    })
    
  } catch (error) {
    console.error('Error in achievement check API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}