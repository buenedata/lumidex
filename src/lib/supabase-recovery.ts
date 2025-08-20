import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a fresh Supabase client instance
export function createFreshSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  })
}

// Test if a Supabase client is working
export async function testSupabaseConnection(client: any, timeoutMs = 2000): Promise<boolean> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
    )

    const testPromise = client.from('cards').select('id').limit(1).single()
    
    await Promise.race([testPromise, timeoutPromise])
    return true
  } catch (error) {
    console.warn('Supabase connection test failed:', error)
    return false
  }
}

// Smooth connection recovery without page refresh
export async function recoverSupabaseConnection(currentClient: any): Promise<any> {
  console.log('Attempting smooth Supabase connection recovery...')
  
  try {
    // 1. Test current connection
    const isCurrentWorking = await testSupabaseConnection(currentClient, 1500)
    if (isCurrentWorking) {
      console.log('Current connection is working, no recovery needed')
      return currentClient
    }

    // 2. Create fresh client
    console.log('Creating fresh Supabase client...')
    const freshClient = createFreshSupabaseClient()
    
    // 3. Test fresh client
    const isFreshWorking = await testSupabaseConnection(freshClient, 3000)
    if (!isFreshWorking) {
      throw new Error('Fresh client also failed connection test')
    }

    // 4. Transfer auth session if available
    const { data: { session } } = await currentClient.auth.getSession()
    if (session) {
      await freshClient.auth.setSession(session)
    }

    console.log('Supabase connection successfully recovered with fresh client')
    return freshClient
  } catch (error) {
    console.error('Failed to recover Supabase connection:', error)
    throw error
  }
}