import { AbstractRepository, FindManyParams, RepositoryError } from '@/lib/core/repository'
import type { 
  UserCollectionEntry,
  CollectionFilters,
  CollectionQuery 
} from '@/types/domains/collection'
import type { PokemonCard } from '@/types/domains/card'
import type { ApiResponse, PaginatedResponse } from '@/types'
import { createClient } from '@supabase/supabase-js'

/**
 * Input type for creating new collection entries
 */
export interface CreateCollectionEntryInput {
  user_id: string
  card_id: string
  quantity: number
  condition: string
  variant: string
  is_foil?: boolean
  acquired_date?: string
  notes?: string
}

/**
 * Input type for updating collection entries
 */
export interface UpdateCollectionEntryInput {
  quantity?: number
  condition?: string
  variant?: string
  is_foil?: boolean
  acquired_date?: string
  notes?: string
}

/**
 * Extended collection entry with card details
 */
export interface UserCollectionWithCard extends UserCollectionEntry {
  card: PokemonCard & {
    sets: {
      name: string
      symbol_url: string
    }
  }
}

/**
 * Collection Repository - handles all user collection data access
 * 
 * Manages user_collections table operations with proper error handling,
 * optimized queries, and relationship loading.
 */
export class CollectionRepository extends AbstractRepository<UserCollectionEntry, CreateCollectionEntryInput, UpdateCollectionEntryInput> {
  constructor(supabase: ReturnType<typeof createClient>) {
    super('user_collections', supabase)
  }

