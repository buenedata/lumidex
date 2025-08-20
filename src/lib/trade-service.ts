import { supabase } from './supabase'
import type { NotificationData } from '@/contexts/NavigationContext'

export interface TradeNotification {
  id: string
  type: 'trade_request' | 'trade_accepted' | 'trade_declined' | 'trade_cancelled' | 'trade_completed' | 'trade_counter_offer'
  trade_id: string
  from_user_id: string
  to_user_id: string
  message?: string
  created_at: string
  read: boolean
}

class TradeService {
  /**
   * Get pending trade requests for a user
   */
  async getPendingTradeRequests(userId: string) {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select(`
          id,
          initiator_id,
          recipient_id,
          status,
          created_at,
          initiator:profiles!trades_initiator_id_fkey (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('recipient_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error

      return {
        success: true,
        data: data || []
      }
    } catch (error) {
      console.error('Error fetching pending trade requests:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Convert trade data to notification format
   */
  convertTradesToNotifications(trades: any[]): NotificationData[] {
    return trades.map(trade => ({
      id: `trade_${trade.id}`,
      type: 'trade_request' as const,
      title: 'New Trade Request',
      message: `${trade.initiator.display_name || trade.initiator.username} wants to trade with you`,
      from_user: {
        id: trade.initiator_id,
        username: trade.initiator.username,
        display_name: trade.initiator.display_name,
        avatar_url: trade.initiator.avatar_url
      },
      created_at: trade.created_at,
      read: false,
      data: {
        trade_id: trade.id,
        trade_status: trade.status
      }
    }))
  }

  /**
   * Get all notifications for a user (trades + other types)
   */
  async getAllNotifications(userId: string): Promise<NotificationData[]> {
    try {
      // Get pending trade requests
      const tradeResult = await this.getPendingTradeRequests(userId)
      
      let notifications: NotificationData[] = []
      
      if (tradeResult.success && tradeResult.data) {
        const tradeNotifications = this.convertTradesToNotifications(tradeResult.data)
        notifications = [...notifications, ...tradeNotifications]
      }

      // Sort by created_at descending (newest first)
      notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      return notifications
    } catch (error) {
      console.error('Error fetching all notifications:', error)
      return []
    }
  }

  /**
   * Mark a trade notification as read
   */
  async markTradeNotificationRead(tradeId: string) {
    // For now, we'll handle this in memory since we don't have a notifications table
    // In a production app, you'd want to store notification read status in the database
    return { success: true }
  }

  /**
   * Get trade notification count
   */
  async getNotificationCount(userId: string): Promise<number> {
    try {
      const notifications = await this.getAllNotifications(userId)
      return notifications.filter(n => !n.read).length
    } catch (error) {
      console.error('Error getting notification count:', error)
      return 0
    }
  }

  /**
   * Send notification for trade status change
   */
  async sendTradeNotification(
    tradeId: string,
    fromUserId: string,
    toUserId: string,
    type: TradeNotification['type'],
    message: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Create a notification record in the database
      // Since we don't have a notifications table, we'll use a simple approach
      // by creating a temporary notification that will be picked up by the notification system
      
      // For now, we'll trigger a real-time notification by updating the trade
      // and letting the notification system pick it up through the existing mechanism
      
      // In a production app, you'd want a dedicated notifications table
      console.log(`Sending ${type} notification from ${fromUserId} to ${toUserId} for trade ${tradeId}: ${message}`)
      
      // Since we don't have a notifications table, we'll rely on the existing
      // notification system that checks trade status changes
      return { success: true }
    } catch (error) {
      console.error('Error sending trade notification:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Send trade accepted notification
   */
  async sendTradeAcceptedNotification(tradeId: string, fromUserId: string, toUserId: string, fromUserName: string) {
    return this.sendTradeNotification(
      tradeId,
      fromUserId,
      toUserId,
      'trade_accepted',
      `${fromUserName} has accepted your trade offer.`
    )
  }

  /**
   * Send trade declined notification
   */
  async sendTradeDeclinedNotification(tradeId: string, fromUserId: string, toUserId: string, fromUserName: string) {
    return this.sendTradeNotification(
      tradeId,
      fromUserId,
      toUserId,
      'trade_declined',
      `${fromUserName} has declined your trade offer.`
    )
  }

  /**
   * Send trade cancelled notification
   */
  async sendTradeCancelledNotification(tradeId: string, fromUserId: string, toUserId: string, fromUserName: string) {
    return this.sendTradeNotification(
      tradeId,
      fromUserId,
      toUserId,
      'trade_cancelled',
      `${fromUserName} has cancelled their trade offer.`
    )
  }

  /**
   * Send trade completed notification
   */
  async sendTradeCompletedNotification(tradeId: string, fromUserId: string, toUserId: string, fromUserName: string) {
    return this.sendTradeNotification(
      tradeId,
      fromUserId,
      toUserId,
      'trade_completed',
      `${fromUserName} has marked your trade as completed.`
    )
  }

  /**
   * Send counter offer notification
   */
  async sendCounterOfferNotification(tradeId: string, fromUserId: string, toUserId: string, fromUserName: string) {
    return this.sendTradeNotification(
      tradeId,
      fromUserId,
      toUserId,
      'trade_counter_offer',
      `${fromUserName} has sent you a counter offer.`
    )
  }
}

export const tradeService = new TradeService()