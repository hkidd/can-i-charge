import * as Sentry from '@sentry/nextjs'
import { env } from '@/lib/env-validation'

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1,
  
  // Set environment
  environment: env.NODE_ENV,
  
  // Configure integrations
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      // Only capture replays for errors in production
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  
  // Performance monitoring (tracesSampleRate enables tracing)
  
  // Session replay
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: env.NODE_ENV === 'production' ? 1.0 : 0,
  
  // Filter out known errors
  beforeSend(event, hint) {
    // Filter out map-related network errors that are expected
    if (event.exception?.values?.[0]?.value?.includes('Load failed')) {
      return null
    }
    
    // Filter out CSP violations for development
    if (event.exception?.values?.[0]?.type === 'SecurityPolicyViolationEvent') {
      return env.NODE_ENV === 'production' ? event : null
    }
    
    return event
  },
  
  // Additional configuration
  debug: false,
  enabled: !!env.NEXT_PUBLIC_SENTRY_DSN,
})