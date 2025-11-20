# Production Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in all required values:

-   [x] `NEXT_PUBLIC_MAPBOX_TOKEN` - Get from [Mapbox](https://account.mapbox.com/)
-   [x] `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
-   [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
-   [x] `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
-   [x] `NREL_API_KEY` - Get from [NREL](https://developer.nrel.gov/signup/)
-   [x] `CRON_SECRET` - Generate a secure 32+ character string

### 2. Database Setup

Ensure your Supabase database has the required tables and functions:

-   [x] `charging_stations` table
-   [x] `state_level_data` table
-   [x] `county_level_data` table
-   [x] `zip_level_data` table
-   [x] Staging tables for atomic updates
-   [x] PostGIS functions for geometry operations

### 3. Build Verification

```bash
npm run build
npm run lint
npm run type-check
```

### 4. Security Headers

The middleware automatically adds security headers including:

-   Content Security Policy
-   X-Frame-Options
-   X-Content-Type-Options
-   Strict Transport Security (production only)

## Vercel Deployment

### 1. Connect Repository

1. Push your code to GitHub
2. Connect repository to Vercel
3. Import project

### 2. Configure Environment Variables

In Vercel dashboard, add all environment variables from your `.env.local`

### 3. Build Settings

Vercel will auto-detect Next.js settings:

-   Build Command: `next build`
-   Output Directory: `.next`
-   Install Command: `npm install`

### 4. Domain Configuration

1. Add your custom domain in Vercel
2. Update `NEXT_PUBLIC_URL` environment variable
3. Configure DNS records

### 5. Cron Jobs

The `vercel.json` file configures automatic cron jobs:

-   Daily data refresh at 3 AM UTC
-   Maximum function duration: 5 minutes

## Post-Deployment

### 1. Verify Functionality

-   [ ] Map loads correctly
-   [ ] Address search works
-   [ ] EV score calculation works
-   [ ] Data refresh API is accessible

### 2. Initial Data Load

Trigger the first data refresh:

```bash
curl -X GET "https://your-domain.com/api/cron/trigger?secret=YOUR_CRON_SECRET"
```

### 3. Monitor Performance

-   Check Vercel Analytics
-   Monitor API response times
-   Check error rates

## Production Optimizations

### 1. Image Optimization

-   Uses Next.js automatic image optimization
-   Dynamic favicon and OG image generation

### 2. Caching Strategy

-   API responses cached at CDN level
-   Map tiles cached by browser
-   Static assets cached with aggressive headers

### 3. Error Handling

-   Comprehensive error logging
-   User-friendly error messages
-   Automatic fallbacks for API failures

### 4. Performance

-   Code splitting enabled
-   Tree shaking for unused code
-   Minified CSS and JS

## Monitoring

### 1. Error Tracking

Optional: Configure Sentry for error monitoring

```bash
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
```

### 2. Analytics

Optional: Add Google Analytics or PostHog

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key
```

### 3. Uptime Monitoring

Consider setting up external uptime monitoring for:

-   Main website availability
-   API endpoint health
-   Data refresh job success

## Scaling Considerations

### 1. Database Performance

-   Monitor Supabase database usage
-   Add indexes for frequently queried columns
-   Consider read replicas for high traffic

### 2. API Rate Limiting

-   Built-in rate limiting protects against abuse
-   Monitor API usage patterns
-   Scale Vercel plan if needed

### 3. Data Updates

-   Current setup refreshes all data daily
-   Consider more frequent updates for high-traffic areas
-   Monitor NREL API rate limits

## Troubleshooting

### Common Issues

1. **Map not loading**

    - Verify Mapbox token is valid
    - Check CSP headers allow Mapbox domains

2. **No data displayed**

    - Ensure initial data refresh completed
    - Check Supabase connection and tables

3. **Cron job failures**

    - Verify CRON_SECRET environment variable
    - Check function timeout limits
    - Monitor NREL API availability

4. **Build failures**
    - Run environment validation locally
    - Check all required dependencies are installed
    - Verify TypeScript compilation

## Support

For deployment issues:

1. Check Vercel deployment logs
2. Review environment variable configuration
3. Test API endpoints individually
4. Verify database connectivity
