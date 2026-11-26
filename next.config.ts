import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs/config'

const nextConfig: NextConfig = {
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
                        key: 'Cache-Control',
                        value: 'private, no-store'
                    }
                ]
            },
            {
                // These read endpoints serve the public map and third-party widgets.
                source: '/api/:endpoint(ev-score|charging-data|geocode|top-states)',
                headers: [
                    { key: 'Access-Control-Allow-Origin', value: '*' },
                    { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
                    { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
                    { key: 'Access-Control-Expose-Headers', value: 'X-RateLimit-Limit, X-RateLimit-Remaining' }
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

    bundleSizeOptimizations: {
        excludeDebugStatements: process.env.NODE_ENV === 'development'
    }
})
