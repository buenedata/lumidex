// Testing utilities and helpers for Lumidex development

/**
 * Test data factory for creating mock data
 */
export class TestDataFactory {
  private static instance: TestDataFactory

  static getInstance(): TestDataFactory {
    if (!TestDataFactory.instance) {
      TestDataFactory.instance = new TestDataFactory()
    }
    return TestDataFactory.instance
  }

  /**
   * Create mock user data
   */
  createUser(overrides: Partial<any> = {}): any {
    return {
      id: this.generateId(),
      email: `user${Date.now()}@example.com`,
      username: `user${Date.now()}`,
      full_name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides
    }
  }

  /**
   * Create mock card data
   */
  createCard(overrides: Partial<any> = {}): any {
    const cardNumber = Math.floor(Math.random() * 200) + 1
    return {
      id: this.generateId(),
      name: `Test Card ${cardNumber}`,
      set_name: 'Test Set',
      card_number: cardNumber.toString(),
      rarity: 'Common',
      type: 'Pokémon',
      subtype: 'Basic',
      hp: 60,
      stage: null,
      retreat_cost: 1,
      weakness_type: 'Fire',
      resistance_type: null,
      image_url: 'https://example.com/card.jpg',
      market_price: 1.99,
      tcgplayer_id: this.generateId(),
      ...overrides
    }
  }

  /**
   * Create mock collection item
   */
  createCollectionItem(overrides: Partial<any> = {}): any {
    return {
      id: this.generateId(),
      user_id: this.generateId(),
      card_id: this.generateId(),
      condition: 'Near Mint',
      quantity: 1,
      acquisition_price: 2.50,
      acquisition_date: new Date().toISOString(),
      notes: 'Test collection item',
      is_for_trade: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides
    }
  }

  /**
   * Create mock wishlist item
   */
  createWishlistItem(overrides: Partial<any> = {}): any {
    return {
      id: this.generateId(),
      user_id: this.generateId(),
      card_id: this.generateId(),
      priority: 'Medium',
      max_price: 10.00,
      notes: 'Test wishlist item',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides
    }
  }

  /**
   * Create mock trade data
   */
  createTrade(overrides: Partial<any> = {}): any {
    return {
      id: this.generateId(),
      initiator_id: this.generateId(),
      recipient_id: this.generateId(),
      status: 'pending',
      message: 'Test trade proposal',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      ...overrides
    }
  }

  /**
   * Create multiple items of any type
   */
  createMany<T>(factory: () => T, count: number): T[] {
    return Array.from({ length: count }, () => factory())
  }

  /**
   * Generate a random ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15)
  }
}

/**
 * Mock repository factory for testing
 */
export const createMockRepository = <T>(
  initialData: T[] = [],
  config: MockRepositoryConfig = {}
) => {
  const { shouldFail = false, delay = 0, failureRate = 0 } = config
  const data = [...initialData]

  return {
    async findAll(): Promise<T[]> {
      await this.simulateDelay()
      if (this.shouldFail()) {
        throw new Error('Mock repository failure')
      }
      return [...data]
    },

    async findById(id: string): Promise<T | null> {
      await this.simulateDelay()
      if (this.shouldFail()) {
        throw new Error('Mock repository failure')
      }
      return data.find((item: any) => item.id === id) || null
    },

    async create(item: Omit<T, 'id'>): Promise<T> {
      await this.simulateDelay()
      if (this.shouldFail()) {
        throw new Error('Mock repository failure')
      }
      const newItem = {
        ...item,
        id: Math.random().toString(36).substring(2, 15)
      } as T
      data.push(newItem)
      return newItem
    },

    async update(id: string, updates: Partial<T>): Promise<T | null> {
      await this.simulateDelay()
      if (this.shouldFail()) {
        throw new Error('Mock repository failure')
      }
      const index = data.findIndex((item: any) => item.id === id)
      if (index === -1) return null
      
      data[index] = { ...data[index], ...updates }
      return data[index]
    },

    async delete(id: string): Promise<boolean> {
      await this.simulateDelay()
      if (this.shouldFail()) {
        throw new Error('Mock repository failure')
      }
      const index = data.findIndex((item: any) => item.id === id)
      if (index === -1) return false
      
      data.splice(index, 1)
      return true
    },

    // Utility methods for testing
    getData: () => [...data],
    setData: (newData: T[]) => {
      data.length = 0
      data.push(...newData)
    },
    clear: () => data.length = 0,

    // Internal methods
    simulateDelay: () => new Promise(resolve => setTimeout(resolve, delay)),
    shouldFail: () => shouldFail || Math.random() < failureRate
  }
}

interface MockRepositoryConfig {
  shouldFail?: boolean
  delay?: number
  failureRate?: number
}

/**
 * Test environment setup utilities
 */
export const setupTestEnvironment = (config: TestEnvironmentConfig = {}) => {
  const {
    clearLocalStorage = true,
    mockConsole = false,
    mockFetch = false
  } = config

  const cleanup: (() => void)[] = []

  // Clear localStorage
  if (clearLocalStorage && typeof window !== 'undefined') {
    const originalLocalStorage = { ...localStorage }
    localStorage.clear()
    cleanup.push(() => {
      localStorage.clear()
      Object.keys(originalLocalStorage).forEach(key => {
        localStorage.setItem(key, originalLocalStorage[key])
      })
    })
  }

  // Mock console methods
  if (mockConsole) {
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error
    }
    
    console.log = jest.fn ? jest.fn() : () => {}
    console.warn = jest.fn ? jest.fn() : () => {}
    console.error = jest.fn ? jest.fn() : () => {}

    cleanup.push(() => {
      console.log = originalConsole.log
      console.warn = originalConsole.warn
      console.error = originalConsole.error
    })
  }

