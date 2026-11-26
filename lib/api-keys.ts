import { getSupabaseAdmin } from './supabase-admin'
import crypto from 'crypto'
import { z } from 'zod'

const quotaResultSchema = z.object({
    valid: z.boolean(), email: z.string().optional(),
    remainingRequests: z.number().int().min(0).max(1000),
    reason: z.enum(['invalid', 'quota']).optional()
})

// Generate a unique API key
export function generateApiKey(): string {
    const prefix = 'cic_live_'
    const randomBytes = crypto.randomBytes(24).toString('base64url')
    return `${prefix}${randomBytes}`
}

// Get API key by email
export async function getApiKeyByEmail(email: string): Promise<{
    success: boolean
    apiKey?: string
    status?: string
    error?: string
}> {
    try {
        const { data, error } = await getSupabaseAdmin()
            .from('api_keys')
            .select('api_key, status')
            .eq('email', email.toLowerCase())
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (error || !data) {
            return { success: false, error: 'No active API key found for this email' }
        }

        return { success: true, apiKey: data.api_key, status: data.status }
    } catch {
        return { success: false, error: 'Failed to retrieve API key' }
    }
}

// A database transaction checks status and consumes the daily quota together.
export async function validateApiKey(apiKey: string): Promise<{
    valid: boolean
    reason?: 'invalid' | 'quota' | 'unavailable'
    email?: string
    remainingRequests?: number
    error?: string
}> {
    try {
        const { data, error } = await getSupabaseAdmin().rpc('consume_api_key', {
            p_api_key: apiKey, p_day: new Date().toISOString().slice(0, 10)
        }).abortSignal(AbortSignal.timeout(5000))
        if (error) throw new Error('API quota service is unavailable')
        return quotaResultSchema.parse(data)
    } catch (error) {
        console.error('API key validation failed:', error)
        return { valid: false, reason: 'unavailable', error: 'API quota service is unavailable' }
    }
}
