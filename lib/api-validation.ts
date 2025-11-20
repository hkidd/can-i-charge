import { z } from 'zod'

// Charging Station schemas
export const ChargingStationSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  address: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  charger_type: z.string().nullable(),
  network: z.string().nullable(),
  num_ports: z.number().nullable(),
  created_at: z.string()
})

export const ChargingDataResponseSchema = z.object({
  zoom: z.number(),
  granularity: z.string(),
  bounds: z.object({
    north: z.number(),
    south: z.number(), 
    east: z.number(),
    west: z.number()
  }),
  count: z.number(),
  data: z.array(z.record(z.string(), z.unknown())) // Allow any additional fields
})

// Geocoding schemas
export const GeocodeResponseSchema = z.object({
  features: z.array(z.object({
    place_name: z.string(),
    center: z.tuple([z.number(), z.number()]),
    geometry: z.object({
      type: z.literal('Point'),
      coordinates: z.tuple([z.number(), z.number()])
    }),
    properties: z.record(z.string(), z.unknown()).optional()
  }))
})

// EV Score schemas
export const EVScoreResponseSchema = z.object({
  success: z.boolean(),
  score: z.number(),
  location: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  message: z.string(),
  address: z.string().nullable(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number()
  }),
  region: z.object({
    name: z.string(),
    type: z.string(),
    population: z.number().nullable(),
    distance: z.number()
  }),
  chargers: z.object({
    within_1_mile: z.number(),
    within_5_miles: z.number(),
    within_10_miles: z.number(),
    dcfast_count: z.number(),
    level2_count: z.number(),
    level1_count: z.number(),
    total: z.number(),
    nearest: z.object({
      name: z.string(),
      distance: z.number(),
      type: z.string(),
      address: z.string()
    }).nullable()
  }),
  // Legacy fields
  nearest_charger_distance: z.number().nullable(),
  chargers_1mi: z.number(),
  chargers_5mi: z.number(),
  chargers_10mi: z.number(),
  fast_charger_count: z.number(),
  fast_charger_percentage: z.number()
})

// Refresh data schemas
export const RefreshDataResponseSchema = z.object({
  success: z.boolean(),
  duration_seconds: z.number().optional(),
  stations_fetched: z.number().optional(),
  stations_inserted: z.number().optional(),
  states_generated: z.number().optional(),
  logs: z.array(z.string()).optional(),
  error: z.string().optional()
})

// Aggregation schemas
export const AggregationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  counties: z.number().optional(),
  zips: z.number().optional(),
  errors: z.array(z.string()).optional()
})

// Type exports
export type ChargingStation = z.infer<typeof ChargingStationSchema>
export type ChargingDataResponse = z.infer<typeof ChargingDataResponseSchema>
export type GeocodeResponse = z.infer<typeof GeocodeResponseSchema>
export type EVScoreResponse = z.infer<typeof EVScoreResponseSchema>
export type RefreshDataResponse = z.infer<typeof RefreshDataResponseSchema>
export type AggregationResponse = z.infer<typeof AggregationResponseSchema>

// Validation helpers
export function validateResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string
): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`Validation error in ${context}:`, error.issues)
      throw new Error(`Invalid response format: ${error.issues.map((e: z.ZodIssue) => e.message).join(', ')}`)
    }
    throw error
  }
}

// Safe parsing with fallback
export function safeParseResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fallback: T
): T {
  const result = schema.safeParse(data)
  if (result.success) {
    return result.data
  }
  console.warn('Validation failed, using fallback:', result.error)
  return fallback
}