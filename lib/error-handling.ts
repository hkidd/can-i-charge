export type ErrorLevel = 'error' | 'warning' | 'info' | 'success'

export interface ApiError {
  message: string
  code?: string
  statusCode?: number
  details?: unknown
}

export class ApiResponseError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiResponseError'
  }
}

export interface ToastMessage {
  id: string
  level: ErrorLevel
  title: string
  message?: string
  duration?: number
}

// Error messages for user-friendly display
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Unable to connect to the server. Please check your connection.',
  DATA_LOAD_ERROR: 'Unable to load charging station data. Please try again.',
  GEOCODING_ERROR: 'Unable to find that location. Please try a different address.',
  RATE_LIMIT_ERROR: 'Too many requests. Please wait a moment and try again.',
  SERVER_ERROR: 'Something went wrong on our end. Please try again later.',
  VALIDATION_ERROR: 'Invalid data received. Please refresh the page.',
  SUPABASE_ERROR: 'Database connection error. Please try again.',
  NOT_FOUND: 'The requested data was not found.',
  PERMISSION_DENIED: 'You do not have permission to access this resource.'
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiResponseError) {
    if (error.statusCode === 429) return ERROR_MESSAGES.RATE_LIMIT_ERROR
    if (error.statusCode === 404) return ERROR_MESSAGES.NOT_FOUND
    if (error.statusCode === 403) return ERROR_MESSAGES.PERMISSION_DENIED
    if (error.statusCode && error.statusCode >= 500) return ERROR_MESSAGES.SERVER_ERROR
    return error.message || ERROR_MESSAGES.DATA_LOAD_ERROR
  }
  
  if (error instanceof Error) {
    if (error.message.includes('network')) return ERROR_MESSAGES.NETWORK_ERROR
    if (error.message.includes('fetch')) return ERROR_MESSAGES.NETWORK_ERROR
    return error.message
  }
  
  return ERROR_MESSAGES.SERVER_ERROR
}

export function logError(error: unknown, context: string, additionalData?: Record<string, unknown>) {
  const timestamp = new Date().toISOString()
  const errorInfo = {
    timestamp,
    context,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error,
    additionalData,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined
  }
  
  console.error(`[${context}]`, errorInfo)
  
  // Send to Sentry if available
  if (typeof window !== 'undefined' && (window as any).__SENTRY__) {
    const Sentry = (window as any).__SENTRY__
    Sentry.withScope((scope: any) => {
      scope.setTag('context', context)
      if (additionalData) {
        scope.setContext('additional', additionalData)
      }
      if (error instanceof Error) {
        Sentry.captureException(error)
      } else {
        Sentry.captureMessage(`Error in ${context}: ${String(error)}`)
      }
    })
  } else if (typeof globalThis !== 'undefined' && (globalThis as any).__SENTRY__) {
    // Server-side Sentry
    const Sentry = (globalThis as any).__SENTRY__
    Sentry.withScope((scope: any) => {
      scope.setTag('context', context)
      if (additionalData) {
        scope.setContext('additional', additionalData)
      }
      if (error instanceof Error) {
        Sentry.captureException(error)
      } else {
        Sentry.captureMessage(`Error in ${context}: ${String(error)}`)
      }
    })
  }
}

export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  options: {
    fallback?: T
    onError?: (error: unknown) => void
    retries?: number
    retryDelay?: number
  } = {}
): Promise<T> {
  const { fallback, onError, retries = 0, retryDelay = 1000 } = options
  
  let lastError: unknown
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      logError(error, context, { attempt, retries })
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)))
        continue
      }
      
      if (onError) {
        onError(error)
      }
      
      if (fallback !== undefined) {
        return fallback
      }
    }
  }
  
  throw lastError
}

// Validation helpers
export function validateApiResponse<T>(
  response: unknown,
  validator: (data: unknown) => data is T,
  context: string
): T {
  if (!validator(response)) {
    throw new ApiResponseError(
      ERROR_MESSAGES.VALIDATION_ERROR,
      undefined,
      'VALIDATION_ERROR',
      { response, context }
    )
  }
  return response
}

// Type guards for common response shapes
export function isArrayResponse<T>(
  response: unknown,
  itemValidator?: (item: unknown) => item is T
): response is T[] {
  if (!Array.isArray(response)) return false
  if (itemValidator) {
    return response.every(itemValidator)
  }
  return true
}

export function hasRequiredFields<T extends Record<string, unknown>>(
  obj: unknown,
  fields: (keyof T)[]
): obj is T {
  if (typeof obj !== 'object' || obj === null) return false
  return fields.every(field => field in obj)
}