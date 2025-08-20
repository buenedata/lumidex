// Global error handling utilities
export interface AppError {
  code: string
  message: string
  details?: any
  timestamp: Date
  userId?: string
}

export enum ErrorCode {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  
  // Authentication errors
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  
  // Authorization errors
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Data errors
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DUPLICATE_ERROR = 'DUPLICATE_ERROR',
  
  // Server errors
  SERVER_ERROR = 'SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  
  // Client errors
  INVALID_INPUT = 'INVALID_INPUT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Pokemon TCG specific errors
  CARD_NOT_FOUND = 'CARD_NOT_FOUND',
  SET_NOT_FOUND = 'SET_NOT_FOUND',
  PRICING_UNAVAILABLE = 'PRICING_UNAVAILABLE',
  COLLECTION_ERROR = 'COLLECTION_ERROR',
  TRADE_ERROR = 'TRADE_ERROR',
  
  // Generic
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class AppErrorClass extends Error {
  public readonly code: ErrorCode
  public readonly details?: any
  public readonly timestamp: Date
  public readonly userId?: string

  constructor(
    code: ErrorCode,
    message: string,
    details?: any,
    userId?: string
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
    this.timestamp = new Date()
    this.userId = userId
  }

  toJSON(): AppError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      userId: this.userId
    }
  }
}

