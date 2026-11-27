import { z } from 'zod'
import { getSupabaseAdmin } from './supabase-admin'
import { generateApiKey } from './api-keys'
import { sendApiKeyEmail } from './email'

export const subscriptionSchema = z.object({
    id: z.string().min(1),
    product_id: z.string().min(1),
    modified_at: z.iso.datetime({ offset: true }).nullish(),
    status: z.enum(['incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'trial_ended']),
    customer_id: z.string().min(1),
    customer: z.object({ email: z.email() }),
    cancel_at_period_end: z.boolean().optional(),
    current_period_end: z.iso.datetime({ offset: true }).nullish(),
    ends_at: z.iso.datetime({ offset: true }).nullish(),
    ended_at: z.iso.datetime({ offset: true }).nullish()
})

export function subscriptionHasAccess(subscription: z.infer<typeof subscriptionSchema>, eventType: string): boolean {
    if (eventType === 'subscription.revoked' || subscription.ended_at) return false
    if (['active', 'trialing', 'past_due'].includes(subscription.status)) return true
    const end = subscription.ends_at ?? subscription.current_period_end
    return subscription.status === 'canceled' && subscription.cancel_at_period_end === true &&
        end != null && Date.parse(end) > Date.now()
}

export async function applySubscriptionEvent(type: string, timestamp: string, input: unknown) {
    const subscription = subscriptionSchema.parse(input)
    const productId = process.env.POLAR_PRODUCT_ID
    if (!productId?.trim()) throw new Error('Subscription product is not configured')
    const database = getSupabaseAdmin()
    const { data, error } = await database.rpc('apply_subscription_access', {
        p_subscription_id: subscription.id,
        p_updated_at: subscription.modified_at ?? timestamp,
        p_active: subscription.product_id === productId && subscriptionHasAccess(subscription, type),
        p_email: subscription.customer.email,
        p_customer_id: subscription.customer_id,
        p_new_api_key: generateApiKey()
    }).abortSignal(AbortSignal.timeout(15000))
    if (error) throw new Error('Subscription access could not be saved')
    const result = z.object({ api_key: z.string().nullable(), send_email: z.boolean(), stale: z.boolean() }).parse(data)
    if (!result.send_email || !result.api_key) return

    const email = await sendApiKeyEmail({
        to: subscription.customer.email, apiKey: result.api_key,
        idempotencyKey: `subscription-welcome/${subscription.id}`
    })
    if (!email.success) throw new Error('Subscription email delivery failed')
    const saved = await database.rpc('mark_subscription_email_sent', {
        p_subscription_id: subscription.id, p_api_key: result.api_key
    }).abortSignal(AbortSignal.timeout(5000))
    if (saved.error) throw new Error('Subscription email receipt could not be saved')
}
