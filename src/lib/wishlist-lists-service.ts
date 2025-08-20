import { supabase } from './supabase'

export interface WishlistList {
  id: string
  user_id: string
  name: string
  description: string | null
  is_default: boolean
  is_public: boolean
  created_at: string
  updated_at: string
  item_count?: number
}

export interface CreateWishlistListData {
  name: string
  description?: string
  is_public?: boolean
}

export interface UpdateWishlistListData {
  name?: string
  description?: string
  is_public?: boolean
}

class WishlistListsService {
  /**
   * Get all wishlist lists for a user
   */
  async getUserWishlistLists(
    userId: string,
    includeItemCount: boolean = true
  ): Promise<{ success: boolean; error?: string; data?: WishlistList[] }> {
    try {
      let query = supabase
        .from('wishlist_lists')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })

      const { data: lists, error } = await query

      if (error) {
        return { success: false, error: error.message }
      }

      if (!lists) {
        return { success: true, data: [] }
      }

      // Get item counts if requested
      if (includeItemCount) {
        const listsWithCounts = await Promise.all(
          lists.map(async (list) => {
            const { count } = await supabase
              .from('wishlists')
              .select('*', { count: 'exact', head: true })
              .eq('wishlist_list_id', list.id)

            return {
              ...list,
              item_count: count || 0
            }
          })
        )

        return { success: true, data: listsWithCounts }
      }

