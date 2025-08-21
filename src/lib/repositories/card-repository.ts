import { AbstractRepository, FindManyParams, RepositoryError } from '@/lib/core/repository'
import type {
  PokemonCard,
  PokemonSet,
  CardFilters,
  CardListItem,
  CardDetails,
  CardSortField,
  CardRarity,
  PokemonType
} from '@/types/domains/card'
import type { ApiResponse, PaginatedResponse } from '@/types'
import { createClient } from '@supabase/supabase-js'

/**
 * Extended card filters for repository queries
 */
export interface ExtendedCardFilters extends CardFilters {
  name?: string
  minHp?: number
  maxHp?: number
  sortBy?: CardSortField
  sortDirection?: 'asc' | 'desc'
  limit?: number
}

/**
 * Input type for creating new cards (admin only)
 */
export interface CreateCardInput {
  name: string
  set_id: string
  number: string
  rarity: string
  artist?: string
  flavor_text?: string
  hp?: number
  types?: string[]
  stage?: string
  evolves_from?: string
  attacks?: any[]
  abilities?: any[]
  weaknesses?: any[]
  resistances?: any[]
  retreat_cost?: number
  converted_retreat_cost?: number
  image_small?: string
  image_large?: string
  cardmarket_id?: string
  cardmarket_url?: string
  cardmarket_avg_sell_price?: number
  cardmarket_low_price?: number
  cardmarket_trend_price?: number
  cardmarket_reverse_holo_sell?: number
  cardmarket_reverse_holo_low?: number
  cardmarket_reverse_holo_trend?: number
  last_price_update?: string
}

/**
 * Input type for updating cards
 */
export interface UpdateCardInput {
  name?: string
  artist?: string
  flavor_text?: string
  hp?: number
  types?: string[]
  stage?: string
  evolves_from?: string
  attacks?: any[]
  abilities?: any[]
  weaknesses?: any[]
  resistances?: any[]
  retreat_cost?: number
  converted_retreat_cost?: number
  image_small?: string
  image_large?: string
  cardmarket_id?: string
  cardmarket_url?: string
  cardmarket_avg_sell_price?: number
  cardmarket_low_price?: number
  cardmarket_trend_price?: number
  cardmarket_reverse_holo_sell?: number
  cardmarket_reverse_holo_low?: number
  cardmarket_reverse_holo_trend?: number
  last_price_update?: string
}

/**
 * Card Repository - handles all Pokemon card data access
 * 
 * Manages cards table operations with proper error handling,
 * optimized queries, and search functionality.
 */
export class CardRepository extends AbstractRepository<PokemonCard, CreateCardInput, UpdateCardInput> {
  constructor(supabase: ReturnType<typeof createClient>) {
    super('cards', supabase)
  }

