import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
const isProduction = process.env.NODE_ENV === 'production'

Sentry.init({
  dsn: dsn,
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1,
  
  // Set environment
  environment: process.env.NODE_ENV,
  
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
  replaysOnErrorSampleRate: isProduction ? 1.0 : 0,
  
  // Filter out known errors
  beforeSend(event) {
    // Filter out map-related network errors that are expected
    if (event.exception?.values?.[0]?.value?.includes('Load failed')) {
      return null
    }
    
    // Filter out CSP violations for development
    if (event.exception?.values?.[0]?.type === 'SecurityPolicyViolationEvent') {
      return isProduction ? event : null
    }
    
    return event
  },
  
  // Additional configuration
  debug: false,
  enabled: !!dsn,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