      return { success: true, data: lists }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get a specific wishlist list
   */
  async getWishlistList(
    userId: string,
    listId: string
  ): Promise<{ success: boolean; error?: string; data?: WishlistList }> {
    try {
      const { data, error } = await supabase
        .from('wishlist_lists')
        .select('*')
        .eq('id', listId)
        .eq('user_id', userId)
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as WishlistList }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get the default wishlist list for a user
   */
  async getDefaultWishlistList(
    userId: string
  ): Promise<{ success: boolean; error?: string; data?: WishlistList }> {
    try {
      const { data, error } = await supabase
        .from('wishlist_lists')
        .select('*')
        .eq('user_id', userId)
        .eq('is_default', true)
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as WishlistList }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Create a new wishlist list
   */
  async createWishlistList(
    userId: string,
    listData: CreateWishlistListData
  ): Promise<{ success: boolean; error?: string; data?: WishlistList }> {
    try {
      // Check if name already exists for this user
      const { data: existingList, error: checkError } = await supabase
        .from('wishlist_lists')
        .select('id')
        .eq('user_id', userId)
        .eq('name', listData.name)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        return { success: false, error: checkError.message }
      }

      if (existingList) {
        return { success: false, error: 'A wishlist with this name already exists' }
      }

      const { data, error } = await supabase
        .from('wishlist_lists')
        .insert({
          user_id: userId,
          name: listData.name,
          description: listData.description || null,
          is_public: listData.is_public || false,
          is_default: false // Only one default list per user, created automatically
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as WishlistList }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Update a wishlist list
   */
  async updateWishlistList(
    userId: string,
    listId: string,
    updates: UpdateWishlistListData
  ): Promise<{ success: boolean; error?: string; data?: WishlistList }> {
    try {
      // Verify ownership
      const { data: existingList, error: fetchError } = await supabase
        .from('wishlist_lists')
        .select('*')
        .eq('id', listId)
        .eq('user_id', userId)
        .single()

      if (fetchError) {
        return { success: false, error: 'Wishlist not found' }
      }

      // For default lists, only allow name and description updates, not is_public or is_default changes
      if (existingList.is_default) {
        const allowedUpdates: UpdateWishlistListData = {}
        if (updates.name !== undefined) allowedUpdates.name = updates.name
        if (updates.description !== undefined) allowedUpdates.description = updates.description
        updates = allowedUpdates
      }

      // Check if new name conflicts (if name is being updated)
      if (updates.name && updates.name !== existingList.name) {
        const { data: conflictList, error: conflictError } = await supabase
          .from('wishlist_lists')
          .select('id')
          .eq('user_id', userId)
          .eq('name', updates.name)
          .single()

        if (conflictError && conflictError.code !== 'PGRST116') {
          return { success: false, error: conflictError.message }
        }

        if (conflictList) {
          return { success: false, error: 'A wishlist with this name already exists' }
        }
      }

      const { data, error } = await supabase
        .from('wishlist_lists')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', listId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as WishlistList }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Delete a wishlist list (cannot delete default list)
   */
  async deleteWishlistList(
    userId: string,
    listId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify ownership and that it's not the default list
      const { data: existingList, error: fetchError } = await supabase
        .from('wishlist_lists')
        .select('*')
        .eq('id', listId)
        .eq('user_id', userId)
        .single()

      if (fetchError) {
        return { success: false, error: 'Wishlist not found' }
      }

      if (existingList.is_default) {
        return { success: false, error: 'Cannot delete the default wishlist' }
      }

      // Delete the list (this will cascade delete all wishlist items in it)
      const { error } = await supabase
        .from('wishlist_lists')
        .delete()
        .eq('id', listId)
        .eq('user_id', userId)

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
   * Get public wishlist lists (for sharing/browsing)
   */
  async getPublicWishlistLists(
    limit: number = 20,
    offset: number = 0
  ): Promise<{ success: boolean; error?: string; data?: (WishlistList & { profile: { username: string; display_name: string | null } })[] }> {
    try {
      const { data, error } = await supabase
        .from('wishlist_lists')
        .select(`
          *,
          profiles!inner(username, display_name)
        `)
        .eq('is_public', true)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data as any }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Add a card to a specific wishlist list
   */
  async addCardToWishlistList(
    listId: string,
    cardId: string,
    options?: {
      priority?: 1 | 2 | 3 | 4 | 5;
      maxPriceEur?: number;
      conditionPreference?: 'any' | 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played';
      notes?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the list to verify it exists and get the user_id
      const { data: list, error: listError } = await supabase
        .from('wishlist_lists')
        .select('user_id')
        .eq('id', listId)
        .single()

      if (listError) {
        return { success: false, error: 'Wishlist not found' }
      }

      // Check if card is already in this wishlist list
      const { data: existingItem, error: checkError } = await supabase
        .from('wishlists')
        .select('id')
        .eq('wishlist_list_id', listId)
        .eq('card_id', cardId)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        return { success: false, error: checkError.message }
      }

      if (existingItem) {
        return { success: false, error: 'Card is already in this wishlist' }
      }

      // Add the card to the wishlist
      const { error: insertError } = await supabase
        .from('wishlists')
        .insert({
          user_id: list.user_id,
          wishlist_list_id: listId,
          card_id: cardId,
          priority: options?.priority || 3,
          max_price_eur: options?.maxPriceEur || null,
          condition_preference: options?.conditionPreference || 'any',
          notes: options?.notes || null
        })

      if (insertError) {
        return { success: false, error: insertError.message }
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
   * Add multiple cards to a specific wishlist list
   */
  async addCardsToWishlistList(
    listId: string,
    cardIds: string[],
    options?: {
      priority?: 1 | 2 | 3 | 4 | 5;
      maxPriceEur?: number;
      conditionPreference?: 'any' | 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played';
      notes?: string;
    }
  ): Promise<{ success: boolean; error?: string; addedCount?: number; skippedCount?: number }> {
    try {
      if (cardIds.length === 0) {
        return { success: true, addedCount: 0, skippedCount: 0 }
      }

      // Get the list to verify it exists and get the user_id
      const { data: list, error: listError } = await supabase
        .from('wishlist_lists')
        .select('user_id')
        .eq('id', listId)
        .single()

      if (listError) {
        return { success: false, error: 'Wishlist not found' }
      }

      // Check which cards are already in this wishlist list
      const { data: existingItems, error: checkError } = await supabase
        .from('wishlists')
        .select('card_id')
        .eq('wishlist_list_id', listId)
        .in('card_id', cardIds)

      if (checkError) {
        return { success: false, error: checkError.message }
      }

      // Filter out cards that are already in the wishlist
      const existingCardIds = new Set(existingItems?.map(item => item.card_id) || [])
      const newCardIds = cardIds.filter(cardId => !existingCardIds.has(cardId))

      if (newCardIds.length === 0) {
        return {
          success: true,
          addedCount: 0,
          skippedCount: cardIds.length,
          error: 'All cards are already in this wishlist'
        }
      }

      // Prepare bulk insert data
      const insertData = newCardIds.map(cardId => ({
        user_id: list.user_id,
        wishlist_list_id: listId,
        card_id: cardId,
        priority: options?.priority || 3,
        max_price_eur: options?.maxPriceEur || null,
        condition_preference: options?.conditionPreference || 'any',
        notes: options?.notes || null
      }))

      // Add the cards to the wishlist
      const { error: insertError } = await supabase
        .from('wishlists')
        .insert(insertData)

      if (insertError) {
        return { success: false, error: insertError.message }
      }

      return {
        success: true,
        addedCount: newCardIds.length,
        skippedCount: cardIds.length - newCardIds.length
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get wishlist items from a specific list
   */
  async getWishlistItemsFromList(
    listId: string,
    options?: {
      limit?: number;
      offset?: number;
      sortBy?: 'created_at' | 'priority' | 'name' | 'price';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<{ success: boolean; error?: string; data?: any[] }> {
    try {
      const { limit = 50, offset = 0, sortBy = 'created_at', sortOrder = 'desc' } = options || {}

      let query = supabase
        .from('wishlists')
        .select(`
          id,
          card_id,
          priority,
          max_price_eur,
          condition_preference,
          notes,
          created_at,
          updated_at,
          cards!inner(
            id,
            name,
            number,
            rarity,
            image_small,
            image_large,
            cardmarket_avg_sell_price,
            cardmarket_low_price,
            cardmarket_trend_price,
            set_id,
            sets!inner(
              id,
              name,
              release_date
            )
          )
        `)
        .eq('wishlist_list_id', listId)
        .range(offset, offset + limit - 1)

      // Apply sorting
      if (sortBy === 'created_at') {
        query = query.order('created_at', { ascending: sortOrder === 'asc' })
      } else if (sortBy === 'priority') {
        query = query.order('priority', { ascending: sortOrder === 'asc' })
      } else if (sortBy === 'name') {
        query = query.order('cards.name', { ascending: sortOrder === 'asc' })
      } else if (sortBy === 'price') {
        query = query.order('cards.cardmarket_avg_sell_price', { ascending: sortOrder === 'asc' })
      }

      const { data, error } = await query

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: data || [] }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Duplicate a wishlist list
   */
  async duplicateWishlistList(
    userId: string,
    sourceListId: string,
    newName: string
  ): Promise<{ success: boolean; error?: string; data?: WishlistList }> {
    try {
      // Get the source list
      const { data: sourceList, error: sourceError } = await supabase
        .from('wishlist_lists')
        .select('*')
        .eq('id', sourceListId)
        .single()

      if (sourceError) {
        return { success: false, error: 'Source wishlist not found' }
      }

      // Check if the user can access this list (either owns it or it's public)
      if (sourceList.user_id !== userId && !sourceList.is_public) {
        return { success: false, error: 'You do not have permission to duplicate this wishlist' }
      }

      // Create the new list
      const createResult = await this.createWishlistList(userId, {
        name: newName,
        description: `Copied from "${sourceList.name}"`,
        is_public: false
      })

      if (!createResult.success || !createResult.data) {
        return createResult
      }

      // Get all items from the source list
      const { data: sourceItems, error: itemsError } = await supabase
        .from('wishlists')
        .select('*')
        .eq('wishlist_list_id', sourceListId)

      if (itemsError) {
        return { success: false, error: itemsError.message }
      }

      // Copy items to the new list
      if (sourceItems && sourceItems.length > 0) {
        const newItems = sourceItems.map(item => ({
          user_id: userId,
          wishlist_list_id: createResult.data!.id,
          card_id: item.card_id,
          priority: item.priority,
          max_price_eur: item.max_price_eur,
          condition_preference: item.condition_preference,
          notes: item.notes
        }))

        const { error: insertError } = await supabase
          .from('wishlists')
          .insert(newItems)

        if (insertError) {
          // If copying items fails, delete the created list
          await this.deleteWishlistList(userId, createResult.data!.id)
          return { success: false, error: 'Failed to copy wishlist items' }
        }
      }

      return { success: true, data: createResult.data }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

export const wishlistListsService = new WishlistListsService()
export default wishlistListsService