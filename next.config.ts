import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
    // Enable experimental features for better performance
    experimental: {
        optimizePackageImports: ['mapbox-gl']
    },

    // Optimize images
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'api.mapbox.com'
            },
            {
                protocol: 'https',
                hostname: '*.mapbox.com'
            }
        ]
    },

    // Compress responses
    compress: true,

    // SWC minification is enabled by default in Next.js 13+

    // Bundle analysis (uncomment for debugging)
    // bundleAnalyzer: {
    //   enabled: process.env.ANALYZE === 'true',
    // },

    // Headers for static assets and CORS
    async headers() {
        const isProduction = process.env.NODE_ENV === 'production'
        const allowedOrigins = isProduction
            ? [
                  process.env.NEXT_PUBLIC_URL ||
                      'https://can-i-charge.vercel.app',
                  'https://can-i-charge.com'
              ]
            : ['http://localhost:3000']

        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on'
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff'
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY'
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block'
                    }
                ]
            },
            {
                source: '/api/(.*)',
                headers: [
                    {
                        key: 'Access-Control-Allow-Origin',
                        value: allowedOrigins.join(', ')
                    },
                    {
                        key: 'Access-Control-Allow-Methods',
                        value: 'GET, POST, OPTIONS'
                    },
                    {
                        key: 'Access-Control-Allow-Headers',
                        value: 'Content-Type, Authorization, X-Admin-Request'
                    },
                    {
                        key: 'Cache-Control',
                        value: 'public, s-maxage=60, stale-while-revalidate=300'
                    }
                ]
            }
        ]
    }
}

// Wrap with Sentry configuration
export default withSentryConfig(nextConfig, {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during build
    silent: true,

    // Upload source maps to Sentry
    sourcemaps: {
        disable: process.env.NODE_ENV === 'development'
    },

    // Disable Sentry features in development
    disableLogger: process.env.NODE_ENV === 'development'
})
