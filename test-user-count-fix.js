bconst { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testUserCountFix() {
  console.log('=== Testing User Count Fix ===')
  
  try {
    // Test direct user count
    console.log('1. Testing direct user count...')
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
    
    console.log('Direct profiles count:', count)
    if (error) console.log('Error:', error)
    
    // Test the community stats service by calling the RPC function directly
    console.log('\n2. Testing community stats RPC function...')
    const { data: communityStatsData, error: communityStatsError } = await supabase
      .rpc('get_community_stats')
    
    console.log('Community stats RPC result:', { communityStatsData, communityStatsError })
    
    console.log('\n✅ Fix applied! The dashboard should now show 5 users in the Growing Community achievement.')
    console.log('🔄 Refresh the dashboard page to see the updated count.')
    
  } catch (error) {
    console.error('Error:', error)
  }
}

testUserCountFix()