// Error message mappings for user-friendly display
export const errorMessages: Record<ErrorCode, string> = {
  [ErrorCode.NETWORK_ERROR]: 'Unable to connect to the server. Please check your internet connection.',
  [ErrorCode.TIMEOUT_ERROR]: 'The request timed out. Please try again.',
  
  [ErrorCode.AUTH_REQUIRED]: 'Please sign in to continue.',
  [ErrorCode.AUTH_INVALID]: 'Invalid credentials. Please check your email and password.',
  [ErrorCode.AUTH_EXPIRED]: 'Your session has expired. Please sign in again.',
  
  [ErrorCode.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions for this operation.',
  
  [ErrorCode.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ErrorCode.DUPLICATE_ERROR]: 'This item already exists.',
  
  [ErrorCode.SERVER_ERROR]: 'A server error occurred. Please try again later.',
  [ErrorCode.DATABASE_ERROR]: 'Database error. Please try again later.',
  [ErrorCode.EXTERNAL_API_ERROR]: 'External service error. Please try again later.',
  
  [ErrorCode.INVALID_INPUT]: 'Invalid input provided.',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait before trying again.',
  
  [ErrorCode.CARD_NOT_FOUND]: 'Pokemon card not found.',
  [ErrorCode.SET_NOT_FOUND]: 'Pokemon set not found.',
  [ErrorCode.PRICING_UNAVAILABLE]: 'Pricing information is currently unavailable.',
  [ErrorCode.COLLECTION_ERROR]: 'Error managing your collection.',
  [ErrorCode.TRADE_ERROR]: 'Error processing trade.',
  
  [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred.'
}

// Error classification for different handling strategies
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export const errorSeverity: Record<ErrorCode, ErrorSeverity> = {
  [ErrorCode.NETWORK_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorCode.TIMEOUT_ERROR]: ErrorSeverity.MEDIUM,
  
  [ErrorCode.AUTH_REQUIRED]: ErrorSeverity.MEDIUM,
  [ErrorCode.AUTH_INVALID]: ErrorSeverity.MEDIUM,
  [ErrorCode.AUTH_EXPIRED]: ErrorSeverity.MEDIUM,
  
  [ErrorCode.FORBIDDEN]: ErrorSeverity.HIGH,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: ErrorSeverity.HIGH,
  
  [ErrorCode.NOT_FOUND]: ErrorSeverity.LOW,
  [ErrorCode.VALIDATION_ERROR]: ErrorSeverity.LOW,
  [ErrorCode.DUPLICATE_ERROR]: ErrorSeverity.LOW,
  
  [ErrorCode.SERVER_ERROR]: ErrorSeverity.HIGH,
  [ErrorCode.DATABASE_ERROR]: ErrorSeverity.CRITICAL,
  [ErrorCode.EXTERNAL_API_ERROR]: ErrorSeverity.MEDIUM,
  
  [ErrorCode.INVALID_INPUT]: ErrorSeverity.LOW,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: ErrorSeverity.MEDIUM,
  
  [ErrorCode.CARD_NOT_FOUND]: ErrorSeverity.LOW,
  [ErrorCode.SET_NOT_FOUND]: ErrorSeverity.LOW,
  [ErrorCode.PRICING_UNAVAILABLE]: ErrorSeverity.LOW,
  [ErrorCode.COLLECTION_ERROR]: ErrorSeverity.MEDIUM,
  [ErrorCode.TRADE_ERROR]: ErrorSeverity.MEDIUM,
  
  [ErrorCode.UNKNOWN_ERROR]: ErrorSeverity.HIGH
}

// Global error handler
class ErrorHandler {
  private errorLog: AppError[] = []
  private maxLogSize = 100

  // Log error for debugging and analytics
  logError(error: AppErrorClass | Error, userId?: string): void {
    const appError = error instanceof AppErrorClass 
      ? error.toJSON()
      : {
          code: ErrorCode.UNKNOWN_ERROR,
          message: error.message,
          details: { stack: error.stack },
          timestamp: new Date(),
          userId
        }

    this.errorLog.unshift(appError)
    
    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize)
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('App Error:', appError)
    }

    // In production, you would send this to your error tracking service
    // e.g., Sentry, LogRocket, etc.
  }

  // Get user-friendly error message
  getErrorMessage(error: AppErrorClass | Error): string {
    if (error instanceof AppErrorClass) {
      return errorMessages[error.code] || error.message
    }
    
    // Handle common JavaScript errors
    if (error.name === 'TypeError') {
      return 'A technical error occurred. Please try again.'
    }
    
    if (error.name === 'NetworkError' || error.message.includes('fetch')) {
      return errorMessages[ErrorCode.NETWORK_ERROR]
    }
    
    return errorMessages[ErrorCode.UNKNOWN_ERROR]
  }

  // Check if error should be retried
  isRetryable(error: AppErrorClass | Error): boolean {
    if (error instanceof AppErrorClass) {
      const retryableCodes = [
        ErrorCode.NETWORK_ERROR,
        ErrorCode.TIMEOUT_ERROR,
        ErrorCode.SERVER_ERROR,
        ErrorCode.EXTERNAL_API_ERROR
      ]
      return retryableCodes.includes(error.code)
    }
    
    return error.name === 'NetworkError' || error.message.includes('fetch')
  }

  // Get error severity
  getErrorSeverity(error: AppErrorClass | Error): ErrorSeverity {
    if (error instanceof AppErrorClass) {
      return errorSeverity[error.code]
    }
    
    return ErrorSeverity.MEDIUM
  }

  // Get recent errors for debugging
  getRecentErrors(limit = 10): AppError[] {
    return this.errorLog.slice(0, limit)
  }

  // Clear error log
  clearErrorLog(): void {
    this.errorLog = []
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler()

// Utility functions for common error scenarios
export function createNetworkError(details?: any): AppErrorClass {
  return new AppErrorClass(
    ErrorCode.NETWORK_ERROR,
    errorMessages[ErrorCode.NETWORK_ERROR],
    details
  )
}

export function createAuthError(type: 'required' | 'invalid' | 'expired' = 'required'): AppErrorClass {
  const codeMap = {
    required: ErrorCode.AUTH_REQUIRED,
    invalid: ErrorCode.AUTH_INVALID,
    expired: ErrorCode.AUTH_EXPIRED
  }
  
  const code = codeMap[type]
  return new AppErrorClass(code, errorMessages[code])
}

export function createValidationError(message?: string, details?: any): AppErrorClass {
  return new AppErrorClass(
    ErrorCode.VALIDATION_ERROR,
    message || errorMessages[ErrorCode.VALIDATION_ERROR],
    details
  )
}

export function createNotFoundError(resource = 'resource'): AppErrorClass {
  return new AppErrorClass(
    ErrorCode.NOT_FOUND,
    `${resource.charAt(0).toUpperCase() + resource.slice(1)} not found`
  )
}

// Handle Supabase errors
export function handleSupabaseError(error: any): AppErrorClass {
  if (error?.code === 'PGRST116') {
    return createNotFoundError()
  }
  
  if (error?.code === '23505') {
    return new AppErrorClass(ErrorCode.DUPLICATE_ERROR, errorMessages[ErrorCode.DUPLICATE_ERROR])
  }
  
  if (error?.message?.includes('JWT')) {
    return createAuthError('expired')
  }
  
  return new AppErrorClass(
    ErrorCode.DATABASE_ERROR,
    errorMessages[ErrorCode.DATABASE_ERROR],
    error
  )
}

// Handle fetch errors
export function handleFetchError(error: any): AppErrorClass {
  if (error.name === 'AbortError') {
    return new AppErrorClass(ErrorCode.TIMEOUT_ERROR, errorMessages[ErrorCode.TIMEOUT_ERROR])
  }
  
  if (!navigator.onLine) {
    return createNetworkError({ offline: true })
  }
  
  return createNetworkError(error)
}