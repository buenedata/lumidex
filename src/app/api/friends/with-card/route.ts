import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { friendsService } from '@/lib/friends-service'

export async function POST(request: NextRequest) {
  try {
    const { userId, cardId } = await request.json()

    if (!userId || !cardId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId or cardId' },
        { status: 400 }
      )
    }

    // Use server client to get user's friends directly (bypass RLS)
    const serverClient = createServerClient()
    
    // Get friendships where user is involved and status is accepted
    const { data: friendships, error: friendshipsError } = await serverClient
      .from('friendships')
      .select('id, requester_id, addressee_id, created_at')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    
    console.log('🔍 DEBUG API: Friendships query', {
      friendships,
      friendshipsCount: friendships?.length || 0,
      error: friendshipsError?.message
    })
    
    if (friendshipsError) {
      return NextResponse.json({
        success: false,
        error: friendshipsError.message
      })
    }

    if (!friendships || friendships.length === 0) {
      console.log('🔍 DEBUG API: No friendships found')
      return NextResponse.json({ success: true, data: [] })
    }

    // Get friend IDs (the other user in each friendship)
    const friendIds = friendships.map(f =>
      f.requester_id === userId ? f.addressee_id : f.requester_id
    )
    console.log('🔍 DEBUG API: Friend IDs', friendIds)
    
    // Get friend profiles
    const { data: profiles, error: profilesError } = await serverClient
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', friendIds)
    
    console.log('🔍 DEBUG API: Profiles query', {
      profiles,
      profilesCount: profiles?.length || 0,
      error: profilesError?.message
    })
    
    if (profilesError) {
      return NextResponse.json({
        success: false,
        error: profilesError.message
      })
    }
    
    // Create friends array with profile data
    const friends = friendships.map(friendship => {
      const friendId = friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id
      const friendProfile = profiles?.find(p => p.id === friendId)
      
      return {
        id: friendship.id,
        user_id: userId,
        friend_id: friendId,
        friendship_id: friendship.id,
        status: 'accepted' as const,
        created_at: friendship.created_at,
        friend: friendProfile
      }
    }).filter(f => f.friend) // Only include friends with valid profiles
    
    console.log('🔍 DEBUG API: Combined friends data', {
      friends: friends.map(f => ({ id: f.friend_id, username: f.friend?.username })),
      friendsCount: friends.length
    })

    // Use server client to bypass RLS for checking friends' collections
    console.log('🔍 DEBUG API: Querying collections', { cardId, friendIds })
    
    const { data: collections, error } = await serverClient
      .from('user_collections')
      .select('user_id, quantity, condition, is_foil, variant')
      .eq('card_id', cardId)
      .in('user_id', friendIds)

    console.log('🔍 DEBUG API: Collections query result', {
      collections,
      collectionsCount: collections?.length || 0,
      error: error?.message
    })

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      })
    }

    // Process the results
    const friendsWithCard = friends.map(friend => {
      const friendCollections = collections?.filter(c => c.user_id === friend.friend_id) || []
      
      console.log('🔍 DEBUG API: Processing friend', {
        friendId: friend.friend_id,
        friendUsername: friend.friend?.username,
        friendCollections: friendCollections.length,
        collectionsData: friendCollections
      })
      
      const variants = {
        normal: 0,
        holo: 0,
        reverse_holo: 0,
        pokeball_pattern: 0,
        masterball_pattern: 0
      }

      let totalQuantity = 0

      friendCollections.forEach(collection => {
        totalQuantity += collection.quantity
        
        console.log('🔍 DEBUG API: Processing collection', {
          quantity: collection.quantity,
          condition: collection.condition,
          is_foil: collection.is_foil,
          variant: collection.variant
        })
        
        // Use the variant column directly from the database
        const variantKey = collection.variant || 'normal'
        
        if (variants.hasOwnProperty(variantKey)) {
          variants[variantKey as keyof typeof variants] += collection.quantity
        }
      })

      const result = {
        friend_id: friend.friend_id,
        friend_username: friend.friend?.username || 'Unknown',
        friend_display_name: friend.friend?.display_name || friend.friend?.username || 'Unknown',
        friend_avatar_url: friend.friend?.avatar_url || null,
        owns_card: totalQuantity > 0,
        total_quantity: totalQuantity,
        variants
      }
      
      console.log('🔍 DEBUG API: Friend result', result)
      
      return result
    })

    console.log('🔍 DEBUG API: Final result', { friendsWithCard })
    return NextResponse.json({ success: true, data: friendsWithCard })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}