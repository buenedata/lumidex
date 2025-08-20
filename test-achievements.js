// Test script to manually check achievement unlocking
//
// OPTION 1: Run in BROWSER CONSOLE (Recommended)
// 1. Open your Pokemon TCG app in browser (http://localhost:3000)
// 2. Open browser developer tools (F12)
// 3. Go to Console tab
// 4. Copy and paste the browserTest() function and run it
//
// OPTION 2: Run in NODE.JS (Command line)
// 1. Make sure your dev server is running (npm run dev)
// 2. Update the userId and baseUrl below
// 3. Run: node test-achievements.js

// For Node.js environment
const isNode = typeof window === 'undefined'

if (isNode) {
  // Node.js testing
  const fetch = require('node-fetch') // You may need: npm install node-fetch
  
  async function testAchievementsNode() {
    try {
      console.log('🔧 Testing achievement unlocking in Node.js...')
      
      // UPDATE THESE VALUES:
      const userId = 'your-user-id-here' // Replace with actual user ID
      const baseUrl = 'http://localhost:3000' // Your app URL
      
      if (userId === 'your-user-id-here') {
        console.error('❌ Please update the userId in the script!')
        return
      }
      
      // Call the achievement check API
      const response = await fetch(`${baseUrl}/api/achievements/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId })
      })
      
      const result = await response.json()
      
      console.log('📊 Achievement check result:', result)
      
      if (result.success) {
        console.log('✅ Achievement check completed successfully!')
        console.log('🏆 New achievements:', result.newAchievements?.length || 0)
        console.log('❌ Revoked achievements:', result.revokedAchievements?.length || 0)
        console.log('📈 Progress count:', result.progress?.length || 0)
        console.log('🔍 User stats:', result.debug?.userStats?.data)
      } else {
        console.error('❌ Achievement check failed:', result.error)
        console.log('🔍 Debug info:', result.debug)
      }
      
      return result
    } catch (error) {
      console.error('💥 Error testing achievements:', error)
      console.log('\n📝 Troubleshooting:')
      console.log('1. Make sure your dev server is running: npm run dev')
      console.log('2. Update the userId and baseUrl in this script')
      console.log('3. Ensure the database has been set up with the SQL scripts')
    }
  }
  
  // Run the Node.js test
  testAchievementsNode()
} else {
  // Browser testing function
  window.testAchievementsBrowser = async function() {
    try {
      console.log('🔧 Testing achievement unlocking in browser...')
      
      // Get current user ID from your auth system
      // Update this line to match how your app gets the current user
      const userId = 'your-user-id-here' // Replace with actual way to get user ID
      
      if (userId === 'your-user-id-here') {
        console.error('❌ Please update the userId in the script!')
        console.log('💡 Check your app\'s auth system to get the current user ID')
        return
      }
      
      // Call the achievement check API
      const response = await fetch('/api/achievements/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId })
      })
      
      const result = await response.json()
      
      console.log('📊 Achievement check result:', result)
      
      if (result.success) {
        console.log('✅ Achievement check completed successfully!')
        console.log('🏆 New achievements:', result.newAchievements)
        console.log('❌ Revoked achievements:', result.revokedAchievements)
        console.log('📈 Progress:', result.progress)
        console.log('🔍 Debug info:', result.debug)
      } else {
        console.error('❌ Achievement check failed:', result.error)
        console.log('🔍 Debug info:', result.debug)
      }
      
      return result
    } catch (error) {
      console.error('💥 Error testing achievements:', error)
    }
  }
  
  console.log('🎯 Browser testing ready! Run: testAchievementsBrowser()')
}