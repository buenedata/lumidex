import { NextRequest, NextResponse } from 'next/server'
import { achievementService } from '@/lib/achievement-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({
        error: 'userId parameter is required',
        usage: 'GET /api/achievements/test?userId=your-user-id'
      }, { status: 400 })
    }

    console.log(`🔧 Testing achievements for user: ${userId}`)
    
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
      return NextResponse.json({
        success: false,
        error: result.error,
        debug: { 
          stats: statsResult, 
          currentAchievements,
          userId,
          timestamp: new Date().toISOString()
        }
      }, { status: 500 })
    }

    // Get updated achievement progress
    const progressResult = await achievementService.getAchievementProgress(userId)
    
    return NextResponse.json({
      success: true,
      message: `Achievement check completed for user ${userId}`,
      newAchievements: result.newAchievements || [],
      revokedAchievements: result.revokedAchievements || [],
      progress: progressResult.success ? progressResult.data : null,
      summary: {
        totalNewAchievements: result.newAchievements?.length || 0,
        totalRevokedAchievements: result.revokedAchievements?.length || 0,
        userCardCount: statsResult.data?.unique_cards || 0,
        userTotalCards: statsResult.data?.total_cards || 0,
        userCollectionValue: statsResult.data?.collection_value_eur || 0
      },
      debug: {
        userStats: statsResult,
        currentAchievements: currentAchievements,
        checkResult: result,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('Error in achievement test API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}