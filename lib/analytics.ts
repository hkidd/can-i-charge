import { env } from './env-validation'

// Define analytics events
export interface AnalyticsEvent {
  action: string
  category: string
  label?: string
  value?: number
  properties?: Record<string, unknown>
}

// Google Analytics 4 implementation
declare global {
  interface Window {
    gtag: (...args: any[]) => void
    dataLayer: any[]
  }
}

// PostHog implementation
declare global {
  interface Window {
    posthog: {
      capture: (event: string, properties?: Record<string, unknown>) => void
      identify: (userId: string, properties?: Record<string, unknown>) => void
      reset: () => void
    }
  }
}

export function trackEvent(event: AnalyticsEvent) {
  // Only track in production or if explicitly enabled
  if (env.NODE_ENV !== 'production' && !process.env.ANALYTICS_DEBUG) {
    console.log('[Analytics Debug]', event)
    return
  }

  // Google Analytics
  if (env.NEXT_PUBLIC_GA_MEASUREMENT_ID && typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', event.action, {
      event_category: event.category,
      event_label: event.label,
      value: event.value,
      ...event.properties
    })
  }

  // PostHog
  if (env.NEXT_PUBLIC_POSTHOG_KEY && typeof window !== 'undefined' && window.posthog) {
    window.posthog.capture(`${event.category}_${event.action}`, {
      label: event.label,
      value: event.value,
      ...event.properties
    })
  }
}

// Predefined events for the EV charging app
export const analytics = {
  // Map interactions
  mapInteraction: (action: 'zoom' | 'pan' | 'click', details?: Record<string, unknown>) => 
    trackEvent({
      action,
      category: 'map',
      properties: details
    }),

  // Search events
  search: (query: string, results?: number) =>
    trackEvent({
      action: 'search',
      category: 'address',
      label: query.substring(0, 50), // Truncate for privacy
      value: results,
      properties: { query_length: query.length }
    }),

  // EV score calculations
  evScore: (score: number, location: string) =>
    trackEvent({
      action: 'calculate',
      category: 'ev_score',
      label: location.substring(0, 50),
      value: Math.round(score),
      properties: { score_range: getScoreRange(score) }
    }),

  // Filter usage
  filterChange: (filterType: string, enabled: boolean) =>
    trackEvent({
      action: enabled ? 'enable' : 'disable',
      category: 'filter',
      label: filterType,
      properties: { filter_type: filterType }
    }),

  // Error tracking (non-Sentry)
  error: (errorType: string, context: string) =>
    trackEvent({
      action: 'error',
      category: 'application',
      label: `${context}:${errorType}`,
      properties: { error_type: errorType, context }
    }),

  // Performance metrics
  performance: (metric: string, value: number, context?: string) =>
    trackEvent({
      action: metric,
      category: 'performance',
      label: context,
      value: Math.round(value),
      properties: { metric_type: metric }
    })
}

function getScoreRange(score: number): string {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good' 
  if (score >= 40) return 'fair'
  return 'poor'
}

// Page view tracking
export function trackPageView(path: string) {
  if (env.NODE_ENV !== 'production' && !process.env.ANALYTICS_DEBUG) {
    console.log('[Analytics Debug] Page view:', path)
    return
  }

  // Google Analytics
  if (env.NEXT_PUBLIC_GA_MEASUREMENT_ID && typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
      page_path: path
    })
  }

  // PostHog automatically tracks page views, but we can send custom events
  if (env.NEXT_PUBLIC_POSTHOG_KEY && typeof window !== 'undefined' && window.posthog) {
    window.posthog.capture('$pageview', {
      $current_url: path
    })
  }
}