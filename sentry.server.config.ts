import * as Sentry from '@sentry/nextjs'
import { env } from '@/lib/env-validation'

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adjust this value in production
  tracesSampleRate: 0.1,
  
  // Set environment
  environment: env.NODE_ENV,
  
  // Performance monitoring (tracesSampleRate enables tracing)
  
  // Additional configuration for server-side
  debug: false,
  enabled: !!env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Server-specific settings
  integrations: [
    Sentry.httpIntegration(),
  ],
  
  // Filter server-side errors
  beforeSend(event, hint) {
    // Filter out expected database connection retries
    if (event.exception?.values?.[0]?.value?.includes('connection')) {
      return null
    }
    
    return event
  },
})