// Type checking utilities for runtime validation and API contract verification

/**
 * Runtime type checker for validating data structures
 */
export class TypeChecker {
  private static instance: TypeChecker

  static getInstance(): TypeChecker {
    if (!TypeChecker.instance) {
      TypeChecker.instance = new TypeChecker()
    }
    return TypeChecker.instance
  }

  /**
   * Validate object against schema
   */
  validate<T>(data: unknown, schema: TypeSchema): ValidationResult<T> {
    try {
      this.validateSchema(data, schema)
      return {
        success: true,
        data: data as T,
        errors: []
      }
    } catch (error) {
      return {
        success: false,
        data: null,
        errors: error instanceof ValidationError ? error.errors : [error instanceof Error ? error.message : String(error)]
      }
    }
  }

  private validateSchema(data: unknown, schema: TypeSchema): void {
    if (schema.type === 'string') {
      if (typeof data !== 'string') {
        throw new ValidationError([`Expected string, got ${typeof data}`])
      }
      if (schema.minLength && data.length < schema.minLength) {
        throw new ValidationError([`String too short: ${data.length} < ${schema.minLength}`])
      }
      if (schema.maxLength && data.length > schema.maxLength) {
        throw new ValidationError([`String too long: ${data.length} > ${schema.maxLength}`])
      }
    }

    if (schema.type === 'number') {
      if (typeof data !== 'number') {
        throw new ValidationError([`Expected number, got ${typeof data}`])
      }
      if (schema.min !== undefined && data < schema.min) {
        throw new ValidationError([`Number too small: ${data} < ${schema.min}`])
      }
      if (schema.max !== undefined && data > schema.max) {
        throw new ValidationError([`Number too large: ${data} > ${schema.max}`])
      }
    }

    if (schema.type === 'boolean') {
      if (typeof data !== 'boolean') {
        throw new ValidationError([`Expected boolean, got ${typeof data}`])
      }
    }

    if (schema.type === 'array') {
      if (!Array.isArray(data)) {
        throw new ValidationError([`Expected array, got ${typeof data}`])
      }
      if (schema.items) {
        data.forEach((item, index) => {
          try {
            this.validateSchema(item, schema.items!)
          } catch (error) {
            if (error instanceof ValidationError) {
              throw new ValidationError(
                error.errors.map(err => `Array[${index}]: ${err}`)
              )
            }
            throw error
          }
        })
      }
    }

    if (schema.type === 'object') {
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new ValidationError([`Expected object, got ${typeof data}`])
      }

      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          const value = (data as any)[key]
          
          if (propSchema.required && (value === undefined || value === null)) {
            throw new ValidationError([`Missing required property: ${key}`])
          }

          if (value !== undefined && value !== null) {
            try {
              this.validateSchema(value, propSchema)
            } catch (error) {
              if (error instanceof ValidationError) {
                throw new ValidationError(
                  error.errors.map(err => `Property '${key}': ${err}`)
                )
              }
              throw error
            }
          }
        }
      }
    }

    if (schema.type === 'union') {
      if (!schema.types) {
        throw new ValidationError(['Union schema missing types'])
      }

      const errors: string[] = []
      for (const unionType of schema.types) {
        try {
          this.validateSchema(data, unionType)
          return // If any type matches, validation passes
        } catch (error) {
          if (error instanceof ValidationError) {
            errors.push(...error.errors)
          } else {
            errors.push(error instanceof Error ? error.message : String(error))
          }
        }
      }
      throw new ValidationError([`No union type matched: ${errors.join(', ')}`])
    }
  }
}

/**
 * Type schema definition
 */
export interface TypeSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'union'
  required?: boolean
  
  // String constraints
  minLength?: number
  maxLength?: number
  pattern?: string
  
  // Number constraints
  min?: number
  max?: number
  
  // Array constraints
  items?: TypeSchema
  minItems?: number
  maxItems?: number
  
  // Object constraints
  properties?: Record<string, TypeSchema>
  
  // Union constraints
  types?: TypeSchema[]
}

/**
 * Validation result interface
 */
export interface ValidationResult<T> {
  success: boolean
  data: T | null
  errors: string[]
}

/**
 * Custom validation error
 */
export class ValidationError extends Error {
  constructor(public errors: string[]) {
    super(`Validation failed: ${errors.join(', ')}`)
    this.name = 'ValidationError'
  }
}

/**
 * API contract validation
 */
export const validateApiContract = <T>(
  data: unknown,
  contract: ApiContract<T>
): ValidationResult<T> => {
  const checker = TypeChecker.getInstance()
  return checker.validate<T>(data, contract.schema)
}

/**
 * API contract interface
 */
export interface ApiContract<T = any> {
  name: string
  version: string
  schema: TypeSchema
  examples?: T[]
}

/**
 * Predefined schemas for Lumidex types
 */