  // Mock fetch
  if (mockFetch && typeof global !== 'undefined') {
    const mockFetchFn = jest.fn ? jest.fn() : () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('')
    })

    const originalFetch = global.fetch
    global.fetch = mockFetchFn as any

    cleanup.push(() => {
      global.fetch = originalFetch
    })
  }

  return {
    cleanup: () => cleanup.forEach(fn => fn())
  }
}

interface TestEnvironmentConfig {
  clearLocalStorage?: boolean
  mockConsole?: boolean
  mockFetch?: boolean
}

/**
 * Test utilities for async operations
 */
export const TestUtils = {
  /**
   * Wait for a condition to be true
   */
  waitFor: async (
    condition: () => boolean | Promise<boolean>,
    timeout = 5000,
    interval = 50
  ): Promise<void> => {
    const start = Date.now()
    
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return
      }
      await new Promise(resolve => setTimeout(resolve, interval))
    }
    
    throw new Error(`Condition not met within ${timeout}ms`)
  },

  /**
   * Wait for a specific time
   */
  wait: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  /**
   * Run code in next tick
   */
  nextTick: (): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, 0))
  },

  /**
   * Flush all pending promises
   */
  flushPromises: async (): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 0))
  },

  /**
   * Create a deferred promise
   */
  createDeferred: <T>() => {
    let resolve: (value: T) => void
    let reject: (error: Error) => void
    
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })

    return {
      promise,
      resolve: resolve!,
      reject: reject!
    }
  },

  /**
   * Measure execution time
   */
  measureTime: async <T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> => {
    const start = performance.now()
    const result = await fn()
    const duration = performance.now() - start
    
    return { result, duration }
  }
}

/**
 * Mock Supabase client for testing
 */
export const createMockSupabaseClient = () => {
  const createQueryBuilder = () => {
    const queryBuilder = {
      select: jest.fn ? jest.fn().mockReturnThis() : function(this: any) { return this },
      insert: jest.fn ? jest.fn().mockReturnThis() : function(this: any) { return this },
      update: jest.fn ? jest.fn().mockReturnThis() : function(this: any) { return this },
      delete: jest.fn ? jest.fn().mockReturnThis() : function(this: any) { return this },
      eq: jest.fn ? jest.fn().mockReturnThis() : function(this: any) { return this },
      neq: jest.fn ? jest.fn().mockReturnThis() : function(this: any) { return this },
      gt: jest.fn ? jest.fn().mockReturnThis() : function(this: any) { return this },
      lt: jest.fn ? jest.fn().mockReturnThis() : function(this: any) { return this },
      gte: jest.fn ? jest.fn().mockReturnThis() : function(this: any) { return this },
      lte: jest.fn ? jest.fn().mockReturnThis() : function(this: any) { return this },
      like: jest.fn ? jest.fn().mockReturnThis() : function(this: any) { return this },
      ilike: jest.fn ? jest.fn().mockReturnThis() : function(this: any) { return this },
      in: jest.fn ? jest.fn().mockReturnThis() : function(this: any) { return this },
      order: jest.fn ? jest.fn().mockReturnThis() : function(this: any) { return this },
      limit: jest.fn ? jest.fn().mockReturnThis() : function(this: any) { return this },
      single: jest.fn ? jest.fn().mockResolvedValue({ data: null, error: null }) : () => Promise.resolve({ data: null, error: null }),
      then: jest.fn ? jest.fn().mockResolvedValue({ data: [], error: null }) : () => Promise.resolve({ data: [], error: null })
    }
    return queryBuilder
  }

  const mockClient = {
    from: (table: string) => createQueryBuilder(),
    
    auth: {
      getUser: jest.fn ? jest.fn().mockResolvedValue({ data: { user: null }, error: null }) : () => Promise.resolve({ data: { user: null }, error: null }),
      signIn: jest.fn ? jest.fn().mockResolvedValue({ data: null, error: null }) : () => Promise.resolve({ data: null, error: null }),
      signOut: jest.fn ? jest.fn().mockResolvedValue({ error: null }) : () => Promise.resolve({ error: null }),
      onAuthStateChange: jest.fn ? jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } }) : () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },

    storage: {
      from: (bucket: string) => ({
        upload: jest.fn ? jest.fn().mockResolvedValue({ data: null, error: null }) : () => Promise.resolve({ data: null, error: null }),
        download: jest.fn ? jest.fn().mockResolvedValue({ data: null, error: null }) : () => Promise.resolve({ data: null, error: null }),
        remove: jest.fn ? jest.fn().mockResolvedValue({ data: null, error: null }) : () => Promise.resolve({ data: null, error: null }),
        list: jest.fn ? jest.fn().mockResolvedValue({ data: [], error: null }) : () => Promise.resolve({ data: [], error: null })
      })
    }
  }

  return mockClient
}

/**
 * Test assertion helpers
 */
export const TestAssert = {
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  isValidUrl: (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  },

  isValidUuid: (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  },

  hasRequiredProps: (obj: any, props: string[]): boolean => {
    return props.every(prop => prop in obj && obj[prop] !== undefined && obj[prop] !== null)
  },

  isWithinRange: (value: number, min: number, max: number): boolean => {
    return value >= min && value <= max
  },

  arrayContainsAll: <T>(array: T[], items: T[]): boolean => {
    return items.every(item => array.includes(item))
  }
}