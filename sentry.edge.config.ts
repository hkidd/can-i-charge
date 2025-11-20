import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adjust this value in production
  tracesSampleRate: 0.1,
  
  // Set environment
  environment: process.env.NODE_ENV,
  
  // Edge runtime specific configuration
  debug: process.env.NODE_ENV === 'development',
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
})