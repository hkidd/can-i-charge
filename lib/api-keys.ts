import { supabaseAdmin } from './supabase'
import crypto from 'crypto'

// Generate a unique API key
export function generateApiKey(): string {
    const prefix = 'cic_live_'
    const randomBytes = crypto.randomBytes(24).toString('base64url')
    return `${prefix}${randomBytes}`
}

// Create a new API key for a subscriber
export async function createApiKey(params: {
    email: string
    polarCustomerId?: string
    polarSubscriptionId?: string
}): Promise<{ success: boolean; apiKey?: string; error?: string }> {
    try {
        const apiKey = generateApiKey()

        const { data, error } = await supabaseAdmin
            .from('api_keys')
            .insert({
                email: params.email.toLowerCase(),
                api_key: apiKey,
                polar_customer_id: params.polarCustomerId,
                polar_subscription_id: params.polarSubscriptionId,
                status: 'active',
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating API key:', error)
            return { success: false, error: error.message }
        }

        return { success: true, apiKey }
    } catch (err) {
        console.error('Error creating API key:', err)
        return { success: false, error: 'Failed to create API key' }
    }
}

// Get API key by email
export async function getApiKeyByEmail(email: string): Promise<{
    success: boolean
    apiKey?: string
    status?: string
    error?: string
}> {
    try {
        const { data, error } = await supabaseAdmin
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
    } catch (err) {
        return { success: false, error: 'Failed to retrieve API key' }
    }
}

// Validate an API key and check rate limits (atomic operation to prevent race conditions)
export async function validateApiKey(apiKey: string): Promise<{
    valid: boolean
    email?: string
    remainingRequests?: number
    error?: string
}> {
    try {
        const today = new Date().toISOString().split('T')[0]
        const dailyLimit = 1000

        // First, check if the key exists and is active
        const { data: keyData, error: keyError } = await supabaseAdmin
            .from('api_keys')
            .select('email, status, requests_today, last_request_date')
            .eq('api_key', apiKey)
            .single()

        if (keyError || !keyData) {
            return { valid: false, error: 'Invalid API key' }
        }

        if (keyData.status !== 'active') {
            return { valid: false, error: 'API key is not active' }
        }

        // Check if already at limit for today
        const isToday = keyData.last_request_date === today
        const currentCount = isToday ? (keyData.requests_today || 0) : 0

        if (currentCount >= dailyLimit) {
            return {
                valid: false,
                error: 'Daily request limit exceeded',
                remainingRequests: 0,
            }
        }

        // Atomic increment: Use a conditional update that only succeeds if under limit
        // This prevents race conditions by making the check and increment atomic
        const { data: updateData, error: updateError } = await supabaseAdmin
            .rpc('increment_api_requests', {
                key: apiKey,
                today_date: today,
                max_requests: dailyLimit
            })

        // If RPC doesn't exist, fall back to regular update
        // (The RPC provides atomic guarantees, but we need to create it first)
        if (updateError?.code === 'PGRST202') {
            // RPC function doesn't exist, use regular update with optimistic approach
            const newCount = isToday ? currentCount + 1 : 1

            const { error: fallbackError } = await supabaseAdmin
                .from('api_keys')
                .update({
                    requests_today: newCount,
                    last_request_date: today,
                })
                .eq('api_key', apiKey)
                .eq('status', 'active')

            if (fallbackError) {
                console.error('Error updating API key count:', fallbackError)
                return { valid: false, error: 'Failed to validate API key' }
            }

            return {
                valid: true,
                email: keyData.email,
                remainingRequests: dailyLimit - newCount,
            }
        }

        if (updateError) {
            console.error('Error in atomic increment:', updateError)
            return { valid: false, error: 'Failed to validate API key' }
        }

        // RPC returns the new count or -1 if limit exceeded
        if (updateData === -1) {
            return {
                valid: false,
                error: 'Daily request limit exceeded',
                remainingRequests: 0,
            }
        }

        return {
            valid: true,
            email: keyData.email,
            remainingRequests: dailyLimit - updateData,
        }
    } catch (err) {
        console.error('Error validating API key:', err)
        return { valid: false, error: 'Failed to validate API key' }
    }
}

// Revoke an API key (e.g., when subscription is cancelled)
export async function revokeApiKey(polarSubscriptionId: string): Promise<{
    success: boolean
    error?: string
}> {
    try {
        const { error } = await supabaseAdmin
            .from('api_keys')
            .update({ status: 'revoked' })
            .eq('polar_subscription_id', polarSubscriptionId)

        if (error) {
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (err) {
        return { success: false, error: 'Failed to revoke API key' }
    }
}