  /**
   * Find card by ID with set information
   */
  async findById(id: string): Promise<ApiResponse<PokemonCard>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(`
          *,
          sets!inner(
            id,
            name,
            symbol_url,
            logo_url,
            release_date,
            total_cards
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          throw RepositoryError.notFound('Card', id)
        }
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(data)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Find multiple cards with filters and pagination
   */
  async findMany(params?: FindManyParams): Promise<ApiResponse<PaginatedResponse<PokemonCard>>> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select(`
          *,
          sets!inner(
            id,
            name,
            symbol_url,
            logo_url,
            release_date
          )
        `, { count: 'exact' })

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
   * Create new card (admin only)
   */
  async create(data: CreateCardInput): Promise<ApiResponse<PokemonCard>> {
    try {
      this.validateRequired(data, ['name', 'set_id', 'number', 'rarity'])

      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .insert({
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(result)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Update card
   */
  async update(id: string, data: UpdateCardInput): Promise<ApiResponse<PokemonCard>> {
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
          throw RepositoryError.notFound('Card', id)
        }
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(result)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Delete card (admin only)
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
   * Find multiple cards by IDs
   */
  async findByIds(ids: string[]): Promise<ApiResponse<PokemonCard[]>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(`
          *,
          sets!inner(
            id,
            name,
            symbol_url
          )
        `)
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
   * Create multiple cards (bulk import)
   */
  async createMany(data: CreateCardInput[]): Promise<ApiResponse<PokemonCard[]>> {
    try {
      data.forEach(item => {
        this.validateRequired(item, ['name', 'set_id', 'number', 'rarity'])
      })

      const now = new Date().toISOString()
      const cardsWithTimestamps = data.map(item => ({
        ...item,
        created_at: now,
        updated_at: now
      }))

      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .insert(cardsWithTimestamps)
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
   * Update multiple cards
   */
  async updateMany(updates: Array<{ id: string; data: UpdateCardInput }>): Promise<ApiResponse<PokemonCard[]>> {
    try {
      const results: PokemonCard[] = []
      
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
   * Delete multiple cards
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
   * Search cards by name with fuzzy matching
   */
  async searchByName(query: string, limit: number = 20): Promise<ApiResponse<CardListItem[]>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select(`
          id,
          name,
          number,
          rarity,
          image_small,
          image_large,
          cardmarket_avg_sell_price,
          sets!inner(
            id,
            name,
            symbol_url
          )
        `)
        .ilike('name', `%${query}%`)
        .order('name')
        .limit(limit)

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(data || [])
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Get cards by set with pagination
   */
  async findBySet(
    setId: string, 
    page: number = 1, 
    pageSize: number = 50
  ): Promise<ApiResponse<PaginatedResponse<PokemonCard>>> {
    try {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const { data, error, count } = await this.supabase
        .from(this.tableName)
        .select(`
          *,
          sets!inner(
            id,
            name,
            symbol_url
          )
        `, { count: 'exact' })
        .eq('set_id', setId)
        .order('number')
        .range(from, to)

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse({
        data: data || [],
        pagination: {
          page,
          pageSize,
          totalCount: count || 0,
          totalPages: Math.ceil((count || 0) / pageSize)
        }
      })
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Get cards with advanced filters
   */
  async findWithFilters(filters: ExtendedCardFilters): Promise<ApiResponse<CardListItem[]>> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select(`
          id,
          name,
          number,
          rarity,
          image_small,
          image_large,
          cardmarket_avg_sell_price,
          hp,
          types,
          sets!inner(
            id,
            name,
            symbol_url
          )
        `)

      // Apply filters
      if (filters.setId) {
        query = query.eq('set_id', filters.setId)
      }
      if (filters.rarity && filters.rarity.length > 0) {
        query = query.in('rarity', filters.rarity)
      }
      if (filters.types && filters.types.length > 0) {
        query = query.overlaps('types', filters.types)
      }
      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`)
      }
      if (filters.name) {
        query = query.ilike('name', `%${filters.name}%`)
      }
      if (filters.minHp !== undefined) {
        query = query.gte('hp', filters.minHp)
      }
      if (filters.maxHp !== undefined) {
        query = query.lte('hp', filters.maxHp)
      }
      if (filters.minPrice !== undefined) {
        query = query.gte('cardmarket->>avg_sell_price', filters.minPrice)
      }
      if (filters.maxPrice !== undefined) {
        query = query.lte('cardmarket->>avg_sell_price', filters.maxPrice)
      }

      // Apply sorting
      if (filters.sortBy) {
        const ascending = filters.sortDirection === 'asc'
        query = query.order(filters.sortBy, { ascending })
      } else {
        query = query.order('name')
      }

      // Apply limit
      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      const { data, error } = await query

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(data || [])
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Get random cards for featured/discovery
   */
  async getRandomCards(limit: number = 10): Promise<ApiResponse<CardListItem[]>> {
    try {
      // Note: This is a simplified random selection
      // For better performance with large datasets, consider using a seeded approach
      const { data, error } = await this.supabase
        .rpc('get_random_cards', { card_limit: limit })

      if (error) {
        // Fallback to regular query if RPC doesn't exist
        const fallbackResult = await this.supabase
          .from(this.tableName)
          .select(`
            id,
            name,
            number,
            rarity,
            image_small,
            image_large,
            cardmarket_avg_sell_price,
            sets!inner(
              id,
              name,
              symbol_url
            )
          `)
          .limit(limit)

        if (fallbackResult.error) {
          throw RepositoryError.databaseError(fallbackResult.error)
        }

        return this.createSuccessResponse(fallbackResult.data || [])
      }

      return this.createSuccessResponse(data || [])
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Update card pricing information
   */
  async updatePricing(
    id: string, 
    pricing: {
      cardmarket_avg_sell_price?: number
      cardmarket_low_price?: number
      cardmarket_trend_price?: number
      cardmarket_reverse_holo_sell?: number
      cardmarket_reverse_holo_low?: number
      cardmarket_reverse_holo_trend?: number
    }
  ): Promise<ApiResponse<PokemonCard>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .update({
          ...pricing,
          last_price_update: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          throw RepositoryError.notFound('Card', id)
        }
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(data)
    } catch (error: any) {
      return this.handleError(error)
    }
  }

  /**
   * Get cards that need price updates
   */
  async getCardsNeedingPriceUpdate(
    daysOld: number = 7,
    limit: number = 100
  ): Promise<ApiResponse<PokemonCard[]>> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysOld)

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .or(`last_price_update.is.null,last_price_update.lt.${cutoffDate.toISOString()}`)
        .not('cardmarket_id', 'is', null)
        .limit(limit)

      if (error) {
        throw RepositoryError.databaseError(error)
      }

      return this.createSuccessResponse(data || [])
    } catch (error: any) {
      return this.handleError(error)
    }
  }
}