export const LumidexSchemas = {
  user: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, required: true },
      email: { type: 'string' as const, required: true },
      username: { type: 'string' as const, required: true },
      full_name: { type: 'string' as const },
      avatar_url: { type: 'string' as const },
      created_at: { type: 'string' as const, required: true },
      updated_at: { type: 'string' as const, required: true }
    }
  },

  card: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, required: true },
      name: { type: 'string' as const, required: true },
      set_name: { type: 'string' as const, required: true },
      card_number: { type: 'string' as const, required: true },
      rarity: { type: 'string' as const },
      type: { type: 'string' as const },
      subtype: { type: 'string' as const },
      hp: { type: 'number' as const },
      stage: { type: 'string' as const },
      retreat_cost: { type: 'number' as const },
      weakness_type: { type: 'string' as const },
      resistance_type: { type: 'string' as const },
      image_url: { type: 'string' as const },
      market_price: { type: 'number' as const },
      tcgplayer_id: { type: 'string' as const }
    }
  },

  collection: {
    type: 'object' as const,
    properties: {
      id: { type: 'string' as const, required: true },
      user_id: { type: 'string' as const, required: true },
      card_id: { type: 'string' as const, required: true },
      condition: { type: 'string' as const, required: true },
      quantity: { type: 'number' as const, required: true },
      acquisition_price: { type: 'number' as const },
      acquisition_date: { type: 'string' as const },
      notes: { type: 'string' as const },
      is_for_trade: { type: 'boolean' as const },
      created_at: { type: 'string' as const, required: true },
      updated_at: { type: 'string' as const, required: true }
    }
  }
}

/**
 * API contracts for Lumidex endpoints
 */
export const LumidexContracts = {
  getUserProfile: {
    name: 'getUserProfile',
    version: '1.0.0',
    schema: LumidexSchemas.user
  } as ApiContract,

  getCard: {
    name: 'getCard',
    version: '1.0.0',
    schema: LumidexSchemas.card
  } as ApiContract,

  getCollection: {
    name: 'getCollection',
    version: '1.0.0',
    schema: {
      type: 'object' as const,
      properties: {
        items: {
          type: 'array' as const,
          items: LumidexSchemas.collection,
          required: true
        },
        total: { type: 'number' as const, required: true },
        page: { type: 'number' as const, required: true },
        per_page: { type: 'number' as const, required: true }
      }
    }
  } as ApiContract
}

/**
 * Type compatibility checker
 */
export const ensureTypeCompatibility = (
  oldSchema: TypeSchema,
  newSchema: TypeSchema
): CompatibilityResult => {
  const issues: string[] = []
  const warnings: string[] = []

  // Check basic type compatibility
  if (oldSchema.type !== newSchema.type) {
    issues.push(`Type changed from ${oldSchema.type} to ${newSchema.type}`)
  }

  // Check object property compatibility
  if (oldSchema.type === 'object' && newSchema.type === 'object') {
    if (oldSchema.properties && newSchema.properties) {
      // Check for removed properties
      for (const key in oldSchema.properties) {
        if (!(key in newSchema.properties)) {
          if (oldSchema.properties[key].required) {
            issues.push(`Required property '${key}' was removed`)
          } else {
            warnings.push(`Optional property '${key}' was removed`)
          }
        }
      }

      // Check for new required properties
      for (const key in newSchema.properties) {
        if (!(key in oldSchema.properties)) {
          if (newSchema.properties[key].required) {
            issues.push(`New required property '${key}' was added`)
          }
        }
      }

      // Check property type changes
      for (const key in oldSchema.properties) {
        if (key in newSchema.properties) {
          const oldProp = oldSchema.properties[key]
          const newProp = newSchema.properties[key]
          
          if (oldProp.type !== newProp.type) {
            issues.push(`Property '${key}' type changed from ${oldProp.type} to ${newProp.type}`)
          }
        }
      }
    }
  }

  return {
    compatible: issues.length === 0,
    issues,
    warnings
  }
}

/**
 * Compatibility result interface
 */
export interface CompatibilityResult {
  compatible: boolean
  issues: string[]
  warnings: string[]
}

/**
 * Runtime type assertion helpers
 */
export const TypeAssert = {
  isString: (value: unknown): value is string => typeof value === 'string',
  isNumber: (value: unknown): value is number => typeof value === 'number',
  isBoolean: (value: unknown): value is boolean => typeof value === 'boolean',
  isArray: (value: unknown): value is unknown[] => Array.isArray(value),
  isObject: (value: unknown): value is Record<string, unknown> => 
    typeof value === 'object' && value !== null && !Array.isArray(value),

  hasProperty: <K extends string>(
    obj: unknown,
    key: K
  ): obj is Record<K, unknown> => {
    return TypeAssert.isObject(obj) && key in obj
  },

  isArrayOf: <T>(
    value: unknown,
    guard: (item: unknown) => item is T
  ): value is T[] => {
    return Array.isArray(value) && value.every(guard)
  }
}