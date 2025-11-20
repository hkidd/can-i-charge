import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Clone the request headers
  const requestHeaders = new Headers(request.headers)
  
  // Create response
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy', 
    'camera=(), microphone=(), geolocation=*'
  )
  
  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.mapbox.com https://*.mapbox.com",
    "style-src 'self' 'unsafe-inline' https://api.mapbox.com https://*.mapbox.com",
    "img-src 'self' data: blob: https://api.mapbox.com https://*.mapbox.com https://*.maptiler.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://api.mapbox.com https://*.mapbox.com https://*.maptiler.com wss://*.supabase.co https://api.geocode.earth https://o4504330929045504.ingest.sentry.io https://cdn.jsdelivr.net https://developer.nrel.gov",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'"
  ]
  
  // Add CSP header
  response.headers.set(
    'Content-Security-Policy',
    cspDirectives.join('; ')
  )
  
  // Strict Transport Security (only in production)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    )
  }
  
  return response
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}