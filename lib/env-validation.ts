import { z } from 'zod'

const envSchema = z.object({
  // Required environment variables
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().min(1, 'Mapbox token is required'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),
  NREL_API_KEY: z.string().min(1, 'NREL API key is required'),
  CRON_SECRET: z.string().min(32, 'Cron secret must be at least 32 characters'),
  
  // Optional environment variables with defaults
  NEXT_PUBLIC_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  
  // Optional monitoring/analytics
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
})

type Env = z.infer<typeof envSchema>

// Validate environment variables at build time
function validateEnv(): Env {
  try {
    return envSchema.parse({
      NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NREL_API_KEY: process.env.NREL_API_KEY,
      CRON_SECRET: process.env.CRON_SECRET,
      NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
      NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
      NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:')
      console.error(error.flatten().fieldErrors)
      throw new Error('Required environment variables are missing')
    }
    throw error
  }
}

// Export validated environment variables
export const env = validateEnv()

// Helper to check if in production
export const isProduction = env.NODE_ENV === 'production'

// Helper to get base URL
export function getBaseUrl() {
  if (env.NEXT_PUBLIC_URL) return env.NEXT_PUBLIC_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}