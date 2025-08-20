'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigation } from '@/contexts/NavigationContext'
import { friendsService } from '@/lib/friends-service'
import { tradeService } from '@/lib/trade-service'
import type { NotificationData } from '@/contexts/NavigationContext'

export function useNotifications() {
  const { user } = useAuth()
  const { dispatch } = useNavigation()

  useEffect(() => {
    if (!user) {
      dispatch({ type: 'SET_NOTIFICATIONS', payload: 0 })
      dispatch({ type: 'SET_NOTIFICATION_DATA', payload: [] })
      return
    }

    const fetchNotifications = async () => {
      try {
        let allNotifications: NotificationData[] = []

        // Get pending friend requests
        const friendRequestsResult = await friendsService.getPendingRequests(user.id)
        
        if (friendRequestsResult.success) {
          const pendingRequests = friendRequestsResult.data || []
          
          // Convert friend requests to notifications
          const friendNotifications: NotificationData[] = pendingRequests.map(request => ({
            id: `friend_${request.id}`,
            type: 'friend_request' as const,
            title: 'Friend Request',
            message: `${request.requester.display_name || request.requester.username} wants to be your friend`,
            from_user: {
              id: request.requester_id,
              username: request.requester.username,
              display_name: request.requester.display_name,
              avatar_url: request.requester.avatar_url
            },
            created_at: request.created_at,
            read: false,
            data: {
              friendship_id: request.id
            }
          }))

          allNotifications = [...allNotifications, ...friendNotifications]
        }

        // Get trade notifications
        const tradeNotifications = await tradeService.getAllNotifications(user.id)
        allNotifications = [...allNotifications, ...tradeNotifications]

        // Sort by created_at descending (newest first)
        allNotifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        // Update notification data and count
        dispatch({ type: 'SET_NOTIFICATION_DATA', payload: allNotifications })
        
      } catch (error) {
        console.error('Error fetching notifications:', error)
      }
    }

    // Fetch notifications immediately
    fetchNotifications()

    // Set up polling for real-time updates
    const interval = setInterval(fetchNotifications, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [user, dispatch])

  // Function to manually refresh notifications (useful after accepting/declining)
  const refreshNotifications = async () => {
    if (!user) return

    try {
      let allNotifications: NotificationData[] = []

      // Get pending friend requests
      const friendRequestsResult = await friendsService.getPendingRequests(user.id)
      
      if (friendRequestsResult.success) {
        const pendingRequests = friendRequestsResult.data || []
        
        // Convert friend requests to notifications
        const friendNotifications: NotificationData[] = pendingRequests.map(request => ({
          id: `friend_${request.id}`,
          type: 'friend_request' as const,
          title: 'Friend Request',
          message: `${request.requester.display_name || request.requester.username} wants to be your friend`,
          from_user: {
            id: request.requester_id,
            username: request.requester.username,
            display_name: request.requester.display_name,
            avatar_url: request.requester.avatar_url
          },
          created_at: request.created_at,
          read: false,
          data: {
            friendship_id: request.id
          }
        }))

        allNotifications = [...allNotifications, ...friendNotifications]
      }

      // Get trade notifications
      const tradeNotifications = await tradeService.getAllNotifications(user.id)
      allNotifications = [...allNotifications, ...tradeNotifications]

      // Sort by created_at descending (newest first)
      allNotifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      // Update notification data and count
      dispatch({ type: 'SET_NOTIFICATION_DATA', payload: allNotifications })
      
    } catch (error) {
      console.error('Error refreshing notifications:', error)
    }
  }

  return { refreshNotifications }
}