  /**
   * Find collection entry by ID
   */
  async findById(id: string): Promise<ApiResponse<UserCollectionEntry>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          throw RepositoryError.notFound('Collection entry', id)
        }
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(data)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Find multiple collection entries with filters and pagination
   */
  async findMany(params?: FindManyParams): Promise<ApiResponse<PaginatedResponse<UserCollectionEntry>>> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact' })

      query = this.buildQuery(query, params)

      const { data, error, count } = await query

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse({
        data: data || [],
        pagination: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 50,
          totalCount: count || 0,
          totalPages: Math.ceil((count || 0) / (params?.pageSize || 50))
        }
      })
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Create new collection entry
   */
  async create(data: CreateCollectionEntryInput): Promise<ApiResponse<UserCollectionEntry>> {
    try {
      console.log('🟣 CollectionRepository: create called', data);

      this.validateRequired(data, ['user_id', 'card_id', 'quantity', 'condition', 'variant'])

      const insertData = {
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('🟣 CollectionRepository: inserting data', insertData);

      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .insert(insertData)
        .select()
        .single()

      console.log('🟣 CollectionRepository: create query result', {
        result,
        error,
        errorCode: error?.code
      });

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      const response = this.createSuccessResponse(result);
      console.log('🟣 CollectionRepository: create response', response);
      return response;
    } catch (error: any) {
      console.log('🟣 CollectionRepository: create error', error);
      return this.handleError(error)
    }
  }

  /**
   * Update collection entry
   */
  async update(id: string, data: UpdateCollectionEntryInput): Promise<ApiResponse<UserCollectionEntry>> {
    try {
      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          throw RepositoryError.notFound('Collection entry', id)
        }
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(result)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Delete collection entry
   */
  async delete(id: string): Promise<ApiResponse<boolean>> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('id', id)

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(true)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Find multiple entries by IDs
   */
  async findByIds(ids: string[]): Promise<ApiResponse<UserCollectionEntry[]>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .in('id', ids)

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(data || [])
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Create multiple collection entries
   */
  async createMany(data: CreateCollectionEntryInput[]): Promise<ApiResponse<UserCollectionEntry[]>> {
    try {
      data.forEach(item => {
        this.validateRequired(item, ['user_id', 'card_id', 'quantity', 'condition', 'variant'])
      })

      const now = new Date().toISOString()
      const entriesWithTimestamps = data.map(item => ({
        ...item,
        created_at: now,
        updated_at: now
      }))

      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .insert(entriesWithTimestamps)
        .select()

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(result || [])
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Update multiple collection entries
   */
  async updateMany(updates: Array<{ id: string; data: UpdateCollectionEntryInput }>): Promise<ApiResponse<UserCollectionEntry[]>> {
    try {
      const results: UserCollectionEntry[] = []
      
      for (const update of updates) {
        const result = await this.update(update.id, update.data)
        if (result.success && result.data) {
          results.push(result.data)
        }
      }

      return this.createSuccessResponse(results)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Delete multiple collection entries
   */
  async deleteMany(ids: string[]): Promise<ApiResponse<number>> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .in('id', ids)

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(ids.length)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Get user's collection with card details and pagination
   */
  async getUserCollection(
    userId: string,
    page: number = 1,
    limit: number = 24,
    filters: CollectionFilters = {}
  ): Promise<ApiResponse<{ data: UserCollectionWithCard[]; total: number }>> {
    try {
      const { setId, rarity, condition, variant } = filters

      let query = this.supabase
        .from(this.tableName)
        .select(`
          *,
          cards!inner(
            id,
            name,
            set_id,
            number,
            rarity,
            image_small,
            image_large,
            cardmarket_avg_sell_price,
            cardmarket_trend_price,
            sets!inner(name, symbol_url)
          )
        `, { count: 'exact' })
        .eq('user_id', userId)

      // Apply filters
      if (setId) {
        query = query.eq('cards.set_id', setId)
      }
      if (rarity) {
        query = query.eq('cards.rarity', rarity)
      }
      if (condition) {
        query = query.eq('condition', condition)
      }
      if (variant) {
        query = query.eq('variant', variant)
      }

      // Apply pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse({ 
        data: (data as UserCollectionWithCard[]) || [], 
        total: count || 0 
      })
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Find user collection item by card and variant
   */
  async findByCardAndVariant(
    userId: string,
    cardId: string,
    condition: string = 'near_mint',
    variant: string = 'normal'
  ): Promise<ApiResponse<UserCollectionEntry | null>> {
    try {
      console.log('🟣 CollectionRepository: findByCardAndVariant called', {
        userId,
        cardId,
        condition,
        variant
      });

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .eq('card_id', cardId)
        .eq('condition', condition)
        .eq('variant', variant)
        .single()

      console.log('🟣 CollectionRepository: findByCardAndVariant query result', {
        data,
        error,
        errorCode: error?.code
      });

      if (error && error.code !== 'PGRST116') {
        throw RepositoryError.databaseError(error)
      }

      const response = this.createSuccessResponse(data || null);
      console.log('🟣 CollectionRepository: findByCardAndVariant response', response);
      return response;
    } catch (error: any) {
      console.log('🟣 CollectionRepository: findByCardAndVariant error', error);
      return this.handleError(error)
    }
  }

  /**
   * Check if user owns a specific card
   */
  async checkOwnership(userId: string, cardId: string): Promise<ApiResponse<{ owned: boolean; quantity: number }>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('quantity')
        .eq('user_id', userId)
        .eq('card_id', cardId)

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      const totalQuantity = data?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0

      return this.createSuccessResponse({ 
        owned: totalQuantity > 0, 
        quantity: totalQuantity 
      })
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Get collection for statistics calculation
   */
  async getCollectionForStats(userId: string): Promise<ApiResponse<UserCollectionWithCard[]>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(`
          *,
          cards!inner(
            id,
            name,
            set_id,
            number,
            rarity,
            image_small,
            image_large,
            cardmarket_avg_sell_price,
            cardmarket_low_price,
            cardmarket_trend_price,
            cardmarket_reverse_holo_sell,
            cardmarket_reverse_holo_low,
            cardmarket_reverse_holo_trend,
            sets!inner(name, symbol_url)
          )
        `)
        .eq('user_id', userId)

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse((data as UserCollectionWithCard[]) || [])
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Get recent additions to collection
   */
  async getRecentAdditions(userId: string, limit: number = 10): Promise<ApiResponse<UserCollectionWithCard[]>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(`
          *,
          cards!inner(
            id,
            name,
            set_id,
            number,
            rarity,
            image_small,
            image_large,
            cardmarket_avg_sell_price,
            cardmarket_trend_price,
            sets!inner(name, symbol_url)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse((data as UserCollectionWithCard[]) || [])
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Get collection by set
   */
  async getCollectionBySet(userId: string, setId: string): Promise<ApiResponse<UserCollectionWithCard[]>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(`
          *,
          cards!inner(
            id,
            name,
            set_id,
            number,
            rarity,
            image_small,
            image_large,
            cardmarket_avg_sell_price,
            sets!inner(name, symbol_url)
          )
        `)
        .eq('user_id', userId)
        .eq('cards.set_id', setId)

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse((data as UserCollectionWithCard[]) || [])
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Delete all collection items for a user
   */
  async clearUserCollection(userId: string): Promise<ApiResponse<number>> {
    try {
      // First get count
      const { data: countData, error: countError } = await this.supabase
        .from(this.tableName)
        .select('id', { count: 'exact' })
        .eq('user_id', userId)

      if (countError) {
        throw RepositoryError.databaseError(countError)
      }

      const deletedCount = countData?.length || 0

      // Delete all
      const { error: deleteError } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('user_id', userId)

      if (deleteError) {
        throw RepositoryError.databaseError(deleteError)
      }

      return this.createSuccessResponse(deletedCount)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Get unique card IDs for a user (for comparisons)
   */
  async getUserCardIds(userId: string): Promise<ApiResponse<string[]>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('cards!inner(id)')
        .eq('user_id', userId)

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      const cardIds = data?.map((item: any) => {
        const card = Array.isArray(item.cards) ? item.cards[0] : item.cards
        return card?.id
      }).filter(Boolean) as string[] || []

      return this.createSuccessResponse(cardIds)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Update collection item quantity
   */
  async updateQuantity(id: string, quantity: number): Promise<ApiResponse<UserCollectionEntry>> {
    try {
      console.log('🟣 CollectionRepository: updateQuantity called', {
        id,
        quantity
      });

      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      console.log('🟣 CollectionRepository: updateQuantity query result', {
        data,
        error,
        errorCode: error?.code
      });

      if (error) {
        if (error.code === 'PGRST116') {
          throw RepositoryError.notFound('Collection entry', id)
        }
        throw RepositoryError.databaseError(error)
      }

      const response = this.createSuccessResponse(data);
      console.log('🟣 CollectionRepository: updateQuantity response', response);
      return response;
    } catch (error: any) {
      console.log('🟣 CollectionRepository: updateQuantity error', error);
      return this.handleError(error)
    }
  }
}