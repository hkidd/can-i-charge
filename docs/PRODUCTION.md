# Production Deployment Guide

## Pre-deployment Checklist

### ✅ Environment Variables
1. Copy `.env.production.example` to `.env.production` 
2. Update all placeholder values with production credentials
3. Generate secure random strings for `CRON_SECRET` (64+ chars)
4. Set `NEXT_PUBLIC_URL` to your production domain

### ✅ Database Setup
1. Ensure Supabase project is in production mode
2. Verify all required tables exist:
   - `charging_stations`
   - `county_level_data` (with VMT columns)
   - `state_level_data`
   - `zip_level_data`
3. Run final data aggregation: `/api/refresh-data`

### ✅ External Services
1. **Mapbox**: Verify token works in production
2. **NREL**: Confirm API key has sufficient quota
3. **Census**: Verify API key is active
4. **Sentry**: Test error reporting

## Deployment Options

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
# or use CLI:
vercel env add NEXT_PUBLIC_SUPABASE_URL
```

### Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build and deploy
npm run build
netlify deploy --prod --dir=.next
```

### Docker
```bash
# Build image
docker build -t can-i-charge .

# Run with environment file
docker run -p 3000:3000 --env-file .env.production can-i-charge
```

## Post-deployment Tasks

### 1. DNS Configuration
- Point domain to hosting platform
- Set up SSL certificate (usually automatic)

### 2. Monitoring Setup
- Verify Sentry error reporting
- Set up uptime monitoring (UptimeRobot, etc.)
- Monitor database performance

### 3. Performance Optimization
- Enable CDN for static assets
- Configure caching headers
- Monitor Core Web Vitals

### 4. Security
- Verify CORS settings
- Check API rate limiting
- Review Supabase Row Level Security (RLS)

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_URL` | ✅ | Production domain for OG images |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Public Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Admin Supabase key |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | ✅ | Mapbox public token |
| `NREL_API_KEY` | ✅ | NREL charging data API |
| `CENSUS_API_KEY` | ✅ | Census population data API |
| `CRON_SECRET` | ✅ | Admin endpoint security |
| `NEXT_PUBLIC_SENTRY_DSN` | 📋 | Error monitoring |

## Maintenance

### Daily
- Check Sentry for errors
- Monitor database usage

### Weekly  
- Review API quota usage (NREL, Census)
- Check map tile usage (Mapbox)

### Monthly
- Update charging station data: `/api/refresh-data`
- Review performance metrics
- Update dependencies

## Troubleshooting

### Common Issues

**Map not loading:**
- Check Mapbox token validity
- Verify CORS settings
- Check browser console for errors

**Data not updating:**
- Verify CRON_SECRET in admin calls
- Check API key quotas
- Review Supabase logs

**Performance issues:**
- Monitor database query performance
- Check bundle size with `npm run build`
- Review network requests in DevTools

## Support

For deployment issues:
1. Check Sentry error logs
2. Review hosting platform logs
3. Verify all environment variables are set
4. Test API endpoints manually