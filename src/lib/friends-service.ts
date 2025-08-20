import { supabase } from './supabase'
import { Profile } from '@/types'

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'blocked'
  created_at: string
  updated_at: string
  requester?: Profile
  addressee?: Profile
}

export interface FriendRequest {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending'
  created_at: string
  requester: Profile
}

export interface Friend {
  id: string
  user_id: string
  friend_id: string
  friendship_id: string
  status: 'accepted'
  created_at: string
  friend: Profile
}

class FriendsService {
  /**
   * Send a friend request to another user
   */
  async sendFriendRequest(
    requesterId: string,
    addresseeId: string
  ): Promise<{ success: boolean; error?: string; data?: Friendship }> {
    try {
      // Check if users are the same
      if (requesterId === addresseeId) {
        return { success: false, error: 'Cannot send friend request to yourself' }
      }

      // Check if friendship already exists
      const { data: existingFriendship, error: checkError } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        return { success: false, error: checkError.message }
      }

      if (existingFriendship) {
        if (existingFriendship.status === 'pending') {
          return { success: false, error: 'Friend request already sent' }
        } else if (existingFriendship.status === 'accepted') {
          return { success: false, error: 'Already friends' }
        } else if (existingFriendship.status === 'blocked') {
          return { success: false, error: 'Cannot send friend request' }
        }
      }

      // Create new friend request
      const { data, error } = await supabase
        .from('friendships')
        .insert({
          requester_id: requesterId,
          addressee_id: addresseeId,
          status: 'pending'
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(
    friendshipId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string; data?: Friendship }> {
    try {
      // Verify the user is the addressee of this request
      const { data: friendship, error: fetchError } = await supabase
        .from('friendships')
        .select('*')
        .eq('id', friendshipId)
        .eq('addressee_id', userId)
        .eq('status', 'pending')
        .single()

      if (fetchError) {
        return { success: false, error: 'Friend request not found' }
      }

      // Update status to accepted
      const { data, error } = await supabase
        .from('friendships')
        .update({ 
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', friendshipId)
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Decline a friend request
   */
  async declineFriendRequest(
    friendshipId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify the user is the addressee of this request
      const { data: friendship, error: fetchError } = await supabase
        .from('friendships')
        .select('*')
        .eq('id', friendshipId)
        .eq('addressee_id', userId)
        .eq('status', 'pending')
        .single()

      if (fetchError) {
        return { success: false, error: 'Friend request not found' }
      }

      // Delete the friend request
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Remove a friend (unfriend)
   */
  async removeFriend(
    friendshipId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify the user is part of this friendship
      const { data: friendship, error: fetchError } = await supabase
        .from('friendships')
        .select('*')
        .eq('id', friendshipId)
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq('status', 'accepted')
        .single()

      if (fetchError) {
        return { success: false, error: 'Friendship not found' }
      }

      // Delete the friendship
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get user's friends list
   */
  async getFriends(
    userId: string,
    options: {
      page?: number
      limit?: number
      search?: string
    } = {}
  ): Promise<{ success: boolean; error?: string; data?: Friend[]; total?: number }> {
    try {
      const { page = 1, limit = 20, search } = options

      // First get friendships
      let query = supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, created_at', { count: 'exact' })
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

      // Apply pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)

      const { data: friendships, error, count } = await query

      if (error) {
        return { success: false, error: error.message }
      }

      if (!friendships || friendships.length === 0) {
        return { success: true, data: [], total: 0 }
      }

      // Get friend IDs
      const friendIds = friendships.map(f =>
        f.requester_id === userId ? f.addressee_id : f.requester_id
      )

      // Get friend profiles
      let profileQuery = supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', friendIds)

      // Apply search filter to profiles
      if (search) {
        profileQuery = profileQuery.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`)
      }

      const { data: profiles, error: profileError } = await profileQuery

      if (profileError) {
        return { success: false, error: profileError.message }
      }

      // Combine data
      const friends: Friend[] = friendships
        .map(friendship => {
          const friendId = friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id
          const friendProfile = profiles?.find(p => p.id === friendId)
          
          if (!friendProfile) return null

          return {
            id: friendship.id,
            user_id: userId,
            friend_id: friendId,
            friendship_id: friendship.id,
            status: 'accepted' as const,
            created_at: friendship.created_at,
            friend: friendProfile as Profile
          }
        })
        .filter(Boolean) as Friend[]

      return { success: true, data: friends, total: count || 0 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get pending friend requests (received)
   */
  async getPendingRequests(
    userId: string
  ): Promise<{ success: boolean; error?: string; data?: FriendRequest[] }> {
    try {
      // Get pending friendships where user is addressee
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, created_at')
        .eq('addressee_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) {
        return { success: false, error: error.message }
      }

      if (!friendships || friendships.length === 0) {
        return { success: true, data: [] }
      }

      // Get requester profiles
      const requesterIds = friendships.map(f => f.requester_id)
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', requesterIds)

      if (profileError) {
        return { success: false, error: profileError.message }
      }

      // Combine data
      const requests: FriendRequest[] = friendships
        .map(friendship => {
          const requesterProfile = profiles?.find(p => p.id === friendship.requester_id)
          if (!requesterProfile) return null

          return {
            id: friendship.id,
            requester_id: friendship.requester_id,
            addressee_id: friendship.addressee_id,
            status: 'pending' as const,
            created_at: friendship.created_at,
            requester: requesterProfile as Profile
          }
        })
        .filter(Boolean) as FriendRequest[]

      return { success: true, data: requests }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get sent friend requests (pending)
   */
  async getSentRequests(
    userId: string
  ): Promise<{ success: boolean; error?: string; data?: FriendRequest[] }> {
    try {
      // Get pending friendships where user is requester
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, created_at')
        .eq('requester_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) {
        return { success: false, error: error.message }
      }

      if (!friendships || friendships.length === 0) {
        return { success: true, data: [] }
      }

      // Get addressee profiles
      const addresseeIds = friendships.map(f => f.addressee_id)
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', addresseeIds)

      if (profileError) {
        return { success: false, error: profileError.message }
      }

      // Combine data
      const requests: FriendRequest[] = friendships
        .map(friendship => {
          const addresseeProfile = profiles?.find(p => p.id === friendship.addressee_id)
          if (!addresseeProfile) return null

          return {
            id: friendship.id,
            requester_id: friendship.requester_id,
            addressee_id: friendship.addressee_id,
            status: 'pending' as const,
            created_at: friendship.created_at,
            requester: addresseeProfile as Profile // In sent requests, show the addressee as the "target"
          }
        })
        .filter(Boolean) as FriendRequest[]

      return { success: true, data: requests }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Search for users to add as friends
   */
  async searchUsers(
    currentUserId: string,
    searchTerm: string,
    options: {
      page?: number
      limit?: number
    } = {}
  ): Promise<{ success: boolean; error?: string; data?: Profile[]; total?: number }> {
    try {
      const { page = 1, limit = 20 } = options

      if (!searchTerm || searchTerm.length < 2) {
        return { success: true, data: [], total: 0 }
      }

      let query = supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url', { count: 'exact' })
        .neq('id', currentUserId) // Exclude current user
        .or(`username.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)

      // Apply pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as Profile[] || [], total: count || 0 }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Check friendship status between two users
   */
  async getFriendshipStatus(
    userId: string,
    otherUserId: string
  ): Promise<{ 
    success: boolean; 
    error?: string; 
    status?: 'none' | 'pending_sent' | 'pending_received' | 'friends' | 'blocked' 
  }> {
    try {
      const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(requester_id.eq.${userId},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${userId})`)
        .single()

      if (error && error.code !== 'PGRST116') {
        return { success: false, error: error.message }
      }

      if (!data) {
        return { success: true, status: 'none' }
      }

      if (data.status === 'accepted') {
        return { success: true, status: 'friends' }
      } else if (data.status === 'blocked') {
        return { success: true, status: 'blocked' }
      } else if (data.status === 'pending') {
        if (data.requester_id === userId) {
          return { success: true, status: 'pending_sent' }
        } else {
          return { success: true, status: 'pending_received' }
        }
      }

      return { success: true, status: 'none' }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
}

export const friendsService = new FriendsService()
export default friendsService